"""Local browser test host. Actual Demo routers; every external AI call is blocked.

Never use this entrypoint for hosting. It produces no successful model answers.
"""

from app.config import Settings
from app.main import create_app
from app.services.cloudflare import AIUnavailable


class NoExternalAI:
    _halted = False

    def generate(self, *_):
        raise AIUnavailable("AI_NOT_CONFIGURED", "اتصال AI معطل في اختبار النقل المحلي.")

    def embed(self, *_):
        raise AIUnavailable("AI_NOT_CONFIGURED", "اتصال AI معطل في اختبار النقل المحلي.")


# Only this loopback test host overrides HTTPS CORS after validated Demo setup.
# Production still requires exact HTTPS origins; no runtime code is changed.
app = create_app(
    Settings(
        _env_file=None,
        environment="demo",
        demo_enabled=True,
        cloudflare_account_id="a" * 32,
        cloudflare_api_token="offline-test-only",
        cloudflare_free_plan_confirmed=True,
        cors_origins=["https://masar.example"],
    ).model_copy(update={"cors_origins": ["http://127.0.0.1:5178"]})
)
app.state.ai_provider = NoExternalAI()
