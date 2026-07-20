# Verification Report

## Local verification

```powershell
py -m pytest -q
py scripts/validate_specs.py --strict
git diff --check
```

## Cloud verification plan

1. Deploy this branch into `/workspace/office-agent`.
2. Start the API on loopback port 9000 while llama-server is on port 8000.
3. Create and retrieve an isolated project through the API.
4. Invoke normal and JSON-validated model generations through `LLMClient`.
5. Record response status and payload shape below after execution.

## Result

- Pending implementation and cloud execution.
