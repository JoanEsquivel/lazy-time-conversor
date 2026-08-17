# CLAUDE.md — Lazy Time Converter

> **Status: live.** All 22 tasks of the implementation plan are complete and merged to `main`. The site is deployed at **https://joanesquivel.github.io/lazy-time-conversor/**; `.github/workflows/deploy.yml` redeploys it on every push to `main` after the catalog-drift check, typecheck, 153 tests, build and Playwright smoke all pass. Local gates: `npm run verify` and `npm run e2e`.

## What this is

A static React web app that converts a wall-clock time between any two country · time-zone pairs in the world (home zone auto-detected from the browser, editable), with a searchable picker, live "now" clocks, 24h/12h, EN/ES, light/dark/system theme, copy result, shareable URL and recent conversions. Zero runtime dependencies beyond React and Zustand — time math and country/zone names come from the browser's `Intl` API; the country→zone catalog is generated at build time from `@vvo/tzdb`. Designed to deploy to GitHub Pages via GitHub Actions (see status line above for what's still pending).

## Where to look (read in this order)

1. **`docs/superpowers/specs/2026-08-17-lazy-time-converter-design.md`** — the approved design spec (product authority). §4 catalog, §5 architecture + invariants, §6 domain API, §7 store, §8 UI, §11 acceptance scenarios (the ATDD contract), §12 CI/deploy.
2. **`docs/superpowers/plans/2026-08-17-lazy-time-converter-implementation.md`** — 22 ordered tasks, each with failing test → minimal code → verify → commit. ⚠️ ~4000 lines. **Do not read it end-to-end**; execute it task by task with `superpowers:subagent-driven-development` (or `superpowers:executing-plans`), reading one task at a time.
3. `docs/superpowers/mockups/*.html` — the approved visual mockups (layout A, "Midnight tech" style, searchable picker option B). Open in a browser when building UI.

## Working in this repo now

The implementation is done and live. For any follow-on work:

1. Read this file, then spec §5 (invariants) and §11 (the acceptance-scenario contract).
2. Run `npm run verify` first, to confirm the baseline is green before you touch anything. If it is already red, fix that before starting — do not stack a change on a broken baseline.
3. **Write the test first.** A bug fix starts with a failing test that reproduces it; a feature starts with the acceptance scenario. This repo was built that way and every test in it earns its place.
4. Change the code, re-run `npm run verify`, and run `npm run e2e` if you touched anything the browser sees.
5. Update the spec in the same commit if you changed behaviour it describes. The spec is the product authority — if code and spec disagree, one of them is a bug.

**A change to a time-zone rule, a format string or the catalog is never "obvious".** Verify it against real `Intl` output with a throwaway `node -e` before you trust it. Several defects in this repo's history were expectations that looked right and were arithmetically wrong — including one in the spec itself.

### Automated guards (`.claude/`)

Two project hooks run automatically; both are advisory-by-design and neither replaces `npm run verify`:

| Hook | When | What it does |
|---|---|---|
| `.claude/hooks/check-invariants.sh` | After every Write/Edit | Blocks and explains when the file just written breaks INV-1, INV-2, INV-4 or INV-6, or hand-edits the generated catalog. Silent otherwise. |
| `.claude/hooks/verify-reminder.sh` | When a turn ends | Reminds you that `npm run verify` is the definition of done, if the turn left uncommitted changes under `src/`, `scripts/` or `e2e/`. |

They are regex guards, not proofs: they catch the specific mistakes this codebase actually made. Passing them means nothing was *obviously* violated — INV-3 and INV-5 are not mechanically checkable and remain your responsibility. If a hook fires on something legitimate, fix the hook rather than working around it, and say why in the commit.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (`http://localhost:5173/lazy-time-conversor/`) |
| `npm run verify` | `typecheck` + `vitest run` — **the definition of done**. Currently: 153 tests passing across 23 files. |
| `npm run typecheck` | `tsc -b --noEmit` (never use bare `npx tsc --noEmit` at the root — the solution `tsconfig.json` checks zero files) |
| `npm test` | all unit + acceptance tests (same 153/23 as above) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run gen:catalog` | regenerate `src/domain/catalog.generated.json` from `@vvo/tzdb` (244 countries, 305 zones) |
| `npm run catalog:check` | regenerate the catalog and fail (`git diff --exit-code`) if the committed JSON drifted |
| `npm run e2e` | Playwright smoke suite against a `vite preview` build. Currently: 14 tests defined, 9 run, 5 skipped by cross-project (`desktop`/`mobile`) guards. |
| `npm run build` | production build to `dist/` |
| `npm run preview` | serve the production build locally |

## Architecture: dependencies point one way

```
scripts/          → (Node only, never imported by src/)
src/domain/       → nothing (pure; imports only siblings + catalog.generated.json)
src/i18n/         → nothing
src/store/        → domain, i18n
src/hooks/        → store, domain, react
src/components/   → store, domain, hooks, i18n, react
src/acceptance/   → everything (tests only)
```

## Invariants (cite by number; full text in spec §5)

- **INV-1** Argument-less `new Date()` / `Date.now()` only in `src/store/clock.ts` and `src/hooks/useNow.ts`.
- **INV-2** `src/domain/` is pure: no React, zustand, `window`, `localStorage`, `navigator`. Browser values are passed in (`main.tsx` is the only bootstrap env reader).
- **INV-3** Converted values are derived at render, never stored (store, URL, localStorage).
- **INV-4** Never build a calendar date from a UTC string (`toISOString().slice(0,10)` is banned).
- **INV-5** Store/URL/UI hold `ZoneId`s (= representative IANA names) that pass `isZoneId`; aliases normalized at the boundary via `zoneForIana`.
- **INV-6** Country/zone display names come from `Intl`, never hard-coded, never in i18n files.

## Process rules for this repo

- **ATDD**: every scenario in spec §11 has a corresponding test in `src/acceptance/`; write the acceptance test first (red), then component/unit tests, then code.
- Spec wins over plan; if you deviate, say so in the commit message and update the spec.
- Test facts: US DST 2026 = Mar 8 → Nov 1; Costa Rica UTC−6; India +05:30; Philippines +08:00; Arizona −07:00; **2026-08-17 is a Monday**. Spanish *zone* labels are locale-variant — compare against `zoneLabel(zone, 'es-CR')`, never a Spanish literal.
