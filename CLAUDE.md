# CLAUDE.md — Lazy Time Converter

> **Status: designed and planned, not yet implemented.** The design spec is approved (v2) and a task-by-task ATDD implementation plan exists. The next session's job is to execute the plan; nothing under `src/` exists yet.

## What this is

A static React web app that converts a wall-clock time between any two country · time-zone pairs in the world (home zone auto-detected from the browser, editable), with a searchable picker, live "now" clocks, 24h/12h, EN/ES, light/dark/system theme, copy result, shareable URL and recent conversions. Zero runtime dependencies beyond React and Zustand — time math and country/zone names come from the browser's `Intl` API; the country→zone catalog is generated at build time from `@vvo/tzdb`. Deployed to GitHub Pages by GitHub Actions.

## Where to look (read in this order)

1. **`docs/superpowers/specs/2026-08-17-lazy-time-converter-design.md`** — the approved design spec (product authority). §4 catalog, §5 architecture + invariants, §6 domain API, §7 store, §8 UI, §11 acceptance scenarios (the ATDD contract), §12 CI/deploy.
2. **`docs/superpowers/plans/2026-08-17-lazy-time-converter-implementation.md`** — 22 ordered tasks, each with failing test → minimal code → verify → commit. ⚠️ ~4000 lines. **Do not read it end-to-end**; execute it task by task with `superpowers:subagent-driven-development` (or `superpowers:executing-plans`), reading one task at a time.
3. `docs/superpowers/mockups/*.html` — the approved visual mockups (layout A, "Midnight tech" style, searchable picker option B). Open in a browser when building UI.

## How to start the implementation session

```
1. Read this file and spec §5 (invariants) + §11 (scenarios).
2. Invoke superpowers:subagent-driven-development with the plan path above.
3. Start at Task 1 (scaffold). Do not skip ahead: later tasks depend on the exact exports of earlier ones.
4. Definition of done for every task: `npm run verify` green, then commit with the message given in the plan.
```

## Commands (once Task 1 is done)

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (`http://localhost:5173/lazy-time-conversor/`) |
| `npm run verify` | `typecheck` + `vitest run` — **the definition of done** |
| `npm run typecheck` | `tsc -b --noEmit` (never use bare `npx tsc --noEmit` at the root — the solution `tsconfig.json` checks zero files) |
| `npm test` | all unit + acceptance tests |
| `npm run gen:catalog` / `npm run catalog:check` | regenerate the world catalog / fail if the committed JSON drifted |
| `npm run e2e` | Playwright smoke against `vite preview` |
| `npm run build` | production build to `dist/` |

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
