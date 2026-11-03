"""Temporary per-process demo limits. Run exactly one replica and one worker."""

from contextlib import contextmanager
from threading import Lock
from time import monotonic

from fastapi import HTTPException


class DemoLimits:
    def __init__(self, settings):
        self.settings = settings
        self.lock = Lock()
        self.windows = {}
        self.active = 0
        self.total = 0

    @contextmanager
    def admit(self, ip):
        if self.settings.environment != "demo":
            yield
            return
        with self.lock:
            now = monotonic()
            self.windows = {
                key: value for key, value in self.windows.items() if value[0] > now - 60
            }
            since, count = self.windows.get(ip, (now, 0))
            s = self.settings
            if (
                count >= s.demo_requests_per_minute
                or self.active >= s.demo_max_concurrent
                or (s.demo_total_requests and self.total >= s.demo_total_requests)
                or (ip not in self.windows and len(self.windows) >= s.demo_max_ips)
            ):
                raise HTTPException(
                    status_code=429,
                    headers={"Retry-After": "60"},
                    detail={
                        "code": "DEMO_LIMIT",
                        "message": "بلغت النسخة التجريبية حد الطلبات. حاول لاحقًا.",
                    },
                )
            self.windows[ip] = (since, count + 1)
            self.active += 1
            self.total += 1
        try:
            yield
        finally:
            with self.lock:
                self.active -= 1
