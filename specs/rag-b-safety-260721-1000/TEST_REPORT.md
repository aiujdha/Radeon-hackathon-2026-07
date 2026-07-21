# Verification Report

## Required verification

```powershell
py -m pytest -q
py scripts/validate_specs.py --strict
```

## Result

- Local verification: `61 passed, 6 skipped`.
- Specification validation: `spec validation: checked errors=0`.
- Cloud verification remains pending. It requires a chat endpoint on port 8000
  and a separate embedding endpoint on port 8080.
