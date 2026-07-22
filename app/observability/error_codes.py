"""Unified error codes for the Office Agent API (Stage E).

Every public API endpoint returns a structured error containing an
``error_code`` enum member.  All codes are defined here so the frontend can
rely on stable identifiers.
"""

from __future__ import annotations

APP_ERROR_CODES: dict[str, dict[str, str]] = {
    # ------------------------------------------------------------------
    # Generic
    # ------------------------------------------------------------------
    "INTERNAL_ERROR": {
        "code": "INTERNAL_ERROR",
        "message": "An internal server error occurred.",
        "user_message": "服务内部错误，请稍后重试。",
    },
    "NOT_FOUND": {
        "code": "NOT_FOUND",
        "message": "The requested resource was not found.",
        "user_message": "请求的资源不存在。",
    },
    # ------------------------------------------------------------------
    # Project
    # ------------------------------------------------------------------
    "PROJECT_NOT_FOUND": {
        "code": "PROJECT_NOT_FOUND",
        "message": "Project does not exist.",
        "user_message": "项目不存在。",
    },
    "PROJECT_ID_INVALID": {
        "code": "PROJECT_ID_INVALID",
        "message": "Project ID format is invalid.",
        "user_message": "项目 ID 格式无效，请使用小写字母、数字和连字符。",
    },
    "PROJECT_ALREADY_EXISTS": {
        "code": "PROJECT_ALREADY_EXISTS",
        "message": "A project with that ID already exists.",
        "user_message": "该 ID 的项目已存在。",
    },
    # ------------------------------------------------------------------
    # Run
    # ------------------------------------------------------------------
    "RUN_NOT_FOUND": {
        "code": "RUN_NOT_FOUND",
        "message": "Run does not exist.",
        "user_message": "运行记录不存在。",
    },
    "RUN_ALREADY_EXECUTED": {
        "code": "RUN_ALREADY_EXECUTED",
        "message": "Run already executed; cannot execute again.",
        "user_message": "该运行记录已执行，不能重复执行。",
    },
    "RUN_ALREADY_CANCELLED": {
        "code": "RUN_ALREADY_CANCELLED",
        "message": "Run has already been cancelled.",
        "user_message": "该运行记录已被取消。",
    },
    "RUN_CANCEL_TOO_LATE": {
        "code": "RUN_CANCEL_TOO_LATE",
        "message": "Cannot cancel a run that has already completed or failed.",
        "user_message": "无法取消已完成或失败的运行。",
    },
    "RUN_WRONG_STATUS": {
        "code": "RUN_WRONG_STATUS",
        "message": "Run is not in a valid state for this operation.",
        "user_message": "运行状态不允许此操作。",
    },
    # ------------------------------------------------------------------
    # File upload
    # ------------------------------------------------------------------
    "FILE_TOO_LARGE": {
        "code": "FILE_TOO_LARGE",
        "message": "Uploaded file exceeds the maximum allowed size.",
        "user_message": "上传文件超过大小限制。",
    },
    "FILE_EXTENSION_NOT_ALLOWED": {
        "code": "FILE_EXTENSION_NOT_ALLOWED",
        "message": "File extension is not in the allowed list.",
        "user_message": "不支持的文件类型。",
    },
    "FILE_MIME_MISMATCH": {
        "code": "FILE_MIME_MISMATCH",
        "message": "File MIME type does not match its extension.",
        "user_message": "文件类型与扩展名不匹配。",
    },
    "FILE_NAME_TOO_LONG": {
        "code": "FILE_NAME_TOO_LONG",
        "message": "Filename exceeds the maximum allowed length.",
        "user_message": "文件名过长。",
    },
    "FILE_EMPTY": {
        "code": "FILE_EMPTY",
        "message": "Uploaded file is empty (zero bytes).",
        "user_message": "上传文件为空。",
    },
    "FILE_VIRUS_DETECTED": {
        "code": "FILE_VIRUS_DETECTED",
        "message": "Virus scan detected a potential threat.",
        "user_message": "文件病毒扫描未通过。",
    },
    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------
    "VALIDATION_ERROR": {
        "code": "VALIDATION_ERROR",
        "message": "Request validation failed.",
        "user_message": "请求参数校验失败。",
    },
    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------
    "CLEANUP_PARTIAL_FAILURE": {
        "code": "CLEANUP_PARTIAL_FAILURE",
        "message": "Cleanup completed with some errors.",
        "user_message": "清理任务部分失败。",
    },
    # ------------------------------------------------------------------
    # Phase F — Task lifecycle
    # ------------------------------------------------------------------
    "TASK_NOT_FOUND": {
        "code": "TASK_NOT_FOUND",
        "message": "Task does not exist.",
        "user_message": "任务不存在。",
    },
    "TASK_INVALID_TRANSITION": {
        "code": "TASK_INVALID_TRANSITION",
        "message": "Invalid task status transition.",
        "user_message": "无效的任务状态变更。",
    },
    "TASK_CANCELLED_FINAL": {
        "code": "TASK_CANCELLED_FINAL",
        "message": "A cancelled task cannot be reactivated.",
        "user_message": "已取消的任务无法重新激活。",
    },
    "CONFIRMATION_NOT_FOUND": {
        "code": "CONFIRMATION_NOT_FOUND",
        "message": "Confirmation request not found.",
        "user_message": "确认请求不存在。",
    },
    "CONFIRMATION_ALREADY_PROCESSED": {
        "code": "CONFIRMATION_ALREADY_PROCESSED",
        "message": "Confirmation request already processed.",
        "user_message": "该确认请求已被处理。",
    },
    "IMPORT_FILE_UNSUPPORTED": {
        "code": "IMPORT_FILE_UNSUPPORTED",
        "message": "Unsupported file format for import. Only CSV and XLSX are supported.",
        "user_message": "不支持的文件格式，仅支持 CSV 和 XLSX。",
    },
    "IMPORT_PARSE_ERROR": {
        "code": "IMPORT_PARSE_ERROR",
        "message": "Failed to parse the import file.",
        "user_message": "文件解析失败，请检查文件格式。",
    },
    "TASK_ALREADY_EXISTS": {
        "code": "TASK_ALREADY_EXISTS",
        "message": "A task with this ID already exists.",
        "user_message": "该 ID 的任务已存在。",
    },
}


def get_error(code: str, **detail_kvs: str) -> dict[str, str]:
    """Return a structured error dict for the given error code.

    Args:
        code: An ``APP_ERROR_CODES`` key (e.g. ``"FILE_TOO_LARGE"``).
        **detail_kvs: Extra key/value pairs merged into ``details``.

    Returns:
        A dict with ``error_code``, ``message``, ``user_message``, and
        optional ``details``.
    """
    entry = APP_ERROR_CODES.get(code, APP_ERROR_CODES["INTERNAL_ERROR"])
    result: dict[str, str] = {
        "error_code": entry["code"],
        "message": entry["message"],
        "user_message": entry["user_message"],
    }
    if detail_kvs:
        result["details"] = detail_kvs  # type: ignore[assignment]
    return result
