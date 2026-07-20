"""Source directory scanner with security validation (Phase A).

Scans `data/projects/<project_id>/source/` for supported file formats,
validates each path against symlink-escape and path-traversal attacks.
"""

from pathlib import Path

SUPPORTED_EXTENSIONS: dict[str, str] = {
    ".md": "md",
    ".txt": "txt",
    ".pdf": "pdf",
    ".docx": "docx",
    ".xlsx": "xlsx",
    ".xlsm": "xlsx",
}


def is_path_safe(project_dir: Path, candidate: Path) -> bool:
    """Check that `candidate` does not escape `project_dir` via symlinks.

    Resolves both paths to their real locations and verifies that
    `candidate` is within or equal to `project_dir`.

    Args:
        project_dir: The project root directory.
        candidate: A file or directory path to validate.

    Returns:
        True if the resolved candidate is under the resolved project dir.
    """
    try:
        resolved_candidate = candidate.resolve()
        resolved_project = project_dir.resolve()
    except (OSError, RuntimeError):
        return False

    try:
        # Python 3.9+ is_relative_to
        return resolved_candidate.is_relative_to(resolved_project)
    except AttributeError:
        # Fallback for older Python — check common prefix
        try:
            resolved_candidate.relative_to(resolved_project)
            return True
        except ValueError:
            return False


def _detect_format(file_path: Path) -> str:
    """Detect file format from extension.

    Args:
        file_path: Path to the file.

    Returns:
        Format string (e.g. "md") or "unsupported".
    """
    suffix = file_path.suffix.lower()
    return SUPPORTED_EXTENSIONS.get(suffix, "unsupported")


def _contains_dotdot(path_str: str) -> bool:
    """Check if a path string contains `..` components."""
    return ".." in Path(path_str).parts


def scan_source_dir(project_id: str, *, base_dir: Path | None = None) -> list[tuple[Path, str, str]]:
    """Scan a project's source directory for importable files.

    Walks `data/projects/<project_id>/source/` relative to `base_dir`
    (default: current working directory), collects regular files, and
    validates each for safety.

    Args:
        project_id: Project identifier.
        base_dir: Root directory containing `data/`.  Defaults to `Path.cwd()`.

    Returns:
        A list of `(full_path, relative_path, format)` tuples for valid files.
        Unsafe or unsupported files are silently excluded here; the caller
        should record them as needed.

    Raises:
        FileNotFoundError: If the source directory does not exist.
        NotADirectoryError: If the source path is not a directory.
    """
    if base_dir is None:
        base_dir = Path.cwd()

    project_dir = base_dir / "data" / "projects" / project_id
    source_dir = project_dir / "source"

    if not source_dir.exists():
        raise FileNotFoundError(f"Source directory not found: {source_dir}")
    if not source_dir.is_dir():
        raise NotADirectoryError(f"Not a directory: {source_dir}")

    results: list[tuple[Path, str, str]] = []

    for entry in source_dir.rglob("*"):
        # Skip directories and non-files
        if not entry.is_file():
            continue

        # Reject path with .. components
        try:
            rel = entry.relative_to(project_dir)
        except ValueError:
            continue
        if _contains_dotdot(str(rel)):
            continue

        # Security: reject symlink escapes
        if not is_path_safe(project_dir, entry):
            continue

        fmt = _detect_format(entry)
        if fmt == "unsupported":
            continue

        results.append((entry, str(rel).replace("\\", "/"), fmt))

    return results
