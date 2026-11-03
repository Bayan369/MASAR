"""Untrusted document extraction in a bounded subprocess, never in the API process."""

from io import BytesIO
import json
import re
import sys
import zipfile
from xml.etree import ElementTree

MAX_CHARS = 100_000
MAX_BYTES = 5 * 1024 * 1024


def extract(data: bytes, kind: str) -> list[dict]:
    if not data or len(data) > MAX_BYTES:
        raise ValueError("FILE_SIZE")
    if kind == "txt":
        text = data.decode("utf-8-sig", errors="strict")
        if "\x00" in text:
            raise ValueError("INVALID_TEXT")
        pages = [{"page_number": None, "text": text}]
    elif kind == "pdf":
        if not data.startswith(b"%PDF-"):
            raise ValueError("INVALID_PDF")
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(data), strict=True)
        if reader.is_encrypted or not 1 <= len(reader.pages) <= 100:
            raise ValueError("PDF_LIMIT_OR_ENCRYPTED")
        pages = []
        size = 0
        for number, page in enumerate(reader.pages, 1):
            text = page.extract_text() or ""
            size += len(text)
            if size > MAX_CHARS:
                raise ValueError("TEXT_LIMIT")
            pages.append({"page_number": number, "text": text})
    elif kind == "docx":
        with zipfile.ZipFile(BytesIO(data)) as archive:
            infos = archive.infolist()
            if len(infos) > 1000 or sum(i.file_size for i in infos) > 20 * 1024 * 1024:
                raise ValueError("ARCHIVE_LIMIT")
            if any(
                i.flag_bits & 1 or ".." in i.filename.split("/") or i.filename.startswith("/")
                for i in infos
            ):
                raise ValueError("UNSAFE_ARCHIVE")
            if "word/document.xml" not in archive.namelist():
                raise ValueError("INVALID_DOCX")
            xml = archive.read("word/document.xml")
            if b"<!DOCTYPE" in xml.upper() or b"<!ENTITY" in xml.upper():
                raise ValueError("UNSAFE_XML")
            root = ElementTree.fromstring(xml)
            namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            text = "\n".join("".join(node.itertext()) for node in root.findall(".//w:p", namespace))
            pages = [{"page_number": None, "text": text}]
    else:
        raise ValueError("UNSUPPORTED_TYPE")
    if sum(len(p["text"]) for p in pages) > MAX_CHARS:
        raise ValueError("TEXT_LIMIT")
    if not any(p["text"].strip() for p in pages):
        raise ValueError("EMPTY_OR_SCANNED_DOCUMENT")
    return pages


def chunks(pages: list[dict]) -> list[dict]:
    result = []
    for page in pages:
        text = page["text"].replace("\r\n", "\n").replace("\r", "\n")
        start = 0
        while start < len(text):
            end = min(start + 1800, len(text))
            if end < len(text):
                boundary = max(
                    text.rfind("\n", start + 900, end), text.rfind(" ", start + 900, end)
                )
                if boundary > start:
                    end = boundary
            content = text[start:end].strip()
            if content:
                result.append(
                    {
                        "chunk_index": len(result),
                        "page_number": page["page_number"],
                        "section_title": None,
                        "content": content,
                    }
                )
            start = end
            while start < len(text) and text[start].isspace():
                start += 1
            if len(result) > 80:
                raise ValueError("CHUNK_LIMIT")
    if not result:
        raise ValueError("EMPTY_OR_SCANNED_DOCUMENT")
    return result


def write_result(payload: dict) -> None:
    """Use a UTF-8 wire format even when the console/locale uses another codec."""
    sys.stdout.buffer.write(
        json.dumps(payload, ensure_ascii=False).encode("utf-8", errors="strict") + b"\n"
    )
    sys.stdout.buffer.flush()


if __name__ == "__main__":
    try:
        try:
            import resource

            resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
            resource.setrlimit(resource.RLIMIT_CPU, (15, 15))
        except ImportError:
            pass  # Parent still enforces wall-time/size on Windows.
        parts = chunks(extract(sys.stdin.buffer.read(MAX_BYTES + 1), sys.argv[1]))
        write_result({"chunks": parts})
    except Exception as exc:
        code = (
            str(exc)
            if isinstance(exc, (ValueError, UnicodeError)) and re.fullmatch("[A-Z_]+", str(exc))
            else "EXTRACTION_FAILED"
        )
        write_result({"error": code})
        raise SystemExit(1)
