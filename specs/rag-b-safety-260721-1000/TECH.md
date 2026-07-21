# Phase B Retrieval Safety Repair

- Level: S2
- Status: implemented

## Design

- `ProjectIndex` validates its project ID and uses `ensure_project_path()` for
  its vector-store directory.
- Retrieval only treats a dense hit as evidence when its raw cosine similarity
  meets a threshold; BM25 hits remain valid lexical evidence.
- The QA default applies that evidence threshold before generating an answer.
- Unit tests use `HashEmbedder` and are collected by pytest; remote-model work
  remains an explicit cloud verification step.
