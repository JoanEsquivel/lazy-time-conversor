#!/usr/bin/env bash
# Guards the architectural invariants recorded in CLAUDE.md and spec §5.
#
# Runs as a PostToolUse hook on Write|Edit. Reads the hook payload on stdin,
# inspects only the file that was just written, and emits a blocking JSON
# verdict when that file breaks an invariant — so the violation is caught at
# the moment it is introduced rather than in review.
#
# Exits 0 always; the JSON body is what carries the decision.

set -uo pipefail

payload=$(cat)
file=$(printf '%s' "$payload" | jq -r '.tool_response.filePath // .tool_input.file_path // empty')
[ -z "$file" ] && exit 0
[ -f "$file" ] || exit 0

root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
case "$file" in "$root"/*) rel="${file#"$root"/}" ;; *) exit 0 ;; esac

violations=()

# Generated data: regenerate it, never hand-edit it. CI's catalog:check fails otherwise.
if [ "$rel" = "src/domain/catalog.generated.json" ]; then
  violations+=("$rel is generated. Edit scripts/gen-catalog.mjs or scripts/catalog.overrides.mjs and run 'npm run gen:catalog' — CI runs 'npm run catalog:check' and fails on any hand edit.")
fi

is_source=false
case "$rel" in
  src/*.ts|src/*.tsx|src/**/*.ts|src/**/*.tsx) is_source=true ;;
esac
case "$rel" in *.test.ts|*.test.tsx) is_test=true ;; *) is_test=false ;; esac

if [ "$is_source" = true ] && [ "$is_test" = false ]; then

  # INV-1 — ambient time lives in exactly two files.
  case "$rel" in
    src/store/clock.ts|src/hooks/useNow.ts) ;;
    *)
      if grep -nE '(new Date\(\)|Date\.now\(\))' "$file" >/dev/null; then
        hits=$(grep -nE '(new Date\(\)|Date\.now\(\))' "$file" | head -3 | tr '\n' ' ')
        violations+=("INV-1 violated in $rel: argument-less new Date()/Date.now() belongs only in src/store/clock.ts and src/hooks/useNow.ts. Take 'now: Date' as a parameter or read clock.now(). Found: $hits")
      fi
      ;;
  esac

  # INV-4 — never derive a calendar date from a UTC string.
  if grep -nE 'toISOString\(\)' "$file" >/dev/null; then
    hits=$(grep -nE 'toISOString\(\)' "$file" | head -3 | tr '\n' ' ')
    violations+=("INV-4 violated in $rel: build YYYY-MM-DD from Intl parts for the target zone (see toISODate in src/domain/tz.ts), never from a UTC string — slicing one shifts the date by a day for users east or west of UTC. Found: $hits")
  fi

  # INV-2 — src/domain/ is pure.
  case "$rel" in
    src/domain/*)
      if grep -nE '(\bwindow\.|\bdocument\.|\blocalStorage\b|\bnavigator\.|from .react.|from .zustand.)' "$file" >/dev/null; then
        hits=$(grep -nE '(\bwindow\.|\bdocument\.|\blocalStorage\b|\bnavigator\.|from .react.|from .zustand.)' "$file" | head -3 | tr '\n' ' ')
        violations+=("INV-2 violated in $rel: src/domain/ imports only its own siblings — no React, zustand, window, document, localStorage or navigator. Take the browser value as a parameter; src/main.tsx is the only place that reads the environment. Found: $hits")
      fi
      ;;
  esac

  # INV-6 — display names come from Intl, never literals.
  if [ "$rel" != "src/domain/catalog.ts" ]; then
    if grep -nE "'(United States|Costa Rica|Mountain Time|Philippines|India|Estados Unidos)'" "$file" >/dev/null; then
      hits=$(grep -nE "'(United States|Costa Rica|Mountain Time|Philippines|India|Estados Unidos)'" "$file" | head -3 | tr '\n' ' ')
      violations+=("INV-6 violated in $rel: country and zone names come from Intl via countryName()/zoneLabel()/pickerLabel() in src/domain/catalog.ts — a hard-coded name does not translate and drifts from the catalog. Found: $hits")
    fi
  fi
fi

if [ ${#violations[@]} -gt 0 ]; then
  reason=$(printf '%s\n' "${violations[@]}")
  jq -n --arg r "$reason" '{decision:"block", reason:$r, systemMessage:"Invariant check failed — see the reason fed back to Claude."}'
fi

exit 0
