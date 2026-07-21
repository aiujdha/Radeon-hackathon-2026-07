from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import gradio as gr
import httpx


DEFAULT_API_URL = os.getenv("OFFICE_AGENT_API_URL", "http://127.0.0.1:9000")


class ApiClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    def request(self, method: str, path: str, **kwargs: Any) -> Any:
        with httpx.Client(base_url=self.base_url, timeout=180) as client:
            response = client.request(method, path, **kwargs)
        if response.is_error:
            detail = response.text
            try:
                detail = response.json().get("detail", detail)
            except ValueError:
                pass
            raise gr.Error(f"API request failed ({response.status_code}): {detail}")
        return response.json()

    def list_projects(self) -> list[dict[str, Any]]:
        return self.request("GET", "/api/projects")


def _project_choices(client: ApiClient) -> list[str]:
    return [item["project_id"] for item in client.list_projects()]


def build_workbench(api_url: str = DEFAULT_API_URL) -> gr.Blocks:
    client = ApiClient(api_url)

    def refresh_projects() -> gr.Dropdown:
        return gr.Dropdown(choices=_project_choices(client))

    def create_project(project_id: str, name: str, description: str) -> tuple[gr.Dropdown, str]:
        project = client.request(
            "POST",
            "/api/projects",
            json={"project_id": project_id, "name": name, "description": description or None},
        )
        choices = _project_choices(client)
        return gr.Dropdown(choices=choices, value=project["project_id"]), "Project created."

    def upload_files(project_id: str, references: list[str] | None, task_file: str | None) -> str:
        if not project_id:
            raise gr.Error("Select a project first.")
        uploaded: list[str] = []
        for filename in references or []:
            with Path(filename).open("rb") as handle:
                result = client.request(
                    "POST",
                    f"/api/projects/{project_id}/files",
                    files={"file": (Path(filename).name, handle)},
                )
            uploaded.append(result["relative_path"])
        if task_file:
            with Path(task_file).open("rb") as handle:
                result = client.request(
                    "POST",
                    f"/api/projects/{project_id}/files",
                    data={"task_file": "true"},
                    files={"file": (Path(task_file).name, handle)},
                )
            uploaded.append(result["relative_path"])
        return "Uploaded:\n" + "\n".join(f"- `{path}`" for path in uploaded)

    def run_report(project_id: str) -> tuple[dict[str, Any], dict[str, Any], str]:
        if not project_id:
            raise gr.Error("Select a project first.")
        queued = client.request("POST", f"/api/projects/{project_id}/runs")
        result = client.request("POST", f"/api/projects/{project_id}/runs/{queued['run_id']}/execute")
        details = client.request("GET", f"/api/projects/{project_id}/runs/{queued['run_id']}/artifacts/result")
        links = []
        for label, artifact in (("Markdown report", "report"), ("Risk CSV", "risk_csv"), ("Next-week plan", "next_week_plan")):
            if artifact in result["artifacts"]:
                url = f"{api_url.rstrip('/')}/api/projects/{project_id}/runs/{queued['run_id']}/artifacts/{artifact}"
                links.append(f"- [{label}]({url})")
        return result, details, "## Downloads\n" + "\n".join(links)

    with gr.Blocks(title="ProjectPack Office Agent") as demo:
        gr.Markdown("# ProjectPack Office Agent\nUpload project evidence and one task list, then create an auditable report.")
        with gr.Row():
            project_selector = gr.Dropdown(label="Project", choices=[], interactive=True)
            refresh = gr.Button("Refresh projects")
        with gr.Accordion("Create project", open=False):
            new_id = gr.Textbox(label="Project ID", placeholder="lowercase-project-id")
            new_name = gr.Textbox(label="Project name")
            new_description = gr.Textbox(label="Description")
            create = gr.Button("Create project")
            create_status = gr.Markdown()
        with gr.Accordion("Upload source files", open=True):
            references = gr.File(label="Reference files (MD/TXT/PDF/DOCX/XLSX)", file_count="multiple", type="filepath")
            task_file = gr.File(label="Task list (CSV/XLSX)", file_count="single", type="filepath")
            upload = gr.Button("Upload files")
            upload_status = gr.Markdown()
        run = gr.Button("Generate project report", variant="primary")
        run_state = gr.JSON(label="Run status")
        evaluations = gr.JSON(label="Task status and source evidence")
        downloads = gr.Markdown()

        refresh.click(refresh_projects, outputs=project_selector)
        demo.load(refresh_projects, outputs=project_selector)
        create.click(create_project, inputs=[new_id, new_name, new_description], outputs=[project_selector, create_status])
        upload.click(upload_files, inputs=[project_selector, references, task_file], outputs=upload_status)
        run.click(run_report, inputs=project_selector, outputs=[run_state, evaluations, downloads])
    return demo
