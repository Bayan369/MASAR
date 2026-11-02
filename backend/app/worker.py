"""Run one persistent document worker. Provider failures require operator review."""

import logging
from app.config import get_settings
from app.services.processing import run_worker

if __name__ == "__main__":
    try:
        run_worker(get_settings())
    except KeyboardInterrupt:
        pass
    except Exception as exc:
        # Exceptions can contain credentials or upstream data: log type only.
        logging.getLogger(__name__).error("worker_stopped category=%s", type(exc).__name__)
        raise SystemExit(1) from None
