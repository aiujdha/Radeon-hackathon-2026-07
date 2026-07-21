from __future__ import annotations

from pathlib import Path

from pydantic import Field, HttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    project_root: Path = Path("/workspace/office-agent/data/projects")
    vector_db_root: Path = Path("/workspace/office-agent/data/vector_db")
    sqlite_path: Path = Path("/workspace/office-agent/data/sqlite/projectpack.db")
    output_root: Path = Path("/workspace/office-agent/outputs")
    log_root: Path = Path("/workspace/office-agent/logs")
    agent_max_steps: int = Field(default=8, ge=1, le=8)

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
