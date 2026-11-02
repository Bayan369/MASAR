import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from time import sleep

from app.services.cloudflare import AIUnavailable, CloudflareProvider
from app.services.supabase import Supabase

KINDS = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
}


def extract_parts(data: bytes, kind: str) -> list[dict]:
    try:
        result = subprocess.run(
            [sys.executable, "-m", "app.services.extractor", kind],
            input=data,
            capture_output=True,
            timeout=25,
            cwd=Path(__file__).resolve().parents[2],
            env={
                "PATH": os.environ.get("PATH", ""),
                "SYSTEMROOT": os.environ.get("SYSTEMROOT", ""),
            },
        )
        payload = json.loads(result.stdout)
    except (subprocess.TimeoutExpired, ValueError, OSError):
        raise ValueError("EXTRACTION_FAILED") from None
    if result.returncode or "error" in payload:
        raise ValueError(payload.get("error", "EXTRACTION_FAILED"))
    return payload["chunks"]


def process_one(db: Supabase, ai: CloudflareProvider) -> bool:
    jobs = db.rpc("claim_document", {})
    if not jobs:
        return False
    job = jobs[0]
    lease = job["processing_token"]
    try:
        data = db.request(
            "GET", db.storage_path(job["storage_bucket"], job["storage_path"]), raw=True
        )
        if len(data) > 5 * 1024 * 1024 or (
            job.get("content_sha256") and hashlib.sha256(data).hexdigest() != job["content_sha256"]
        ):
            raise ValueError("CONTENT_INTEGRITY_FAILED")
        parts = extract_parts(data, KINDS[job["mime_type"]])
        for start in range(0, len(parts), 8):
            vectors = ai.embed([p["content"] for p in parts[start : start + 8]])
            for part, vector in zip(parts[start : start + 8], vectors):
                part["embedding"] = vector
        db.rpc("finish_document", {"document_id": job["id"], "lease": lease, "parts": parts})
    except AIUnavailable as exc:
        db.rpc("fail_document", {"document_id": job["id"], "lease": lease, "error_code": exc.code})
        raise  # Stop worker on provider failure; no paid/automatic retry.
    except ValueError as exc:
        allowed = {
            "FILE_SIZE",
            "INVALID_TEXT",
            "INVALID_PDF",
            "PDF_LIMIT_OR_ENCRYPTED",
            "TEXT_LIMIT",
            "ARCHIVE_LIMIT",
            "UNSAFE_ARCHIVE",
            "UNSAFE_XML",
            "INVALID_DOCX",
            "UNSUPPORTED_TYPE",
            "EMPTY_OR_SCANNED_DOCUMENT",
            "CHUNK_LIMIT",
            "EXTRACTION_FAILED",
            "CONTENT_INTEGRITY_FAILED",
        }
        code = str(exc) if str(exc) in allowed else "PROCESSING_FAILED"
        db.rpc("fail_document", {"document_id": job["id"], "lease": lease, "error_code": code})
    except Exception:
        db.rpc(
            "fail_document",
            {"document_id": job["id"], "lease": lease, "error_code": "PROCESSING_FAILED"},
        )
    return True


def run_worker(settings):
    db = Supabase(settings, trusted=True)
    ai = CloudflareProvider(settings)
    while True:
        if not process_one(db, ai):
            sleep(3)
