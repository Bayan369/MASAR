"""Local dotenv loading tests with temporary files; never read or print real secrets."""

from pathlib import Path

import pytest
from dotenv import dotenv_values

from app.config import Settings


def test_backend_env_path_is_absolute_not_current_working_directory(tmp_path, monkeypatch):
    configured = Settings.model_config["env_file"]
    monkeypatch.chdir(tmp_path)
    assert configured == Path(__file__).resolve().parents[1] / ".env"
    assert configured.is_absolute()


def test_backend_examples_have_unique_known_keys_and_conservative_defaults():
    file = Path(__file__).resolve().parents[1] / ".env.example"
    from dotenv.parser import parse_stream

    with file.open(encoding="utf-8-sig") as stream:
        bindings = list(parse_stream(stream))
    keys = [binding.key for binding in bindings if binding.key]
    assert len(keys) == len(set(keys))
    assert not any(binding.error for binding in bindings)
    known = {"MASAR_" + name.upper() for name in Settings.model_fields}
    assert set(keys) <= known
    values = dotenv_values(file)
    assert values["MASAR_ENVIRONMENT"] == "development"
    assert values["MASAR_DEMO_ENABLED"] == "false"
    assert not values["MASAR_CLOUDFLARE_ACCOUNT_ID"]
    assert not values["MASAR_CLOUDFLARE_API_TOKEN"]


@pytest.mark.parametrize("encoding", ["utf-8", "utf-8-sig"])
def test_windows_utf8_bom_and_arabic_values_load_without_losing_first_key(
    tmp_path, monkeypatch, encoding
):
    for key in ["MASAR_ENVIRONMENT", "MASAR_APP_NAME"]:
        monkeypatch.delenv(key, raising=False)
    file = tmp_path / ".env"
    file.write_text("MASAR_ENVIRONMENT=test\nMASAR_APP_NAME=مسار\n", encoding=encoding)
    settings = Settings(_env_file=file)
    assert settings.environment == "test" and settings.app_name == "مسار"


def test_shell_overrides_dotenv_and_explicit_init_overrides_shell(tmp_path, monkeypatch):
    file = tmp_path / ".env"
    file.write_text("MASAR_ENVIRONMENT=development\n", encoding="utf-8")
    monkeypatch.setenv("MASAR_ENVIRONMENT", "test")
    assert Settings(_env_file=file).environment == "test"
    assert Settings(_env_file=file, environment="development").environment == "development"


def test_duplicate_keys_use_last_assignment_without_merging_values(tmp_path, monkeypatch):
    monkeypatch.delenv("MASAR_ENVIRONMENT", raising=False)
    file = tmp_path / ".env"
    file.write_text("MASAR_ENVIRONMENT=production\nMASAR_ENVIRONMENT=test\n", encoding="utf-8")
    assert Settings(_env_file=file).environment == "test"


@pytest.mark.parametrize(
    "invalid",
    [
        "http://localhost:5173,http://127.0.0.1:5173",
        r'["http\://localhost:5173","http\://127.0.0.1:5173"]',
    ],
)
def test_cors_origins_require_valid_json_without_invalid_escape(tmp_path, monkeypatch, invalid):
    monkeypatch.delenv("MASAR_CORS_ORIGINS", raising=False)
    file = tmp_path / ".env"
    file.write_text('MASAR_CORS_ORIGINS=["http://localhost:5173"]\n', encoding="utf-8")
    assert Settings(_env_file=file).cors_origins == ["http://localhost:5173"]
    file.write_text("MASAR_CORS_ORIGINS=" + invalid + "\n", encoding="utf-8")
    with pytest.raises(ValueError):
        Settings(_env_file=file)
