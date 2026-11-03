"""Declare the encoding already used by JSON serializers; never transform content."""


class UTF8JSONHeaders:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        async def send_utf8(message):
            if message["type"] == "http.response.start":
                headers = []
                for name, value in message.get("headers", []):
                    media = value.split(b";", 1)[0].strip().lower()
                    if (
                        name.lower() == b"content-type"
                        and (media == b"application/json" or media.endswith(b"+json"))
                        and b"charset=" not in value.lower()
                    ):
                        value += b"; charset=utf-8"
                    headers.append((name, value))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_utf8)
