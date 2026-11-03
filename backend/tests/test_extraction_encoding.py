"""Real subprocess regression checks under legacy Windows-style stream encoding."""

import json
import os
from pathlib import Path
import subprocess
import sys

import pytest

from app.services.processing import extract_parts

BACKEND = Path(__file__).resolve().parents[1]


def test_extractor_cli_emits_utf8_even_with_legacy_stdout():
    text = "نص عربي مع English MFA.\nإعداد VPN — الخطوة الأولى."
    result = subprocess.run(
        [sys.executable, "-X", "utf8=0", "-m", "app.services.extractor", "txt"],
        input=text.encode("utf-8"),
        capture_output=True,
        timeout=25,
        cwd=BACKEND,
        env={
            "PATH": os.environ.get("PATH", ""),
            "SYSTEMROOT": os.environ.get("SYSTEMROOT", ""),
            "PYTHONUTF8": "0",
            "PYTHONIOENCODING": "cp1252:replace",
        },
    )
    assert result.returncode == 0
    assert (
        json.loads(result.stdout.decode("utf-8", errors="strict"))["chunks"][0]["content"] == text
    )


@pytest.mark.parametrize("text", ["نص عربي مع English MFA.", "English VPN guide — دليل عربي."])
def test_extract_parts_forces_utf8_without_inheriting_parent_environment(monkeypatch, text):
    monkeypatch.setenv("PYTHONIOENCODING", "cp1252:replace")
    monkeypatch.setenv("PYTHONUTF8", "0")
    monkeypatch.setenv("MASAR_ENCODING_TEST_SECRET", "must-not-reach-extractor")
    run = subprocess.run
    calls = []

    def record(*args, **kwargs):
        calls.append(kwargs)
        return run(*args, **kwargs)

    monkeypatch.setattr("app.services.processing.subprocess.run", record)
    assert extract_parts(text.encode("utf-8"), "txt")[0]["content"] == text
    assert calls[0]["input"] == text.encode("utf-8")
    assert calls[0]["timeout"] == 25
    assert calls[0]["env"] == {
        "PATH": os.environ.get("PATH", ""),
        "SYSTEMROOT": os.environ.get("SYSTEMROOT", ""),
        "PYTHONUTF8": "1",
        "PYTHONIOENCODING": "utf-8:strict",
    }


def test_extract_parts_rejects_invalid_utf8_instead_of_replacing_characters(monkeypatch):
    monkeypatch.setattr(
        "app.services.processing.subprocess.run",
        lambda *args, **kwargs: subprocess.CompletedProcess(args[0], 0, stdout=b"\xff", stderr=b""),
    )
    with pytest.raises(ValueError, match="^EXTRACTION_FAILED$"):
        extract_parts(b"valid UTF-8 input", "txt")
