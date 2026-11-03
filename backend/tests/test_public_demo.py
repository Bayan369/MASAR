"""Offline tests. Mocked Cloudflare calls do not prove live Llama connectivity."""

from concurrent.futures import ThreadPoolExecutor
from threading import Event

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.main import create_app
from app.services.cloudflare import AIUnavailable
from app.services.retrieval import passages
from scripts.start_server import server_options


def demo_settings(**kwargs):
    return Settings(
        _env_file=None,
        **{
            "environment": "demo",
            "retrieval_mode": "lexical",
            "demo_enabled": True,
            "cloudflare_account_id": "a" * 32,
            "cloudflare_api_token": "server-test-only",
            "cloudflare_free_plan_confirmed": True,
            "cors_origins": ["https://masar-test.vercel.app"],
            **kwargs,
        },
    )


def test_demo_explicit_and_production_unchanged():
    assert not Settings(_env_file=None).demo_enabled
    for kwargs in [
        dict(demo_enabled=False),
        dict(cloudflare_api_token=""),
        dict(cors_origins=["*"]),
        dict(cors_origins=[]),
    ]:
        with pytest.raises(ValidationError):
            demo_settings(**kwargs)
    with pytest.raises(ValidationError):
        demo_settings(environment="production")
    app = create_app(demo_settings())
    paths = set(app.openapi()["paths"])
    assert "/api/v1/demo/ask" in paths
    assert "/api/v1/assistant/ask" not in paths
    assert "/api/v1/me" not in paths


def test_health_readiness_cors_without_auth_or_external_calls():
    app = create_app(demo_settings())

    class Uncalled:
        _halted = False

        def generate(self, *_):
            raise AssertionError("Health must not call Llama")

    app.state.ai_provider = Uncalled()
    with TestClient(app) as client:
        assert client.get("/api/v1/health").status_code == 200
        assert client.get("/api/v1/ready").status_code == 200
        assert len(passages()) == 12
        for origin, expected in [
            ("https://masar-test.vercel.app", 200),
            ("https://other.example", 400),
        ]:
            response = client.options(
                "/api/v1/demo/ask",
                headers={"Origin": origin, "Access-Control-Request-Method": "POST"},
            )
            assert response.status_code == expected
        app.state.ai_provider._halted = True
        assert client.get("/api/v1/ready").status_code == 503


def test_llama_failure_no_mock_and_ip_limit_ignores_forwarded_header(caplog):
    app = create_app(demo_settings(demo_requests_per_minute=1))

    class Failed:
        def generate(self, *_):
            raise AIUnavailable("AI_NOT_CONFIGURED", "خدمة Llama غير متاحة.")

    app.state.ai_provider = Failed()
    with TestClient(app) as client:
        response = client.post("/api/v1/demo/ask", json={"question": "كم مدة الإجازة السنوية؟"})
        assert response.status_code == 503
        assert "answer" not in response.json()
        assert "Llama" in response.json()["error"]["message"]
        response = client.post(
            "/api/v1/demo/ask",
            json={"question": "كم مدة الإجازة السنوية؟"},
            headers={"X-Forwarded-For": "203.0.113.42"},
        )
        assert response.status_code == 429
        assert response.headers["retry-after"] == "60"
        assert client.get("/api/v1/health").status_code == 200
    assert "server-test-only" not in caplog.text
    assert "a" * 32 not in caplog.text


def test_concurrent_limit_and_release_after_failure():
    app = create_app(demo_settings(demo_max_concurrent=1))
    entered, release = Event(), Event()

    class Blocking:
        def generate(self, *_):
            entered.set()
            assert release.wait(5)
            raise AIUnavailable("AI_BUSY", "خدمة Llama مشغولة.")

    app.state.ai_provider = Blocking()
    with TestClient(app) as client, ThreadPoolExecutor(1) as pool:
        pending = pool.submit(
            client.post, "/api/v1/demo/ask", json={"question": "كم مدة الإجازة السنوية؟"}
        )
        try:
            assert entered.wait(5)
            response = client.post("/api/v1/demo/ask", json={"question": "كم مدة الإجازة السنوية؟"})
            assert response.status_code == 429
        finally:
            release.set()
        assert pending.result().status_code == 503
        assert app.state.demo_limits.active == 0


def test_total_limit_and_dynamic_port(monkeypatch):
    from app.services.demo_limits import DemoLimits
    from fastapi import HTTPException

    limits = DemoLimits(demo_settings(demo_total_requests=1))
    with limits.admit("one"):
        pass
    with pytest.raises(HTTPException) as exc:
        with limits.admit("two"):
            pass
    assert exc.value.status_code == 429
    monkeypatch.delenv("PORT", raising=False)
    monkeypatch.delenv("MASAR_TRUSTED_PROXY_IPS", raising=False)
    assert server_options()["port"] == 8000
    assert server_options()["proxy_headers"] is False
    monkeypatch.setenv("PORT", "8123")
    monkeypatch.setenv("WEB_CONCURRENCY", "4")
    assert server_options()["port"] == 8123
    assert server_options()["host"] == "0.0.0.0"
    assert server_options()["workers"] == 1
    monkeypatch.setenv("MASAR_TRUSTED_PROXY_IPS", "*")
    with pytest.raises(ValueError):
        server_options()


def test_demo_answer_has_llama_provenance_and_exact_local_source():
    import json

    app = create_app(demo_settings())

    class SyntheticLlama:
        settings = demo_settings()

        def generate(self, system, question):
            # Synthetic output for contract testing, never a live-inference claim.
            context = json.loads(system.split("DOCUMENT CONTEXT:\n")[1])
            for source in context:
                for evidence in source["evidence"]:
                    if "21" in evidence["text"]:
                        return json.dumps(
                            {
                                "supported": True,
                                "answer": "الإجازة السنوية 21 يوم عمل.",
                                "citations": [
                                    {
                                        "source_id": source["source_id"],
                                        "evidence_ids": [evidence["evidence_id"]],
                                    }
                                ],
                            }
                        )
            raise AssertionError("Expected annual leave evidence")

    app.state.ai_provider = SyntheticLlama()
    with TestClient(app) as client:
        response = client.post("/api/v1/demo/ask", json={"question": "كم مدة الإجازة السنوية؟"})
        assert response.status_code == 200
        answer = response.json()
        assert answer["generated_by"] == "Cloudflare Workers AI / Llama"
        assert answer["sources"]
        for source in answer["sources"]:
            assert any(source["quote"] in p.text for p in passages())
