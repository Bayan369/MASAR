"""Hosting entrypoint: one process, dynamic PORT, no proxy trust by default."""

import os
import logging
from ipaddress import ip_network

import uvicorn


def server_options():
    port = int(os.environ.get("PORT", "8000"))
    if not 1 <= port <= 65535:
        raise ValueError("PORT must be between 1 and 65535")
    trusted = os.environ.get("MASAR_TRUSTED_PROXY_IPS", "").strip()
    if "*" in trusted:
        raise ValueError("Explicit proxy IPs/networks required; wildcard trust is forbidden")
    if trusted:
        for entry in trusted.split(","):
            ip_network(entry.strip(), strict=False)
    # Explicitly ignore WEB_CONCURRENCY: demo limits are local to one process.
    return {
        "host": "0.0.0.0",
        "port": port,
        "workers": 1,
        "proxy_headers": bool(trusted),
        "forwarded_allow_ips": trusted,
        "access_log": False,
        "limit_concurrency": 16,
        "timeout_keep_alive": 5,
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    uvicorn.run("app.main:app", **server_options())
