"""Explicit opt-in for ONE real inference through the running local backend.

No credentials are read/printed here. Configure backend/.env and actual Workers
Free before use. No retries, paid fallback, account setup or billing changes.
"""

import argparse
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--allow-live-inference", action="store_true")
args = parser.parse_args()
if not args.allow_live_inference:
    parser.error("Requires --allow-live-inference; consumes one real Workers AI inference.")


def ask(question):
    request = Request(
        "http://127.0.0.1:8000/api/v1/demo/ask",
        data=json.dumps({"question": question}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=45) as response:
            return json.load(response)
    except HTTPError as error:
        try:
            code = json.load(error).get("error", {}).get("code", "HTTP_ERROR")
        except (ValueError, AttributeError):
            code = "HTTP_ERROR"
        raise SystemExit(
            f"STOP: local API HTTP {error.code}; code={code}. No retry performed."
        ) from None
    except URLError:
        raise SystemExit("STOP: cannot connect to local backend. No retry performed.") from None


unsupported = ask("quantum banana spaceship")
assert unsupported["status"] == "not_found" and unsupported["generated_by"] is None
print("PASS: unsupported question refused without inference.")
result = ask("كم يوم الإجازة السنوية في الشركة التجريبية؟")
if result["status"] != "answered" or result["generated_by"] != "Cloudflare Workers AI / Llama":
    raise SystemExit("STOP: no validated live answer received. No retry performed.")
assert result["demo"] is True
assert any(
    source["document_id"] == "leave-policy" and source["quote"] in source["excerpt"]
    for source in result["sources"]
)
print("PASS: real backend reports a validated Llama answer with Leave Policy evidence.")
print("Model:", result["model"])
print("Answer:", result["answer"])
print("Sources:", ", ".join(source["title"] for source in result["sources"]))
