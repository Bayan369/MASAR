"""Command modules must be importable independently of cwd and pytest entrypoint."""

import subprocess
import sys


def test_installed_command_modules_import_outside_backend(tmp_path):
    # -I excludes the current directory and PYTHONPATH: test installed packaging,
    # not an accidental import supplied by `python -m pytest`.
    result = subprocess.run(
        [
            sys.executable,
            "-I",
            "-c",
            "from scripts.start_server import server_options; "
            "from scripts import evaluate_semantic; "
            "assert callable(server_options); assert callable(evaluate_semantic.main)",
        ],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout == ""
