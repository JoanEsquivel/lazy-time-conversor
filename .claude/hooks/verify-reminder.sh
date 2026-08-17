#!/usr/bin/env bash
# Runs as a Stop hook. If the turn left uncommitted changes under src/, scripts/
# or e2e/, remind that `npm run verify` is this repo's definition of done —
# `npm test` alone skips the typecheck, and CI runs both.
#
# Purely advisory: it never blocks, it only surfaces a message.

set -uo pipefail

root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0

changed=$(git status --porcelain -- src scripts e2e 2>/dev/null | head -20)
[ -z "$changed" ] && exit 0

count=$(printf '%s\n' "$changed" | grep -c .)
jq -n --arg n "$count" '{
  systemMessage: ("Uncommitted changes in \($n) source file(s). Definition of done here is `npm run verify` (typecheck + 153 tests) — CI also runs `npm run catalog:check` and `npm run e2e`.")
}'
exit 0
