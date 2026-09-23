# Verifier Index — 0xNostr-Relay-Finder logic overhaul

Append-only index of verifier versions. Run logs live in `verifier/runs/`.

## v1 (2026-09-23)
Measures:
1. `npx tsc --noEmit` — typecheck clean (exit 0)
2. `npx eslint src --max-warnings 999` — lint runs to completion
3. `npx vitest run --reporter=dot` — existing unit tests pass
4. `npx vite build -l error` — production build succeeds
5. Logic unit tests (`verifier/v1/logic.test.ts`, run via vitest): relayUrl normalization/dedup, ws→http mapping, healthScore NaN/clamp safety, nip11Validation strictness
6. Logic-only constraint: `git diff --stat` shows no changes to .css/tailwind config/ui components except where logic required

First version; no prior baseline.
