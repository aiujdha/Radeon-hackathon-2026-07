# Phase B Retrieval Safety Repair

## Goal

Make Phase B retrieval safe for project-scoped storage and trustworthy when a
question has no supporting evidence.

## Acceptance criteria

- Invalid or traversal-like project IDs cannot choose a vector-index path.
- An unrelated question returns the standard no-evidence refusal, rather than
  an answer based only on arbitrary dense-neighbor results.
- CI collects real Phase B unit tests for indexing, retrieval, and QA refusal.
- Re-indexing an unchanged document does not invoke the embedder again.
