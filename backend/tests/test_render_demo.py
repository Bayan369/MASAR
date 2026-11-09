"""Real Demo route contracts, offline provider fixture; no live Llama claim."""

from fastapi.testclient import TestClient
from app.main import create_app
from test_public_demo import demo_settings
from test_assistant import StubLlama


def test_render_demo_answer_sources_and_original_document_are_consistent():
    app = create_app(demo_settings(cors_origins=["https://masar.example"]))
    app.state.ai_provider = StubLlama()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/demo/ask",
            json={"question": "ما هي سياسة الإجازات؟"},
            headers={"Origin": "https://masar.example"},
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "https://masar.example"
        answer = response.json()
        assert answer["status"] == "answered"
        for source in answer["sources"]:
            path = source["url"].replace("/api/demo/", "/api/v1/demo/", 1)
            original = client.get(path)
            assert original.status_code == 200
            assert "text/plain" in original.headers["content-type"]
            assert source["quote"] in original.text
            assert source["section"] in original.text


def test_render_demo_does_not_register_company_or_processing_routes():
    app = create_app(demo_settings())
    assert set(app.openapi()["paths"]) == {
        "/api/v1/health",
        "/api/v1/ready",
        "/api/v1/demo/ask",
        "/api/v1/demo/documents",
        "/api/v1/demo/documents/{document_id}",
    }
    with TestClient(app) as client:
        for path in [
            "/api/v1/documents",
            "/api/v1/me",
            "/api/v1/departments",
            "/api/v1/assistant/ask",
        ]:
            assert client.get(path).status_code == 404
        assert (
            client.post("/api/v1/documents", files={"file": ("test.txt", b"offline")}).status_code
            == 404
        )
        assert client.get("/api/v1/demo/documents/not-a-packaged-document").status_code == 404
        assert client.get("/api/v1/health").status_code == 200
