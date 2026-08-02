# Test report

- Level: S1
- Status: implemented

## Automated verification

- `python -m pytest tests/test_config.py tests/test_llm_client.py tests/test_task_reports.py tests/test_phase_j.py -q` — passed: 151 tests.
- `python scripts/benchmark.py --help` — passed.
- `cd web && npm run build` — passed.
- `python scripts/validate_specs.py --strict` — passed: 0 validation errors.

## Cloud baseline evidence

- Chat model: Qwen3.6 35B Q4, `n_ctx=32768` on port 8000.
- Embedding model: the same Qwen GGUF, `n_ctx=4096` on port 8080.
- ROCm SMI reported 48,944 MB used of 49,136 MB total VRAM before the profile restart.
- API logs recorded task model calls falling back after model-generation failures under the prior 15-second application timeout.
