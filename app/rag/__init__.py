"""RAG pipeline — document import and parsing (Phase A)."""

from app.rag.manifest import (
    SourceFile,
    ContentChunk,
    ParsedDocument,
    ImportResult,
    compute_sha256,
    build_source_file,
)
from app.rag.scanner import scan_source_dir, is_path_safe
from app.rag.parsers import (
    parse_file,
    parse_markdown,
    parse_txt,
    parse_pdf,
    parse_docx,
    parse_xlsx,
    import_project,
)

__all__ = [
    # manifest
    "SourceFile",
    "ContentChunk",
    "ParsedDocument",
    "ImportResult",
    "compute_sha256",
    "build_source_file",
    # scanner
    "scan_source_dir",
    "is_path_safe",
    # parsers
    "parse_file",
    "parse_markdown",
    "parse_txt",
    "parse_pdf",
    "parse_docx",
    "parse_xlsx",
    "import_project",
]
