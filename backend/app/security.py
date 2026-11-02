"""Bound request bodies before multipart parsing; no content logging."""

import asyncio
import json
from time import monotonic


class BodyLimit:
    def __init__(self, app, limit=6 * 1024 * 1024):
        self.app, self.limit = app, limit

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        parts = []
        total = 0
        deadline = monotonic() + 30
        try:
            while True:
                remaining = deadline - monotonic()
                if remaining <= 0:
                    raise TimeoutError()
                message = await asyncio.wait_for(receive(), timeout=min(10, remaining))
                if message["type"] == "http.disconnect":
                    return
                body = message.get("body", b"")
                total += len(body)
                if total > self.limit:
                    status = 413
                    code = "BODY_TOO_LARGE"
                    break
                parts.append(body)
                if not message.get("more_body"):
                    status = 0
                    break
        except TimeoutError:
            status = 408
            code = "REQUEST_TIMEOUT"
        if status:
            data = json.dumps(
                {"error": {"code": code, "message": "حجم الطلب كبير أو انتهت مهلته."}},
                ensure_ascii=False,
            ).encode()
            await send(
                {
                    "type": "http.response.start",
                    "status": status,
                    "headers": [(b"content-type", b"application/json; charset=utf-8")],
                }
            )
            return await send({"type": "http.response.body", "body": data})
        sent = False

        async def replay():
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": b"".join(parts), "more_body": False}
            return await receive()

        await self.app(scope, replay, send)
