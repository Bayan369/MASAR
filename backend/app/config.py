"""Validated settings; Cloudflare credentials remain server-side and optional."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="MASAR_",
        env_file=Path(__file__).resolve().parents[1] / ".env",
        extra="ignore",
        hide_input_in_errors=True,
    )
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    supabase_service_key: SecretStr = SecretStr("")
    auth_redirect_url: str = "http://localhost:5173/reset-password"
    retrieval_mode: Literal["hybrid", "lexical"] = "hybrid"
    demo_enabled: bool = False
    max_upload_bytes: int = Field(default=5 * 1024 * 1024, ge=1, le=5 * 1024 * 1024)
    ai_call_budget: int = Field(default=20, ge=1, le=500)
    cloudflare_account_id: str = ""
    cloudflare_api_token: SecretStr = SecretStr("")
    cloudflare_model: str = "@cf/meta/llama-3.1-8b-instruct-fp8-fast"
    cloudflare_free_plan_confirmed: bool = False
    demo_requests_per_minute: int = Field(default=6, ge=1, le=60)
    demo_max_concurrent: int = Field(default=1, ge=1, le=4)
    demo_total_requests: int = Field(default=100, ge=0, le=10000)
    demo_max_ips: int = Field(default=10000, ge=1, le=100000)
    app_name: str = "MASAR"
    environment: Literal["development", "test", "production", "demo"] = "development"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    @model_validator(mode="after")
    def validate_production(self):
        from urllib.parse import urlparse

        if self.supabase_url:
            parsed = urlparse(self.supabase_url)
            local = parsed.hostname in {"127.0.0.1", "localhost", "host.docker.internal"}
            if (
                parsed.username
                or not parsed.hostname
                or parsed.password
                or parsed.query
                or parsed.fragment
                or parsed.path not in {"", "/"}
                or (
                    parsed.scheme != "https"
                    and not (local and self.environment != "production" and parsed.scheme == "http")
                )
            ):
                raise ValueError("Invalid Supabase base URL")
        redirect = urlparse(self.auth_redirect_url)
        if (
            not redirect.hostname
            or redirect.username
            or redirect.password
            or redirect.query
            or redirect.fragment
            or (
                redirect.scheme != "https"
                and not (
                    self.environment != "production"
                    and redirect.scheme == "http"
                    and redirect.hostname in {"localhost", "127.0.0.1"}
                )
            )
        ):
            raise ValueError("Invalid authentication redirect URL")
        if self.supabase_publishable_key and not self.supabase_publishable_key.startswith(
            "sb_publishable_"
        ):
            raise ValueError(
                "A public publishable key is required for Supabase browser/API settings"
            )
        if self.environment == "demo":
            import re

            from app.services.cloudflare import SUPPORTED_MODELS

            if not (
                self.demo_enabled
                and re.fullmatch(r"[0-9a-fA-F]{32}", self.cloudflare_account_id)
                and self.cloudflare_api_token.get_secret_value().strip()
                and self.cloudflare_free_plan_confirmed
                and self.cloudflare_model in SUPPORTED_MODELS
            ):
                raise ValueError("Demo requires explicit enablement and configured Workers Free AI")
            for origin in self.cors_origins:
                candidate = urlparse(origin)
                if not (
                    candidate.scheme == "https"
                    and candidate.hostname
                    and not candidate.username
                    and not candidate.password
                    and not candidate.query
                    and not candidate.fragment
                    and candidate.path == ""
                    and "*" not in origin
                ):
                    raise ValueError("Demo requires explicit HTTPS CORS origins")
            if not self.cors_origins:
                raise ValueError("Demo requires explicit HTTPS CORS origins")
        if self.environment == "production":
            if self.demo_enabled or not all(
                [
                    self.supabase_url,
                    self.supabase_publishable_key,
                    self.supabase_service_key.get_secret_value(),
                    self.cloudflare_account_id,
                    self.cloudflare_api_token.get_secret_value(),
                    self.cloudflare_free_plan_confirmed,
                ]
            ):
                raise ValueError(
                    "Production requires configured Supabase, Workers Free AI and demo disabled"
                )

            def valid_origin(origin):
                candidate = urlparse(origin)
                return (
                    candidate.scheme == "https"
                    and bool(candidate.hostname)
                    and not candidate.username
                    and not candidate.password
                    and not candidate.query
                    and not candidate.fragment
                    and candidate.path == ""
                    and "*" not in origin
                )

            if not self.cors_origins or not all(
                valid_origin(origin) for origin in self.cors_origins
            ):
                raise ValueError("Production requires explicit HTTPS CORS origins")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
