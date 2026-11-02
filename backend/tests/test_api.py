from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

client = TestClient(create_app())


def test_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "masar-api", "version": "0.1.0"}


def test_auth_never_creates_session():
    response = client.post("/api/v1/auth/login")
    assert response.status_code == 501
    assert response.json()["error"]["code"] == "AUTH_NOT_CONFIGURED"
    assert "set-cookie" not in response.headers


def test_unknown_route_has_safe_error():
    response = client.get("/missing")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "HTTP_ERROR"


def test_cors_allows_only_configured_origin():
    assert (
        client.get("/api/v1/health", headers={"Origin": "http://localhost:5173"}).headers[
            "access-control-allow-origin"
        ]
        == "http://localhost:5173"
    )
    assert (
        "access-control-allow-origin"
        not in client.get("/api/v1/health", headers={"Origin": "https://unknown.example"}).headers
    )


def test_environment_configuration(monkeypatch):
    monkeypatch.setenv("MASAR_APP_NAME", "MASAR Test")
    assert Settings(_env_file=None).app_name == "MASAR Test"


def test_unexpected_errors_do_not_expose_details():
    app = create_app()

    @app.get("/test-failure")
    def failure():
        raise RuntimeError("private-internal-detail")

    with TestClient(app, raise_server_exceptions=False) as local:
        response = local.get("/test-failure")
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "private-internal-detail" not in response.text
