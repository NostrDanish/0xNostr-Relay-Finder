#!/bin/bash
# Verifier v1 — run all acceptance checks, append result to verifier/runs/
cd "$(dirname "$0")/../.." || exit 1
TS=$(date -u +%Y%m%dT%H%M%SZ)
LOG="verifier/runs/${TS}.log"
{
  echo "# Verifier v1 run at $TS"
  echo "## 1. tsc --noEmit"
  npx tsc --noEmit; echo "tsc_exit=$?"
  echo "## 2. eslint"
  npx eslint src 2>&1 | tail -5; echo "eslint_exit=${PIPESTATUS[0]}"
  echo "## 3. vitest (project tests + verifier logic tests)"
  npx vitest run --reporter=dot 2>&1 | tail -15; echo "vitest_exit=${PIPESTATUS[0]}"
  echo "## 4. vite build"
  npx vite build -l error 2>&1 | tail -5; echo "build_exit=${PIPESTATUS[0]}"
  echo "## 5. logic-only constraint (no CSS/tailwind changes)"
  git diff --stat -- '*.css' 'tailwind.config*' 'src/index.css' | tail -3
  echo "# END"
} 2>&1 | tee "$LOG"
echo "Logged to $LOG"
