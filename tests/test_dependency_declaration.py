import tomllib
from pathlib import Path


def test_phase_a_runtime_and_verification_dependencies_are_declared() -> None:
    with Path("pyproject.toml").open("rb") as file:
        project = tomllib.load(file)["project"]

    runtime = "\n".join(project["dependencies"])
    development = "\n".join(project["optional-dependencies"]["dev"])

    for package in ("pypdf", "python-docx", "openpyxl"):
        assert package in runtime
    assert "reportlab" in development
