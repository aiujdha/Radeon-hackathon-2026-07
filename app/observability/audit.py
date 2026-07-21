from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


_RUN_ID_PATTERN = re.compile(r"^[a-f0-9]{32}$")


def validate_run_id(run_id: str) -> str:
    if not _RUN_ID_PATTERN.fullmatch(run_id):
        raise ValueError("run_id must be a 32-character lowercase hexadecimal identifier")
    return run_id


class AuditTrail:
    """Append JSONL events for one bounded application run."""

    def __init__(self, log_root: Path, run_id: str):
        self._run_id = validate_run_id(run_id)
        self._path = log_root / "runs" / f"{self._run_id}.jsonl"

    @property
    def path(self) -> Path:
        return self._path

    def write(self, event: str, payload: dict[str, Any] | None = None) -> None:
        record = {
            "timestamp": datetime.now(UTC).isoformat(),
            "run_id": self._run_id,
            "event": event,
            "payload": payload or {},
        }
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
