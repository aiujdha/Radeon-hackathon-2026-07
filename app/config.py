from __future__ import annotations

from pathlib import Path

from pydantic import Field, HttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables or `.env`."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    llm_base_url: HttpUrl = "http://127.0.0.1:8000/v1"
    embedding_base_url: HttpUrl = "http://127.0.0.1:8080/v1"
    llm_api_key: str = Field(default="local-no-key", min_length=1)
    llm_model: str = Field(default="qwen3.6-office-agent", min_length=1)
    llm_timeout_seconds: float = Field(default=15, gt=0, le=120)

    api_host: str = Field(default="127.0.0.1", min_length=1)
    api_port: int = Field(default=9000, ge=1, le=65535)

    project_root: Path = Field(
        default_factory=lambda: _BASE_DIR / "office-agent" / "data" / "projects"
    )
    vector_db_root: Path = Field(
        default_factory=lambda: _BASE_DIR / "office-agent" / "data" / "vector_db"
    )
    sqlite_path: Path = Field(
        default_factory=lambda: _BASE_DIR / "office-agent" / "data" / "sqlite" / "projectpack.db"
    )
    output_root: Path = Field(
        default_factory=lambda: _BASE_DIR / "office-agent" / "outputs"
    )
    log_root: Path = Field(
        default_factory=lambda: _BASE_DIR / "office-agent" / "logs"
    )
    agent_max_steps: int = Field(default=8, ge=1, le=8)

    # ------------------------------------------------------------------
    # Stage E — File upload hardening
    # ------------------------------------------------------------------
    max_upload_size_mb: int = Field(default=50, ge=1, le=1024)
    max_upload_filename_length: int = Field(default=255, ge=32, le=1024)
    virus_scan_enabled: bool = Field(default=False)
    virus_scan_command: list[str] = Field(default_factory=lambda: ["clamdscan", "--fdpass"])

    # ------------------------------------------------------------------
    # Stage E — Cleanup retention
    # ------------------------------------------------------------------
    cleanup_smoke_project_days: int = Field(default=1, ge=0, le=365)
    cleanup_temp_upload_days: int = Field(default=7, ge=0, le=365)
    cleanup_old_index_days: int = Field(default=30, ge=0, le=365)
    cleanup_cron_interval_minutes: int = Field(default=60, ge=1, le=1440)
    cleanup_enabled: bool = Field(default=True)

    # ------------------------------------------------------------------
    # Stage E — Run lifecycle
    # ------------------------------------------------------------------
    run_max_retries: int = Field(default=3, ge=0, le=10)
    run_timeout_seconds: int = Field(default=600, ge=30, le=7200)

    # Stage I: stable server-side key for encrypted third-party credentials.
    # It is optional at application start because integrations may be unused;
    # TokenManager refuses credential storage until it is configured.
    integration_encryption_key: str | None = Field(default=None, min_length=32)

    @field_validator("llm_base_url", "embedding_base_url")
    @classmethod
    def require_openai_v1_endpoint(cls, value: HttpUrl) -> HttpUrl:
        if not str(value).rstrip("/").endswith("/v1"):
            raise ValueError("OpenAI-compatible base URL must end with /v1")
        return value

    def required_directories(self) -> tuple[Path, ...]:
        return (
            self.project_root,
            self.vector_db_root,
            self.sqlite_path.parent,
            self.output_root,
            self.log_root,
        )

    @property
    def max_upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024
