"""Offline API boundary tests: fixtures never substitute production integrations."""

from io import BytesIO
import json
from uuid import uuid4
import zipfile

import httpx2 as httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.main import create_app
from app.services.supabase import Supabase, Identity, identity
from app.services.extractor import extract, chunks
from app.services.processing import extract_parts, process_one
from app.services.cloudflare import AIUnavailable
from app.services.assistant import answer_question
from app.services.retrieval import Hit, Passage
from test_cloudflare_transport import Reply, provider

USER = "a0000000-0000-0000-0000-000000000001"
COMPANY = "10000000-0000-0000-0000-000000000001"
DOC = "d0000000-0000-0000-0000-000000000001"
CONV = "c0000000-0000-0000-0000-000000000001"


def config(**values):
    defaults = dict(
        supabase_url="https://project.supabase.co",
        supabase_publishable_key="sb_publishable_test",
        supabase_service_key="sb_secret_test",
    )
    defaults.update(values)
    return Settings(_env_file=None, **defaults)


@pytest.mark.parametrize(
    "path,method",
    [
        ("/me", "GET"),
        ("/documents", "GET"),
        ("/departments", "POST"),
        ("/assistant/ask", "POST"),
        ("/conversations", "GET"),
        ("/members", "GET"),
    ],
)
def test_production_routes_require_verified_token(path, method):
    with TestClient(create_app(config())) as client:
        assert (
            client.request(method, "/api/v1" + path, json={"question": "hello"}).status_code == 401
        )
        assert client.get("/api/v1/demo/documents").status_code == 404


def test_token_verified_by_supabase_and_membership_from_database(monkeypatch):
    seen = []

    def handle(self, method, path, **kwargs):
        seen.append((path, self.token))
        if path == "/auth/v1/user":
            return {
                "id": USER,
                "user_metadata": {"role": "company_admin", "company_id": "invented"},
            }
        return [{"id": USER, "company_id": COMPANY, "role": "new_employee", "is_active": True}]

    monkeypatch.setattr(Supabase, "request", handle)
    with TestClient(create_app(config())) as client:
        assert (
            client.get("/api/v1/members", headers={"Authorization": "Bearer user-jwt"}).status_code
            == 403
        )
    assert seen[0] == ("/auth/v1/user", "user-jwt")


def test_invalid_expired_identity_is_not_trusted(monkeypatch):
    monkeypatch.setattr(Supabase, "request", lambda *a, **k: {"id": "invalid"})
    with TestClient(create_app(config())) as client:
        assert (
            client.get("/api/v1/me", headers={"Authorization": "Bearer invalid"}).status_code == 401
        )


class FakeDB:
    def __init__(self):
        self.calls = []

    def rows(self, table, **filters):
        self.calls.append((table, filters))
        if table == "documents":
            return [{"id": DOC}]
        if table == "conversations":
            return [{"id": CONV}]
        return []

    def request(self, method, path, **kwargs):
        self.calls.append((method, path, kwargs))
        if path.endswith("conversations"):
            return [{"id": CONV}]
        return []

    def rpc(self, name, data):
        self.calls.append((name, data))
        return []


def member_app(role="new_employee"):
    app = create_app(config(retrieval_mode="lexical"))
    db = FakeDB()
    app.dependency_overrides[identity] = lambda: Identity(USER, COMPANY, role, {"id": USER}, db)
    return app, db


def test_profile_cannot_change_role_or_company():
    app, db = member_app()
    with TestClient(app) as client:
        assert (
            client.patch(
                "/api/v1/profile", json={"display_name": "name", "role": "company_admin"}
            ).status_code
            == 422
        )
        assert client.patch("/api/v1/profile", json={"display_name": "name"}).status_code == 200
    assert db.calls[-1][2]["data"] == {"display_name": "name"}


def test_document_listing_and_chunks_explicitly_scoped():
    app, db = member_app()
    with TestClient(app) as client:
        assert client.get("/api/v1/documents").status_code == 200
        assert client.get(f"/api/v1/documents/{DOC}/chunks").status_code == 200
    assert all(filters.get("company_id") == "eq." + COMPANY for _, filters in db.calls)


@pytest.mark.parametrize(
    "filename,mime,data,status",
    [
        ("x.exe", "application/octet-stream", b"bad", 415),
        ("x.pdf", "application/pdf", b"not pdf", 415),
        ("x.txt", "text/plain", b"\xff", 415),
        ("x.txt", "text/plain", b"", 413),
        ("x.txt", "text/plain", b"\x00text", 415),
    ],
)
def test_upload_rejects_invalid_inputs_before_trusted_operations(filename, mime, data, status):
    app, db = member_app("company_admin")
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/documents", data={"title": "document"}, files={"file": (filename, data, mime)}
        )
        assert response.status_code == status
    assert not db.calls


def test_employee_cannot_upload():
    app, _ = member_app()
    with TestClient(app) as client:
        assert (
            client.post(
                "/api/v1/documents",
                data={"title": "doc"},
                files={"file": ("x.txt", b"text", "text/plain")},
            ).status_code
            == 403
        )


def test_valid_upload_registers_before_bytes_and_finalizes_after(monkeypatch):
    app, _ = member_app("company_admin")
    trusted = FakeDB()
    monkeypatch.setattr("app.api.product.trusted", lambda request: trusted)
    trusted.storage_path = lambda bucket, path: "/storage/v1/object/" + bucket + "/" + path
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/documents",
            data={"title": "وثيقة", "visibility": "company"},
            files={"file": ("policy.txt", "نص عربي English".encode(), "text/plain")},
        )
        assert response.status_code == 201
    assert trusted.calls[0][0] == "register_document"
    assert trusted.calls[0][1]["actor"] == USER
    assert trusted.calls[1][0] == "POST"
    assert trusted.calls[2] == (
        "mark_document_uploaded",
        {"actor": USER, "document_id": response.json()["id"], "successful": True},
    )


def test_question_without_evidence_persists_refusal_no_model(monkeypatch):
    app, db = member_app()
    service = FakeDB()
    monkeypatch.setattr("app.api.chat.Supabase", lambda *a, **k: service)
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/assistant/ask",
            json={"question": "سياسة غير موجودة", "request_id": str(uuid4())},
        )
        assert response.status_code == 200, response.text
        assert response.json()["demo"] is False
        assert response.json()["status"] == "not_found"
    assert service.calls[0][0] == "save_turn"
    assert service.calls[0][1]["source_refs"] == []
    assert db.calls[-1][0] == "search_chunks"


@pytest.mark.parametrize(
    "text", ["اتصل بالشبكة الافتراضية VPN باستخدام MFA.", "Connect to the company VPN using MFA."]
)
def test_real_source_evidence_supports_arabic_and_english(text):
    class Llama:
        settings = config()

        def generate(self, system, question):
            assert text in system
            return json.dumps(
                {
                    "supported": True,
                    "answer": text,
                    "citations": [{"source_id": "S1", "evidence_ids": ["S1:E1"]}],
                }
            )

    hits = [Hit(Passage(DOC, DOC, "وثيقة", "قسم", text, 2), 1.0)]
    result = answer_question("VPN?", Llama(), retrieved_hits=hits, demo=False)
    assert result.sources[0].quote == text
    assert result.sources[0].chunk_id == DOC
    assert result.sources[0].page_number == 2


@pytest.mark.parametrize("text", ["نص عربي مع English MFA.", "VPN instructions."])
def test_text_extraction_in_bounded_subprocess(text):
    parts = extract_parts(text.encode(), "txt")
    assert parts[0]["content"] == text
    assert parts[0]["chunk_index"] == 0


def test_docx_extraction_and_malicious_xml():
    def doc(xml):
        stream = BytesIO()
        with zipfile.ZipFile(stream, "w") as archive:
            archive.writestr("word/document.xml", xml)
        return stream.getvalue()

    xml = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>VPN نص</w:t></w:r></w:p></w:body></w:document>'
    assert extract(doc(xml), "docx")[0]["text"] == "VPN نص"
    with pytest.raises(ValueError, match="UNSAFE_XML"):
        extract(doc("<!DOCTYPE bad>" + xml), "docx")


def test_empty_pdf_and_invalid_documents_fail_closed():
    from pypdf import PdfWriter

    pdf = BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(100, 100)
    writer.write(pdf)
    with pytest.raises(ValueError, match="EMPTY_OR_SCANNED_DOCUMENT"):
        extract(pdf.getvalue(), "pdf")
    for data, kind in [(b"   ", "txt"), (b"bad", "pdf"), (b"bad", "docx")]:
        with pytest.raises(Exception):
            extract(data, kind)


def test_chunking_preserves_exact_text_and_bounds():
    text = ("العربية English VPN. " * 1000).strip()
    parts = chunks([{"text": text, "page_number": 3}])
    assert len(parts) > 1
    assert all(
        part["content"] in text and len(part["content"]) <= 1800 and part["page_number"] == 3
        for part in parts
    )


@pytest.mark.parametrize(
    "bad", [[[0] * 1023], [[True] * 1024], [[float("nan")] * 1024], [], [[1] * 1024, [2] * 1024]]
)
def test_embedding_invalid_dimensions_or_numbers_rejected(monkeypatch, bad):
    monkeypatch.setattr(
        "app.services.cloudflare.urlopen",
        lambda *a, **k: Reply({"success": True, "result": {"data": bad}}),
    )
    with pytest.raises(AIUnavailable):
        provider().embed(["نص"])


def test_embedding_protocol_uses_bge_m3_and_batch(monkeypatch):
    def response(request, timeout):
        assert request.full_url.endswith("/@cf/baai/bge-m3")
        assert json.loads(request.data) == {"text": ["عربي", "English"]}
        return Reply({"success": True, "result": {"data": [[0.01] * 1024, [0.02] * 1024]}})

    monkeypatch.setattr("app.services.cloudflare.urlopen", response)
    assert len(provider().embed(["عربي", "English"])) == 2


def test_worker_finishes_only_after_embedding_and_verifies_content(monkeypatch):
    import hashlib

    class Queue(FakeDB):
        def rpc(self, name, data):
            self.calls.append((name, data))
            if name == "claim_document":
                return [
                    {
                        "id": DOC,
                        "processing_token": "lease",
                        "storage_bucket": "company-documents",
                        "storage_path": "path",
                        "mime_type": "text/plain",
                        "content_sha256": hashlib.sha256(b"VPN").hexdigest(),
                    }
                ]

        def request(self, *a, **k):
            return b"VPN"

        def storage_path(self, *a):
            return "/object"

    class AI:
        def embed(self, text):
            return [[0.1] * 1024]

    db = Queue()
    assert process_one(db, AI())
    assert db.calls[-1][0] == "finish_document"
    assert len(db.calls[-1][1]["parts"][0]["embedding"]) == 1024

    class FailedAI:
        def embed(self, text):
            raise AIUnavailable("AI_FREE_LIMIT", "وقف", 503)

    db = Queue()
    with pytest.raises(AIUnavailable):
        process_one(db, FailedAI())
    assert db.calls[-1][0] == "fail_document"
    assert all(name != "finish_document" for name, _ in db.calls)


@pytest.mark.parametrize(
    "url",
    [
        "http://evil.example",
        "https://user:password@site.example",
        "https://site.example/path",
        "https://site.example?token=bad",
    ],
)
def test_invalid_supabase_base_url_rejected_without_values(url):
    with pytest.raises(ValidationError) as error:
        config(supabase_url=url)
    assert "password@" not in str(error.value)


def test_production_fails_without_complete_configuration():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, environment="production")


def test_gateway_masks_upstream_errors(monkeypatch, caplog):
    class Client:
        def __init__(self, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def request(self, *a, **k):
            return httpx.Response(403, json={"code": "42501", "message": "PRIVATE SQL AND SECRET"})

    monkeypatch.setattr("app.services.supabase.httpx.Client", Client)
    with pytest.raises(HTTPException) as exc:
        Supabase(config(), token="PRIVATEJWT").rows("documents")
    assert exc.value.status_code == 403
    assert "PRIVATE" not in caplog.text


def test_large_request_body_is_rejected_before_parsing_with_cors():
    app = create_app(config())
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/documents",
            content=b"x" * (6 * 1024 * 1024 + 1),
            headers={"Origin": "http://localhost:5173", "Content-Type": "application/octet-stream"},
        )
        assert response.status_code == 413
        assert response.json()["error"]["code"] == "BODY_TOO_LARGE"
        assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_successful_upload_failure_is_marked_failed_not_queued(monkeypatch):
    app, _ = member_app("company_admin")
    service = FakeDB()
    service.storage_path = lambda *a: "/storage/object"

    def fail(*a, **k):
        raise HTTPException(503, detail={"code": "UPSTREAM_ERROR", "message": "safe"})

    service.request = fail
    monkeypatch.setattr("app.api.product.trusted", lambda request: service)
    with TestClient(app) as client:
        assert (
            client.post(
                "/api/v1/documents",
                data={"title": "test"},
                files={"file": ("test.txt", b"valid text", "text/plain")},
            ).status_code
            == 503
        )
    assert service.calls[-1][0] == "mark_document_uploaded"
    assert service.calls[-1][1]["successful"] is False


def test_cached_request_cannot_be_reused_for_another_question():
    app, db = member_app()

    def rows(table, **kwargs):
        if kwargs.get("role") == "eq.assistant":
            return [
                {
                    "conversation_id": CONV,
                    "content": "prior",
                    "citations": [],
                    "response_status": "not_found",
                    "model": None,
                }
            ]
        return [{"content": "different question"}]

    db.rows = rows
    with TestClient(app) as client:
        assert (
            client.post(
                "/api/v1/assistant/ask",
                json={"question": "new question", "request_id": str(uuid4())},
            ).status_code
            == 409
        )
