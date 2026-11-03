"""Byte-level encoding checks; synthetic model fixtures are not live inference."""

import gzip
import json

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services.cloudflare import read_json_response
from test_assistant import StubLlama
from test_cloudflare_transport import Reply


def test_demo_json_bytes_answer_and_sources_remain_utf8():
    app = create_app(Settings(_env_file=None, demo_enabled=True))
    app.state.ai_provider = StubLlama()
    with TestClient(app) as client:
        response = client.post("/api/v1/demo/ask", json={"question": "ما هي سياسة الإجازات؟"})
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json; charset=utf-8"
        decoded = json.loads(response.content.decode("utf-8", errors="strict"))
        assert decoded == response.json()
        assert decoded["answer"] == "الإجازة السنوية في الشركة التجريبية 21 يوم عمل."
        assert decoded["answer"].encode("utf-8") in response.content
        for source in decoded["sources"]:
            assert source["quote"] in source["excerpt"]
            assert source["quote"].encode("utf-8") in response.content
            assert any("\u0600" <= ch <= "\u06ff" for ch in source["quote"])
        # Reproduce the reported symptom without modifying application data.
        incorrectly_decoded = json.loads(response.content.decode("latin-1"))
        assert "Ø" in incorrectly_decoded["answer"] or "Ù" in incorrectly_decoded["answer"]
        error = client.post("/api/v1/demo/ask", json={})
        assert error.status_code == 422
        assert error.headers["content-type"] == "application/json; charset=utf-8"
        assert "تحقق" in json.loads(error.content.decode("utf-8"))["error"]["message"]
        assert (
            client.get("/api/v1/health").headers["content-type"]
            == "application/json; charset=utf-8"
        )


@pytest.mark.parametrize("compressed", [False, True])
def test_cloudflare_utf8_decoding_ignores_misleading_legacy_charset(compressed):
    content = {"success": True, "result": {"response": "إجابة عربية — الإجازة السنوية"}}
    body = json.dumps(content, ensure_ascii=False).encode("utf-8")
    response = Reply(
        gzip.compress(body) if compressed else body,
        encoding="gzip" if compressed else None,
        content_type="application/json; charset=iso-8859-1",
    )
    assert read_json_response(response)[0] == content
