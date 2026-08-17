# Lazy Time Converter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy the Lazy Time Converter — a static React web app that converts a wall-clock time between any two country·time-zone pairs in the world (home zone auto-detected), with a searchable picker, live clocks, EN/ES, themes, share links and recents — using ATDD (acceptance scenarios first) and TDD for every unit.

**Architecture:** Pure `src/domain/` (generated world catalog + `Intl`-based tz math + parsing/formatting/search/url) → Zustand store with `persist` → React components (two-card converter with a WAI-ARIA combobox picker). Names of countries/zones come from `Intl` at runtime; the catalog JSON is generated at build time from `@vvo/tzdb` and committed. Deployed to GitHub Pages by GitHub Actions after typecheck, unit + acceptance tests, catalog-drift check, build and a Playwright smoke run.

**Tech Stack:** React 19 · TypeScript (strict) · Vite · Vitest · React Testing Library + user-event · Zustand 5 · CSS Modules · Playwright · Node 22+ · `@vvo/tzdb` (dev-only data source)

**Spec:** `docs/superpowers/specs/2026-08-17-lazy-time-converter-design.md` (v2). Read §4–§8 and §11 before starting; every task below cites the section it implements. When plan and spec disagree, the spec wins — say so in the commit message.

## Global Constraints

- Runtime dependencies are exactly `react`, `react-dom`, `zustand`. Everything else is a devDependency. No date/time library.
- **INV-1** Argument-less `new Date()` / `Date.now()` only in `src/store/clock.ts` and `src/hooks/useNow.ts`. Everywhere else takes `now: Date` or reads `clock.now()`.
- **INV-2** `src/domain/` imports only its siblings and `catalog.generated.json`: no React, zustand, `window`, `localStorage`, `navigator`, `document`.
- **INV-3** Converted values are never stored (store, URL, localStorage) — always derived at render.
- **INV-4** Never `toISOString().slice(0,10)` or any UTC-string slicing to get a calendar date; dates are `YYYY-MM-DD` built from `Intl` parts for the relevant zone.
- **INV-5** Store/URL/UI hold `ZoneId`s (= representative IANA names) that pass `isZoneId`; aliases normalized at the boundary with `zoneForIana`.
- **INV-6** Country and zone display names come from `Intl` (`countryName`, `zoneLabel`), never hard-coded, never in i18n files.
- Definition of done for every task: `npm run verify` (typecheck + all tests) is green before committing. Commit after every task with the message given.
- Working directory: `/Users/ix-00233/Documents/GitHub/lazy-time-conversor` (git repo already initialised on `main`; `docs/` and `.gitignore` committed). Node 24 locally; CI uses Node 22.
- Vite `base` is `/lazy-time-conversor/`. Storage key `ltc:v1`. Breakpoint 720px.
- Test facts: US DST 2026 = 2026-03-08 → 2026-11-01. Costa Rica UTC−6 all year. India +05:30. Philippines +08:00. Arizona −07:00 all year. **2026-08-17 is a Monday.** Costa Rica is level with US Mountain in summer (both −06:00) and **one hour ahead** of it in winter (Denver −07:00), so 15:30 Denver is 15:30 in Costa Rica in August and 16:30 in January.
- Locale strings: `en` → `'en-US'`, `es` → `'es-CR'`. Spanish *zone* labels are locale-variant — tests compare to `zoneLabel(zone,'es-CR')`, never a Spanish literal.

---

## File structure (what will exist when done)

```
package.json, tsconfig.json, tsconfig.app.json, tsconfig.node.json, vite.config.ts, playwright.config.ts, index.html
scripts/
  catalog.overrides.mjs         political/continent overrides + exclusions (data, reviewed by humans)
  gen-catalog.mjs               builds src/domain/catalog.generated.json from @vvo/tzdb (exports buildCatalog for tests)
  gen-catalog.test.mjs          asserts committed JSON == freshly built JSON
src/
  main.tsx                      reads browser env (Intl zone, navigator.language, location.search) → store.bootstrap → render <App/>
  App.tsx                       layout shell: Header, HomeHint, Converter, ActionsRow, RecentList, Toast
  vite-env.d.ts
  styles/tokens.css             design tokens (dark default + light) — spec §8.4
  styles/global.css             reset, body, focus rings, reduced-motion
  test/setup.ts                 jest-dom, clipboard/matchMedia/scrollIntoView mocks
  domain/
    types.ts                    ISODate, HHMM, Locale, HourFormat, Lang, Theme
    catalog.generated.json      generated data (committed)
    catalog.ts                  COUNTRIES, zoneById, countryOf, zoneForIana, detectHomeZone, countryName, zoneLabel, pickerLabel, flagOf
    tz.ts                       offsetAt, wallToInstant, convert, nowIn, formatOffset
    timeParse.ts                parseTime
    format.ts                   formatTime, formatDateLine, formatDateFull, dayOffsetLabelKey, copyText, recentLabel
    search.ts                   normalize, buildSearchIndex, search
    url.ts                      encodeUrlState, decodeUrlState
  i18n/
    en.ts, es.ts                UI chrome strings (typed from en)
    index.ts                    translate(lang,key,vars), detectLang, LOCALE_OF
  store/
    clock.ts                    clock.now()  (INV-1)
    converter.ts                zustand store + persist + bootstrap + selectors
  hooks/
    useT.ts                     t() bound to prefs.lang
    useNow.ts                   ticking clock (INV-1)
    useTheme.ts                 applies data-theme, follows system
    useUrlSync.ts               history.replaceState on state change
    useShortcuts.ts             ⌘K / Ctrl+K
  components/
    Header/Header.tsx (+ .module.css)         brand, HomeBadge, toggles
    HomeHint/HomeHint.tsx                     detection-failed banner
    ZonePicker/ZonePicker.tsx (+ .module.css) searchable combobox
    TimeInput/TimeInput.tsx                   time text input with validation
    DateRow/DateRow.tsx                       date line, date input, Now
    ResultDisplay/ResultDisplay.tsx           big digits + day line + offsets
    NowLine/NowLine.tsx                       "now here/there HH:mm"
    SwapButton/SwapButton.tsx
    Converter/Converter.tsx (+ .module.css)   grid of SourcePanel · Swap · TargetPanel
    ActionsRow/ActionsRow.tsx                 Copy / Share
    RecentList/RecentList.tsx                 chips
    Toast/Toast.tsx                           transient message
  acceptance/
    harness.tsx                               renderApp({browserIana, now, search, storage}) + helpers
    home.test.tsx  conversion.test.tsx  picker.test.tsx  input.test.tsx  prefs.test.tsx  sharing.test.tsx
e2e/smoke.spec.ts
.github/workflows/deploy.yml
README.md, CLAUDE.md
```

Every `X.ts` / `X.tsx` has a sibling `X.test.ts(x)` unless stated otherwise.

---

### Task 1: Project scaffold (Vite + React + TS strict + Vitest + RTL)

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/App.test.tsx`, `src/vite-env.d.ts`, `src/test/setup.ts`, `src/domain/types.ts`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `preview`, `test`, `test:watch`, `typecheck`, `verify`, `gen:catalog`, `catalog:check`, `e2e`; test setup with jest-dom + browser mocks; `src/domain/types.ts` exporting `ISODate`, `HHMM`, `Locale`, `Lang`, `HourFormat`, `Theme`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "lazy-time-conversor",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b --noEmit",
    "verify": "npm run typecheck && npm test",
    "gen:catalog": "node scripts/gen-catalog.mjs",
    "catalog:check": "npm run gen:catalog && git diff --exit-code -- src/domain/catalog.generated.json",
    "e2e": "playwright test"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install react react-dom zustand
npm install -D typescript vite @vitejs/plugin-react vitest jsdom @types/react @types/react-dom @testing-library/react @testing-library/jest-dom @testing-library/user-event @vvo/tzdb @playwright/test
```
Expected: `package.json` gains `dependencies` (react, react-dom, zustand) and `devDependencies`; `package-lock.json` created.

- [ ] **Step 3: TypeScript configs**

`tsconfig.json` (solution file — note `npx tsc --noEmit` against it checks nothing; always use `npm run typecheck`):
```json
{ "files": [], "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }] }
```
`tsconfig.app.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["ES2023", "DOM", "DOM.Iterable"], "module": "ESNext", "moduleResolution": "bundler",
    "jsx": "react-jsx", "strict": true, "noUnusedLocals": true, "noUnusedParameters": true, "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true, "isolatedModules": true, "skipLibCheck": true, "noEmit": true,
    "types": ["vite/client", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```
`tsconfig.node.json`:
```json
{
  "compilerOptions": { "target": "ES2022", "lib": ["ES2023"], "module": "ESNext", "moduleResolution": "bundler", "strict": true, "skipLibCheck": true, "noEmit": true, "types": ["node"] },
  "include": ["vite.config.ts", "playwright.config.ts"]
}
```
Run `npm install -D @types/node`.

- [ ] **Step 4: Vite + Vitest config**

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/lazy-time-conversor/',
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    css: false,
  },
})
```

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

// jsdom lacks these browser APIs; components rely on them.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }),
  })
}
Element.prototype.scrollIntoView ??= () => {}
Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: { writeText: vi.fn(async () => {}) },
})

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})
```

- [ ] **Step 5: HTML shell, entry, App and a smoke test**

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark light" />
    <title>Lazy Time Converter</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```
`src/vite-env.d.ts`: `/// <reference types="vite/client" />`

`src/domain/types.ts`:
```ts
export type ISODate = string // "YYYY-MM-DD"
export type HHMM = string    // "HH:mm", zero-padded, 24h
export type Lang = 'en' | 'es'
export type Locale = 'en-US' | 'es-CR'
export type HourFormat = '24h' | '12h'
export type Theme = 'light' | 'dark' | 'system'
```

`src/App.tsx` (placeholder, replaced in Task 16):
```tsx
export default function App() {
  return <h1>Lazy Time Converter</h1>
}
```
`src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```
`src/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the title', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /lazy time converter/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Verify the toolchain**

Run: `npm run verify`
Expected: typecheck exits 0; vitest reports `1 passed`.
Run: `npm run build`
Expected: `dist/` produced with `/lazy-time-conversor/assets/...` paths in `dist/index.html`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS strict + Vitest/RTL toolchain"
```

---

### Task 2: Catalog generator (`@vvo/tzdb` → `catalog.generated.json`)

Implements spec §4.1. The generator is plain ESM Node, exports `buildCatalog` for testing, and only writes the file when run as a script.

**Files:**
- Create: `scripts/catalog.overrides.mjs`, `scripts/gen-catalog.mjs`, `scripts/gen-catalog.test.mjs`, `src/domain/catalog.generated.json` (generated)

**Interfaces:**
- Produces: `buildCatalog(rawTimeZones, tzdbVersion): CatalogFile` and the JSON file with shape `{ tzdbVersion, countries: [{ code, continent, zones: [{ id, aliases, cities, winter, summer }] }] }` — consumed by Task 3.

- [ ] **Step 1: Overrides file**

`scripts/catalog.overrides.mjs`:
```js
// Human-reviewed data. Political choices live here, never in code.
// Continent codes: AF Africa · AM Americas · AS Asia · EU Europe · OC Oceania

/** country code → continent, when tzdb's continent for that country is not the one we want to show. */
export const CONTINENT_OVERRIDES = {
  // e.g. TR: 'EU'  — none required at launch; tzdb's assignment is used as-is
}

/** tzdb continent codes to drop entirely. */
export const EXCLUDED_CONTINENTS = new Set(['AN'])

/** IANA zone ids to drop even if tzdb lists them. */
export const EXCLUDED_ZONES = new Set([])
```

- [ ] **Step 2: Write the generator test (red)**

`scripts/gen-catalog.test.mjs`:
```js
// @vitest-environment node
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { rawTimeZones } from '@vvo/tzdb'
import { buildCatalog, serialize } from './gen-catalog.mjs'

const require = createRequire(import.meta.url)
const tzdbVersion = require('@vvo/tzdb/package.json').version

describe('gen-catalog', () => {
  const catalog = buildCatalog(rawTimeZones, tzdbVersion)

  it('covers the world', () => {
    expect(catalog.countries.length).toBeGreaterThanOrEqual(240)
    const continents = new Set(catalog.countries.map((c) => c.continent))
    expect([...continents].sort()).toEqual(['AF', 'AM', 'AS', 'EU', 'OC'])
  })

  it('has unique zone ids, every id/alias accepted by Intl, and every country has a zone', () => {
    const ids = new Set()
    for (const c of catalog.countries) {
      expect(c.zones.length).toBeGreaterThan(0)
      for (const z of c.zones) {
        expect(ids.has(z.id)).toBe(false)
        ids.add(z.id)
        for (const name of [z.id, ...z.aliases]) {
          expect(() => new Intl.DateTimeFormat('en-US', { timeZone: name })).not.toThrow()
        }
      }
    }
  })

  it('keeps the reference zones with expected shape', () => {
    const us = catalog.countries.find((c) => c.code === 'US')
    const denver = us.zones.find((z) => z.id === 'America/Denver')
    expect(us.continent).toBe('AM')
    expect(us.zones).toHaveLength(8)
    expect(denver.aliases).toContain('America/Boise')
    expect(denver.cities[0]).toBe('Denver')
    expect(denver.winter).toBe(-420)
    expect(denver.summer).toBe(-360)
    const cr = catalog.countries.find((c) => c.code === 'CR')
    expect(cr.zones.map((z) => z.id)).toEqual(['America/Costa_Rica'])
    expect(catalog.countries.find((c) => c.code === 'AQ')).toBeUndefined()
  })

  it('is deterministic and matches the committed file', () => {
    expect(serialize(buildCatalog(rawTimeZones, tzdbVersion))).toBe(serialize(catalog))
    const committed = readFileSync(new URL('../src/domain/catalog.generated.json', import.meta.url), 'utf8')
    expect(committed).toBe(serialize(catalog))
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run scripts/gen-catalog.test.mjs`
Expected: FAIL — cannot resolve `./gen-catalog.mjs`.

- [ ] **Step 4: Write the generator**

`scripts/gen-catalog.mjs`:
```js
#!/usr/bin/env node
// Generates src/domain/catalog.generated.json from @vvo/tzdb.
// Deterministic: same input → byte-identical output (CI runs `npm run catalog:check`).
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { rawTimeZones } from '@vvo/tzdb'
import { CONTINENT_OVERRIDES, EXCLUDED_CONTINENTS, EXCLUDED_ZONES } from './catalog.overrides.mjs'

const CONTINENT_MAP = { AF: 'AF', NA: 'AM', SA: 'AM', AS: 'AS', EU: 'EU', OC: 'OC' }
const REFERENCE_YEAR = 2026
const JAN = Date.UTC(REFERENCE_YEAR, 0, 15, 12)
const JUL = Date.UTC(REFERENCE_YEAR, 6, 15, 12)
const MAX_CITIES = 4

const dtfCache = new Map()
function dtf(iana) {
  let f = dtfCache.get(iana)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: iana, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    dtfCache.set(iana, f)
  }
  return f
}

/** Offset in minutes east of UTC of `iana` at `instantMs`. Same algorithm as src/domain/tz.ts. */
export function offsetAt(iana, instantMs) {
  const p = {}
  for (const { type, value } of dtf(iana).formatToParts(new Date(instantMs))) if (type !== 'literal') p[type] = value
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second)
  return Math.round((asUtc - instantMs) / 60000)
}

function assertIntlAccepts(name) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: name }) } catch { throw new Error(`Intl rejects time zone "${name}"`) }
}

export function buildCatalog(zones, tzdbVersion) {
  const countries = new Map()
  for (const z of zones) {
    if (EXCLUDED_CONTINENTS.has(z.continentCode) || EXCLUDED_ZONES.has(z.name)) continue
    const continent = CONTINENT_OVERRIDES[z.countryCode] ?? CONTINENT_MAP[z.continentCode]
    if (!continent) throw new Error(`No continent mapping for ${z.name} (${z.continentCode})`)
    const aliases = [...new Set(z.group.filter((g) => g !== z.name))].sort()
    for (const name of [z.name, ...aliases]) assertIntlAccepts(name)
    let country = countries.get(z.countryCode)
    if (!country) {
      country = { code: z.countryCode, continent, zones: [] }
      countries.set(z.countryCode, country)
    } else if (country.continent !== continent) {
      throw new Error(`Country ${z.countryCode} maps to two continents (${country.continent}, ${continent})`)
    }
    country.zones.push({
      id: z.name,
      aliases,
      cities: z.mainCities.slice(0, MAX_CITIES),
      winter: offsetAt(z.name, JAN),
      summer: offsetAt(z.name, JUL),
    })
  }
  const list = [...countries.values()].sort((a, b) => a.code.localeCompare(b.code))
  for (const c of list) c.zones.sort((a, b) => a.winter - b.winter || a.id.localeCompare(b.id))
  return { tzdbVersion, countries: list }
}

export function serialize(catalog) {
  return JSON.stringify(catalog, null, 2) + '\n'
}

function main() {
  const require = createRequire(import.meta.url)
  const tzdbVersion = require('@vvo/tzdb/package.json').version
  const catalog = buildCatalog(rawTimeZones, tzdbVersion)
  const out = new URL('../src/domain/catalog.generated.json', import.meta.url)
  writeFileSync(out, serialize(catalog))
  const zoneCount = catalog.countries.reduce((n, c) => n + c.zones.length, 0)
  console.log(`catalog.generated.json: ${catalog.countries.length} countries, ${zoneCount} zones (tzdb ${tzdbVersion})`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
```

- [ ] **Step 5: Generate the file and run the tests**

Run: `npm run gen:catalog`
Expected: prints `catalog.generated.json: 24x countries, 3xx zones (tzdb 6.x)`; file ≈ 25 KB.
Run: `npx vitest run scripts/gen-catalog.test.mjs`
Expected: 4 passed.
Run: `npm run catalog:check`
Expected: exit 0 (no diff after regenerating).

- [ ] **Step 6: Commit**

```bash
git add scripts src/domain/catalog.generated.json
git commit -m "feat(catalog): deterministic world catalog generator from @vvo/tzdb"
```

---

### Task 3: Catalog runtime API (`src/domain/catalog.ts`)

Implements spec §4.2 (except `buildSearchIndex`, which lives in Task 7).

**Files:**
- Create: `src/domain/catalog.ts`, `src/domain/catalog.test.ts`

**Interfaces:**
- Consumes: `catalog.generated.json` (Task 2), `Locale` (Task 1).
- Produces:
  ```ts
  export type Continent = 'AF' | 'AM' | 'AS' | 'EU' | 'OC'
  export type CountryCode = string
  export type ZoneId = string
  export interface Zone { id: ZoneId; country: CountryCode; aliases: readonly string[]; cities: readonly string[]; winter: number; summer: number }
  export interface Country { code: CountryCode; continent: Continent; flag: string; zones: readonly Zone[] }
  export const CONTINENTS: readonly Continent[]
  export const COUNTRIES: readonly Country[]
  export function flagOf(code: CountryCode): string
  export function isZoneId(s: string): s is ZoneId
  export function zoneById(id: ZoneId): Zone
  export function countryByCode(code: CountryCode): Country
  export function countryOf(id: ZoneId): Country
  export function zoneForIana(iana: string): Zone | undefined
  export function detectHomeZone(browserIana: string | undefined): ZoneId | undefined
  export function countryName(code: CountryCode, locale: Locale): string
  export function zoneLabel(zone: Zone, locale: Locale): string
  export function pickerLabel(zone: Zone, locale: Locale): string
  ```

- [ ] **Step 1: Write the failing tests**

`src/domain/catalog.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import {
  CONTINENTS, COUNTRIES, countryName, countryOf, detectHomeZone, flagOf, isZoneId,
  pickerLabel, zoneById, zoneForIana, zoneLabel,
} from './catalog'

describe('catalog data', () => {
  it('exposes the world grouped by continent', () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(240)
    expect(CONTINENTS).toEqual(['AF', 'AM', 'AS', 'EU', 'OC'])
    for (const c of COUNTRIES) expect(CONTINENTS).toContain(c.continent)
  })
  it('builds flags from country codes', () => {
    expect(flagOf('CR')).toBe('🇨🇷')
    expect(flagOf('US')).toBe('🇺🇸')
  })
  it('validates and looks up zone ids', () => {
    expect(isZoneId('America/Denver')).toBe(true)
    expect(isZoneId('America/Boise')).toBe(false) // alias, not an id
    expect(isZoneId('Nowhere/Land')).toBe(false)
    expect(zoneById('America/Costa_Rica').country).toBe('CR')
    expect(() => zoneById('Nowhere/Land')).toThrow(/Unknown zone/)
    expect(countryOf('Asia/Kolkata').code).toBe('IN')
    expect(countryOf('America/Denver').zones).toHaveLength(8)
  })
  it('resolves ids and aliases with zoneForIana', () => {
    expect(zoneForIana('America/Denver')?.id).toBe('America/Denver')
    expect(zoneForIana('America/Boise')?.id).toBe('America/Denver')
    expect(zoneForIana('US/Mountain')?.id).toBe('America/Denver')
    expect(zoneForIana('Asia/Calcutta')?.id).toBe('Asia/Kolkata')
    expect(zoneForIana('Etc/UTC')).toBeUndefined()
  })
  it('detects home from the browser zone', () => {
    expect(detectHomeZone('America/Costa_Rica')).toBe('America/Costa_Rica')
    expect(detectHomeZone('America/Boise')).toBe('America/Denver')
    expect(detectHomeZone('Etc/UTC')).toBeUndefined()
    expect(detectHomeZone(undefined)).toBeUndefined()
  })
})

describe('catalog names (Intl)', () => {
  it('localizes country names', () => {
    expect(countryName('US', 'en-US')).toBe('United States')
    expect(countryName('US', 'es-CR')).toBe('Estados Unidos')
    expect(countryName('DE', 'es-CR')).toBe('Alemania')
  })
  it('labels zones with generic names and never GMT±', () => {
    expect(zoneLabel(zoneById('America/Denver'), 'en-US')).toBe('Mountain Time')
    expect(zoneLabel(zoneById('America/Phoenix'), 'en-US')).toBe('Mountain Standard Time')
    expect(zoneLabel(zoneById('Europe/Berlin'), 'en-US')).toBe('Central European Time')
    expect(zoneLabel(zoneById('America/Costa_Rica'), 'en-US')).toBe('Central Standard Time')
    for (const c of COUNTRIES) for (const z of c.zones) {
      expect(zoneLabel(z, 'en-US')).not.toMatch(/^(GMT|UTC)[+-]?/)
    }
  })
  it('builds picker labels: zone suffix only for multi-zone countries', () => {
    expect(pickerLabel(zoneById('America/Denver'), 'en-US')).toBe('🇺🇸 United States · Mountain Time')
    expect(pickerLabel(zoneById('America/Costa_Rica'), 'en-US')).toBe('🇨🇷 Costa Rica')
    expect(pickerLabel(zoneById('Asia/Kolkata'), 'es-CR')).toBe('🇮🇳 India')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/domain/catalog.test.ts`
Expected: FAIL — module `./catalog` not found.

- [ ] **Step 3: Implement**

`src/domain/catalog.ts`:
```ts
import data from './catalog.generated.json'
import type { Locale } from './types'

export type Continent = 'AF' | 'AM' | 'AS' | 'EU' | 'OC'
export type CountryCode = string
export type ZoneId = string

export interface Zone {
  id: ZoneId
  country: CountryCode
  aliases: readonly string[]
  cities: readonly string[]
  winter: number
  summer: number
}
export interface Country {
  code: CountryCode
  continent: Continent
  flag: string
  zones: readonly Zone[]
}

export const CONTINENTS: readonly Continent[] = ['AF', 'AM', 'AS', 'EU', 'OC']

export function flagOf(code: CountryCode): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
}

export const COUNTRIES: readonly Country[] = data.countries.map((c) => ({
  code: c.code,
  continent: c.continent as Continent,
  flag: flagOf(c.code),
  zones: c.zones.map((z) => ({ ...z, country: c.code })),
}))

const zoneIndex = new Map<string, Zone>()
const aliasIndex = new Map<string, Zone>()
const countryIndex = new Map<string, Country>()
for (const c of COUNTRIES) {
  countryIndex.set(c.code, c)
  for (const z of c.zones) {
    zoneIndex.set(z.id, z)
    for (const a of z.aliases) aliasIndex.set(a, z)
  }
}

export function isZoneId(s: string): s is ZoneId {
  return zoneIndex.has(s)
}
export function zoneById(id: ZoneId): Zone {
  const z = zoneIndex.get(id)
  if (!z) throw new Error(`Unknown zone id: ${id}`)
  return z
}
export function countryByCode(code: CountryCode): Country {
  const c = countryIndex.get(code)
  if (!c) throw new Error(`Unknown country: ${code}`)
  return c
}
export function countryOf(id: ZoneId): Country {
  return countryByCode(zoneById(id).country)
}
export function zoneForIana(iana: string): Zone | undefined {
  return zoneIndex.get(iana) ?? aliasIndex.get(iana)
}
export function detectHomeZone(browserIana: string | undefined): ZoneId | undefined {
  return browserIana ? zoneForIana(browserIana)?.id : undefined
}

// Generic zone names do not depend on the date, but formatToParts needs an instant.
const LABEL_INSTANT = new Date(Date.UTC(2026, 6, 15, 12))
const nameCache = new Map<string, string>()

export function countryName(code: CountryCode, locale: Locale): string {
  const key = `c:${locale}:${code}`
  let v = nameCache.get(key)
  if (v === undefined) {
    v = new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
    nameCache.set(key, v)
  }
  return v
}

function humanizeId(id: string): string {
  return id.split('/').pop()!.replace(/_/g, ' ')
}

export function zoneLabel(zone: Zone, locale: Locale): string {
  const key = `z:${locale}:${zone.id}`
  let v = nameCache.get(key)
  if (v === undefined) {
    const part = new Intl.DateTimeFormat(locale, { timeZone: zone.id, timeZoneName: 'longGeneric' })
      .formatToParts(LABEL_INSTANT)
      .find((p) => p.type === 'timeZoneName')?.value
    v = !part || /^(GMT|UTC)/.test(part) ? humanizeId(zone.id) : part
    nameCache.set(key, v)
  }
  return v
}

export function pickerLabel(zone: Zone, locale: Locale): string {
  const country = countryByCode(zone.country)
  const base = `${country.flag} ${countryName(country.code, locale)}`
  return country.zones.length > 1 ? `${base} · ${zoneLabel(zone, locale)}` : base
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/domain/catalog.test.ts`
Expected: all pass. If `zoneLabel` "never GMT" fails for some zone, that zone's `Intl` generic name is `GMT±…` — the fallback should already handle it; inspect the failing id and confirm `humanizeId` is applied.

- [ ] **Step 5: Verify + commit**

Run: `npm run verify` → green.
```bash
git add src/domain/catalog.ts src/domain/catalog.test.ts
git commit -m "feat(catalog): runtime catalog API with Intl-derived names and alias resolution"
```

---

### Task 4: Time-zone math (`src/domain/tz.ts`)

Implements spec §6.1 with the DST gap/overlap rules of §10.

**Files:**
- Create: `src/domain/tz.ts`, `src/domain/tz.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface WallParts { y: number; m: number; d: number; h: number; min: number; s: number }
  export function wallParts(iana: string, instantMs: number): WallParts
  export function offsetAt(iana: string, instantMs: number): number            // minutes east of UTC
  export function wallToInstant(iana: string, date: ISODate, time: HHMM): number
  export interface ConvertInput { date: ISODate; time: HHMM; from: string; to: string }
  export interface ConvertResult { date: ISODate; time: HHMM; dayOffset: -1 | 0 | 1; fromOffset: string; toOffset: string }
  export function convert(input: ConvertInput): ConvertResult
  export function nowIn(iana: string, now: Date): { date: ISODate; time: HHMM; seconds: number }
  export function formatOffset(minutes: number): string                          // "+05:30" / "-06:00"
  export function toISODate(p: WallParts): ISODate
  export function toHHMM(p: WallParts): HHMM
  ```

- [ ] **Step 1: Write the failing tests**

`src/domain/tz.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { convert, formatOffset, nowIn, offsetAt, wallParts, wallToInstant } from './tz'

const DENVER = 'America/Denver'
const CR = 'America/Costa_Rica'
const IN = 'Asia/Kolkata'
const PH = 'Asia/Manila'
const AZ = 'America/Phoenix'

describe('offsetAt', () => {
  it('knows DST vs standard time', () => {
    expect(offsetAt(DENVER, Date.UTC(2026, 7, 17, 12))).toBe(-360)   // MDT
    expect(offsetAt(DENVER, Date.UTC(2026, 0, 15, 12))).toBe(-420)   // MST
    expect(offsetAt(CR, Date.UTC(2026, 7, 17, 12))).toBe(-360)
    expect(offsetAt(IN, Date.UTC(2026, 7, 17, 12))).toBe(330)
    expect(offsetAt(AZ, Date.UTC(2026, 7, 17, 12))).toBe(-420)
  })
  it('flips exactly at the 2026-03-08 spring-forward instant (09:00Z)', () => {
    expect(offsetAt(DENVER, Date.UTC(2026, 2, 8, 8, 59))).toBe(-420)
    expect(offsetAt(DENVER, Date.UTC(2026, 2, 8, 9, 0))).toBe(-360)
  })
})

describe('wallParts / formatOffset', () => {
  it('reads wall clock parts in a zone (h23, midnight is 0)', () => {
    expect(wallParts(DENVER, Date.UTC(2026, 7, 17, 6, 0))).toEqual({ y: 2026, m: 8, d: 17, h: 0, min: 0, s: 0 })
  })
  it('formats offsets', () => {
    expect(formatOffset(-360)).toBe('-06:00')
    expect(formatOffset(330)).toBe('+05:30')
    expect(formatOffset(0)).toBe('+00:00')
  })
})

describe('wallToInstant', () => {
  it('normal times round-trip', () => {
    const inst = wallToInstant(DENVER, '2026-08-17', '15:30')
    expect(inst).toBe(Date.UTC(2026, 7, 17, 21, 30))
    expect(wallParts(DENVER, inst)).toMatchObject({ h: 15, min: 30 })
  })
  it('spring-forward gap shifts forward: 02:30 → 03:30 MDT', () => {
    const inst = wallToInstant(DENVER, '2026-03-08', '02:30')
    expect(wallParts(DENVER, inst)).toMatchObject({ d: 8, h: 3, min: 30 })
    expect(offsetAt(DENVER, inst)).toBe(-360)
  })
  it('spring-forward gap east of UTC also shifts forward (Berlin 2026-03-29 02:30 → 03:30)', () => {
    const inst = wallToInstant('Europe/Berlin', '2026-03-29', '02:30')
    expect(wallParts('Europe/Berlin', inst)).toMatchObject({ h: 3, min: 30 })
  })
  it('fall-back overlap picks the first occurrence (MDT)', () => {
    const inst = wallToInstant(DENVER, '2026-11-01', '01:30')
    expect(offsetAt(DENVER, inst)).toBe(-360)
    expect(inst).toBe(Date.UTC(2026, 10, 1, 7, 30))
  })
  it('fall-back overlap east of UTC also picks the first occurrence (Berlin 2026-10-25 02:30 → CEST)', () => {
    const inst = wallToInstant('Europe/Berlin', '2026-10-25', '02:30')
    expect(offsetAt('Europe/Berlin', inst)).toBe(120)
    expect(inst).toBe(Date.UTC(2026, 9, 25, 0, 30))
  })
})

describe('convert (spec §11 scenarios)', () => {
  it('C1 US Mountain → Costa Rica in DST', () => {
    expect(convert({ date: '2026-08-17', time: '15:30', from: DENVER, to: CR }))
      .toEqual({ date: '2026-08-17', time: '15:30', dayOffset: 0, fromOffset: '-06:00', toOffset: '-06:00' })
  })
  it('C2 US Mountain → Costa Rica in standard time', () => {
    expect(convert({ date: '2026-01-15', time: '15:30', from: DENVER, to: CR })).toMatchObject({ time: '16:30', date: '2026-01-15', dayOffset: 0 })
  })
  it('C4 Costa Rica → India crosses midnight forward', () => {
    expect(convert({ date: '2026-08-17', time: '20:00', from: CR, to: IN })).toMatchObject({ time: '07:30', date: '2026-08-18', dayOffset: 1, toOffset: '+05:30' })
  })
  it('C5 Philippines → Costa Rica crosses midnight backward', () => {
    expect(convert({ date: '2026-08-17', time: '08:00', from: PH, to: CR })).toMatchObject({ time: '18:00', date: '2026-08-16', dayOffset: -1 })
  })
  it('C6 Arizona ignores DST', () => {
    expect(convert({ date: '2026-08-17', time: '15:30', from: AZ, to: CR }).time).toBe('16:30')
  })
  it('C7 arbitrary zones', () => {
    const base = { date: '2026-08-17', time: '12:00', from: CR }
    expect(convert({ ...base, to: 'Europe/Berlin' })).toMatchObject({ time: '20:00', dayOffset: 0 })
    expect(convert({ ...base, to: 'Africa/Lagos' })).toMatchObject({ time: '19:00', dayOffset: 0 })
    expect(convert({ ...base, to: 'Asia/Tokyo' })).toMatchObject({ time: '03:00', dayOffset: 1 })
    expect(convert({ ...base, to: 'Australia/Sydney' })).toMatchObject({ time: '04:00', dayOffset: 1 })
  })
  it('same zone both sides is identity', () => {
    expect(convert({ date: '2026-08-17', time: '09:05', from: CR, to: CR })).toMatchObject({ time: '09:05', dayOffset: 0 })
  })
})

describe('nowIn', () => {
  it('reports the wall clock of an instant in a zone', () => {
    const now = new Date('2026-08-17T14:52:07Z')
    expect(nowIn(DENVER, now)).toEqual({ date: '2026-08-17', time: '08:52', seconds: 7 })
    expect(nowIn(CR, now)).toEqual({ date: '2026-08-17', time: '08:52', seconds: 7 })
    expect(nowIn(IN, now)).toEqual({ date: '2026-08-17', time: '20:22', seconds: 7 })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/domain/tz.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

`src/domain/tz.ts`:
```ts
import type { HHMM, ISODate } from './types'

export interface WallParts { y: number; m: number; d: number; h: number; min: number; s: number }
export interface ConvertInput { date: ISODate; time: HHMM; from: string; to: string }
export interface ConvertResult { date: ISODate; time: HHMM; dayOffset: -1 | 0 | 1; fromOffset: string; toOffset: string }

const MIN = 60_000
const DAY = 86_400_000
const dtfCache = new Map<string, Intl.DateTimeFormat>()

function dtf(iana: string): Intl.DateTimeFormat {
  let f = dtfCache.get(iana)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: iana, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    dtfCache.set(iana, f)
  }
  return f
}

const pad = (n: number) => String(n).padStart(2, '0')

export function wallParts(iana: string, instantMs: number): WallParts {
  const p: Record<string, string> = {}
  for (const { type, value } of dtf(iana).formatToParts(new Date(instantMs))) if (type !== 'literal') p[type] = value
  // Some ICU builds print "24" for midnight even with h23 — normalise.
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute, s: +p.second }
}

export function toISODate(p: WallParts): ISODate {
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`
}
export function toHHMM(p: WallParts): HHMM {
  return `${pad(p.h)}:${pad(p.min)}`
}

export function offsetAt(iana: string, instantMs: number): number {
  const whole = instantMs - (((instantMs % 1000) + 1000) % 1000) // drop sub-second part
  const p = wallParts(iana, whole)
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s)
  return Math.round((asUtc - whole) / MIN)
}

export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

/**
 * Wall time in `iana` → epoch ms.
 * Gap (spring forward, wall time does not exist): shift forward by the gap (02:30 → 03:30).
 * Overlap (fall back, wall time exists twice): first occurrence (earlier instant).
 */
export function wallToInstant(iana: string, date: ISODate, time: HHMM): number {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, h, min)
  // Offsets in force around the guess: a transition within ±1 day shows up as two distinct values.
  const offsets = [...new Set([offsetAt(iana, guess - DAY), offsetAt(iana, guess), offsetAt(iana, guess + DAY)])]
  const roundTrips = (c: number) => {
    const p = wallParts(iana, c)
    return p.y === y && p.m === m && p.d === d && p.h === h && p.min === min
  }
  const valid = offsets.map((o) => guess - o * MIN).filter(roundTrips)
  if (valid.length === 0) return guess - Math.min(...offsets) * MIN // gap → pre-transition (smaller) offset → shifted forward
  return Math.min(...valid)                                          // overlap → earlier instant (first occurrence); normal → the one candidate
}

function dayDiff(a: ISODate, b: ISODate): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / DAY)
}

export function convert({ date, time, from, to }: ConvertInput): ConvertResult {
  const instant = wallToInstant(from, date, time)
  const p = wallParts(to, instant)
  const rDate = toISODate(p)
  const diff = dayDiff(rDate, date)
  const dayOffset = (diff > 0 ? 1 : diff < 0 ? -1 : 0) as -1 | 0 | 1
  return {
    date: rDate,
    time: toHHMM(p),
    dayOffset,
    fromOffset: formatOffset(offsetAt(from, instant)),
    toOffset: formatOffset(offsetAt(to, instant)),
  }
}

export function nowIn(iana: string, now: Date): { date: ISODate; time: HHMM; seconds: number } {
  const p = wallParts(iana, now.getTime())
  return { date: toISODate(p), time: toHHMM(p), seconds: p.s }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/domain/tz.test.ts` → all pass.

- [ ] **Step 5: Verify + commit**

```bash
npm run verify
git add src/domain/tz.ts src/domain/tz.test.ts
git commit -m "feat(tz): Intl-based zone conversion with deterministic DST gap/overlap rules"
```

---

### Task 5: Time parsing (`src/domain/timeParse.ts`)

Implements spec §6.2.

**Files:**
- Create: `src/domain/timeParse.ts`, `src/domain/timeParse.test.ts`

**Interfaces:**
- Produces: `export type ParseResult = { ok: true; time: HHMM } | { ok: false; reason: 'empty' | 'invalid' }` and `export function parseTime(raw: string): ParseResult`.

- [ ] **Step 1: Write the failing tests**

`src/domain/timeParse.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parseTime } from './timeParse'

describe('parseTime', () => {
  it.each([
    ['15:30', '15:30'], ['1530', '15:30'], ['930', '09:30'], ['9:5', '09:05'], ['9', '09:00'], ['0:00', '00:00'],
    ['3:30 pm', '15:30'], ['3:30pm', '15:30'], ['3pm', '15:00'], ['3 PM', '15:00'], ['3p', '15:00'],
    ['12am', '00:00'], ['12pm', '12:00'], ['12:30 a.m.', '00:30'], ['  7:45 AM ', '07:45'], ['23:59', '23:59'],
  ])('accepts %s → %s', (raw, expected) => {
    expect(parseTime(raw)).toEqual({ ok: true, time: expected })
  })

  it.each(['24:00', '25:00', '13pm', '0pm', '3:60', 'abc', '15:3x', '1:2:3', '99999'])('rejects %s', (raw) => {
    expect(parseTime(raw)).toEqual({ ok: false, reason: 'invalid' })
  })

  it('reports empty input separately', () => {
    expect(parseTime('')).toEqual({ ok: false, reason: 'empty' })
    expect(parseTime('   ')).toEqual({ ok: false, reason: 'empty' })
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/domain/timeParse.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

`src/domain/timeParse.ts`:
```ts
import type { HHMM } from './types'

export type ParseResult = { ok: true; time: HHMM } | { ok: false; reason: 'empty' | 'invalid' }

const INVALID: ParseResult = { ok: false, reason: 'invalid' }
const pad = (n: number) => String(n).padStart(2, '0')

/** Accepts 15:30 · 1530 · 930 · 9:5 · 3:30 pm · 3pm · 12am; returns zero-padded 24h HH:mm. */
export function parseTime(raw: string): ParseResult {
  if (raw.trim() === '') return { ok: false, reason: 'empty' }
  let s = raw.toLowerCase().replace(/[\s.]/g, '')
  let meridiem: 'am' | 'pm' | undefined
  const mer = /(am|pm|a|p)$/.exec(s)
  if (mer) {
    meridiem = mer[1].startsWith('a') ? 'am' : 'pm'
    s = s.slice(0, -mer[1].length)
  }
  let h: number
  let min: number
  if (/^\d{3,4}$/.test(s)) {
    h = Number(s.slice(0, -2))
    min = Number(s.slice(-2))
  } else if (/^\d{1,2}$/.test(s)) {
    h = Number(s)
    min = 0
  } else {
    const m = /^(\d{1,2}):(\d{1,2})$/.exec(s)
    if (!m) return INVALID
    h = Number(m[1])
    min = Number(m[2])
  }
  if (meridiem) {
    if (h < 1 || h > 12) return INVALID
    if (meridiem === 'am' && h === 12) h = 0
    if (meridiem === 'pm' && h !== 12) h += 12
  }
  if (h > 23 || min > 59) return INVALID
  return { ok: true, time: `${pad(h)}:${pad(min)}` }
}
```

- [ ] **Step 4: Run tests** — `npx vitest run src/domain/timeParse.test.ts` → all pass.

- [ ] **Step 5: Verify + commit**

```bash
npm run verify
git add src/domain/timeParse.ts src/domain/timeParse.test.ts
git commit -m "feat(domain): flexible time parsing (24h, compact, am/pm)"
```

---

### Task 6: Formatting (`src/domain/format.ts`)

Implements spec §6.3. `t` is passed in as a plain function so the domain stays independent of the i18n module.

**Files:**
- Create: `src/domain/format.ts`, `src/domain/format.test.ts`

**Interfaces:**
- Consumes: `zoneById`, `countryByCode`, `countryName`, `zoneLabel` (Task 3); `ConvertResult` (Task 4).
- Produces:
  ```ts
  export function formatTime(time: HHMM, hourFormat: HourFormat, locale: Locale): string
  export function formatDateLine(date: ISODate, locale: Locale): string          // "Mon, Aug 17"
  export function formatDateFull(date: ISODate, locale: Locale): string          // "Mon, Aug 17, 2026"
  export function dayOffsetKey(offset: -1 | 0 | 1): 'day.same' | 'day.next' | 'day.prev'
  export function copyText(a: { from: ZoneId; to: ZoneId; time: HHMM; result: ConvertResult; locale: Locale }): string
  export function recentLabel(e: { from: ZoneId; to: ZoneId; time: HHMM }, hourFormat: HourFormat, locale: Locale): string
  export function currentOffsetLabel(minutes: number): string                    // "UTC−6", "UTC+5:30" (display; uses U+2212 minus)
  ```

- [ ] **Step 1: Write the failing tests**

`src/domain/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { copyText, currentOffsetLabel, dayOffsetKey, formatDateFull, formatDateLine, formatTime, recentLabel } from './format'

describe('format', () => {
  it('formats time in 24h and 12h per locale', () => {
    expect(formatTime('15:30', '24h', 'en-US')).toBe('15:30')
    expect(formatTime('15:30', '12h', 'en-US')).toBe('3:30 PM')
    expect(formatTime('00:05', '12h', 'en-US')).toBe('12:05 AM')
    expect(formatTime('15:30', '12h', 'es-CR')).toBe('3:30 p. m.')
  })
  it('formats date lines per locale (never via UTC-string slicing)', () => {
    expect(formatDateLine('2026-08-17', 'en-US')).toBe('Mon, Aug 17')
    expect(formatDateLine('2026-08-17', 'es-CR')).toBe('lun, 17 ago')
    expect(formatDateFull('2026-08-17', 'en-US')).toBe('Mon, Aug 17, 2026')
  })
  it('maps day offsets to i18n keys', () => {
    expect(dayOffsetKey(0)).toBe('day.same')
    expect(dayOffsetKey(1)).toBe('day.next')
    expect(dayOffsetKey(-1)).toBe('day.prev')
  })
  it('builds the copy text (spec S2)', () => {
    const text = copyText({
      from: 'America/Denver', to: 'America/Costa_Rica', time: '15:30', locale: 'en-US',
      result: { date: '2026-08-17', time: '15:30', dayOffset: 0, fromOffset: '-06:00', toOffset: '-06:00' },
    })
    expect(text).toBe('15:30 Mountain Time (United States) → 15:30 Central Standard Time (Costa Rica) · Mon, Aug 17, 2026')
  })
  it('builds recent chip labels (flag + zone for multi-zone, flag + country otherwise)', () => {
    expect(recentLabel({ from: 'America/Denver', to: 'America/Costa_Rica', time: '15:30' }, '24h', 'en-US'))
      .toBe('15:30 🇺🇸 Mountain Time → 🇨🇷 Costa Rica')
    expect(recentLabel({ from: 'America/Costa_Rica', to: 'Asia/Kolkata', time: '20:00' }, '12h', 'en-US'))
      .toBe('8:00 PM 🇨🇷 Costa Rica → 🇮🇳 India')
  })
  it('labels current offsets compactly', () => {
    expect(currentOffsetLabel(-360)).toBe('UTC−6')
    expect(currentOffsetLabel(330)).toBe('UTC+5:30')
    expect(currentOffsetLabel(0)).toBe('UTC+0')
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/domain/format.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/domain/format.ts`:
```ts
import { countryByCode, countryName, zoneById, zoneLabel, type ZoneId } from './catalog'
import type { ConvertResult } from './tz'
import type { HHMM, HourFormat, ISODate, Locale } from './types'

function utcDate(date: ISODate, h = 12, min = 0): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, h, min))
}

export function formatTime(time: HHMM, hourFormat: HourFormat, locale: Locale): string {
  if (hourFormat === '24h') return time
  const [h, min] = time.split(':').map(Number)
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })
    .format(new Date(Date.UTC(2000, 0, 1, h, min)))
}

export function formatDateLine(date: ISODate, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(utcDate(date))
}

export function formatDateFull(date: ISODate, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(utcDate(date))
}

export function dayOffsetKey(offset: -1 | 0 | 1): 'day.same' | 'day.next' | 'day.prev' {
  return offset === 0 ? 'day.same' : offset > 0 ? 'day.next' : 'day.prev'
}

function zoneWithCountry(id: ZoneId, locale: Locale): string {
  const z = zoneById(id)
  return `${zoneLabel(z, locale)} (${countryName(z.country, locale)})`
}

export function copyText(a: { from: ZoneId; to: ZoneId; time: HHMM; result: ConvertResult; locale: Locale }): string {
  return `${a.time} ${zoneWithCountry(a.from, a.locale)} → ${a.result.time} ${zoneWithCountry(a.to, a.locale)} · ${formatDateFull(a.result.date, a.locale)}`
}

function chipSide(id: ZoneId, locale: Locale): string {
  const z = zoneById(id)
  const c = countryByCode(z.country)
  return `${c.flag} ${c.zones.length > 1 ? zoneLabel(z, locale) : countryName(c.code, locale)}`
}

export function recentLabel(e: { from: ZoneId; to: ZoneId; time: HHMM }, hourFormat: HourFormat, locale: Locale): string {
  return `${formatTime(e.time, hourFormat, locale)} ${chipSide(e.from, locale)} → ${chipSide(e.to, locale)}`
}

export function currentOffsetLabel(minutes: number): string {
  const sign = minutes < 0 ? '−' : '+'
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`
}
```

- [ ] **Step 4: Run tests** → pass. (If `'3:30 p. m.'` differs on your ICU, print `formatTime('15:30','12h','es-CR')` and use the runtime value — the spec requires `Intl` output, not a literal.)

- [ ] **Step 5: Verify + commit**

```bash
npm run verify
git add src/domain/format.ts src/domain/format.test.ts
git commit -m "feat(domain): locale-aware time/date/copy/recent formatting"
```

---

### Task 7: Search index (`src/domain/search.ts`)

Implements spec §4.3.

**Files:**
- Create: `src/domain/search.ts`, `src/domain/search.test.ts`

**Interfaces:**
- Consumes: `COUNTRIES`, `CONTINENTS`, `countryName`, `zoneLabel`, `pickerLabel`, `Zone`, `Continent` (Task 3); `currentOffsetLabel` is *not* used here (offset strings are built locally).
- Produces:
  ```ts
  export interface SearchEntry { zoneId: ZoneId; country: CountryCode; continent: Continent; label: string; haystack: string[] }
  export interface SearchGroup { key: 'pinned' | Continent; entries: SearchEntry[] }
  export interface SearchResult { groups: SearchGroup[]; truncated: boolean; total: number }
  export function normalize(s: string): string
  export function buildSearchIndex(locale: Locale): SearchEntry[]        // memoized per locale
  export function search(index: SearchEntry[], query: string, opts: { pinned: ZoneId[]; limit?: number }): SearchResult
  ```

- [ ] **Step 1: Write the failing tests**

`src/domain/search.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildSearchIndex, normalize, search } from './search'

const en = buildSearchIndex('en-US')
const es = buildSearchIndex('es-CR')
const rows = (r: ReturnType<typeof search>) => r.groups.flatMap((g) => g.entries.map((e) => e.zoneId))

describe('normalize', () => {
  it('strips diacritics, lowercases, collapses spaces', () => {
    expect(normalize('  São   Paulo ')).toBe('sao paulo')
    expect(normalize('Ürümqi')).toBe('urumqi')
  })
})

describe('buildSearchIndex', () => {
  it('has one entry per zone with a label and haystack', () => {
    const denver = en.find((e) => e.zoneId === 'America/Denver')!
    expect(denver.label).toBe('🇺🇸 United States · Mountain Time')
    expect(denver.haystack).toEqual(expect.arrayContaining(['united states', 'mountain time', 'denver', 'america/denver', 'america/boise', 'us', 'utc-7', '-7', 'utc-6', '-6']))
    expect(en.length).toBeGreaterThan(300)
  })
  it('is memoized per locale', () => {
    expect(buildSearchIndex('en-US')).toBe(en)
    expect(buildSearchIndex('es-CR')).not.toBe(en)
  })
})

describe('search', () => {
  it('empty query → pinned group first, then continents in order, countries A→Z', () => {
    const r = search(en, '', { pinned: ['America/Costa_Rica', 'America/Denver'] })
    expect(r.groups.map((g) => g.key)).toEqual(['pinned', 'AF', 'AM', 'AS', 'EU', 'OC'])
    expect(r.groups[0].entries.map((e) => e.zoneId)).toEqual(['America/Costa_Rica', 'America/Denver'])
    const eu = r.groups.find((g) => g.key === 'EU')!
    const names = eu.entries.map((e) => e.label)
    expect(names.indexOf(names.find((n) => n.includes('Albania'))!)).toBeLessThan(names.indexOf(names.find((n) => n.includes('Germany'))!))
    expect(r.truncated).toBe(false)
  })
  it('K1 "mou" finds the US Mountain zones', () => {
    const ids = rows(search(en, 'mou', { pinned: [] }))
    expect(ids).toContain('America/Denver')
    expect(ids).toContain('America/Phoenix')
    expect(ids.length).toBeLessThanOrEqual(50)
  })
  it('K2 city, localized name and offset queries', () => {
    expect(rows(search(en, 'denver', { pinned: [] }))[0]).toBe('America/Denver')
    expect(rows(search(es, 'alemania', { pinned: [] }))[0]).toBe('Europe/Berlin')
    expect(rows(search(en, 'germany', { pinned: [] }))[0]).toBe('Europe/Berlin')
    expect(rows(search(en, '+5:30', { pinned: [] }))).toContain('Asia/Kolkata')
    expect(rows(search(en, 'phil', { pinned: [] }))[0]).toBe('Asia/Manila')
  })
  it('all tokens must match; ranking prefers country-name prefix', () => {
    expect(rows(search(en, 'united mountain', { pinned: [] }))).toEqual(['America/Denver', 'America/Phoenix'])
    expect(rows(search(en, 'in', { pinned: [] }))[0]).toBe('Asia/Kolkata') // "India" prefix beats substrings like "Argentina"
  })
  it('caps results and reports truncation', () => {
    const r = search(en, 'a', { pinned: [], limit: 50 })
    expect(rows(r).length).toBe(50)
    expect(r.truncated).toBe(true)
    expect(r.total).toBeGreaterThan(50)
  })
  it('no matches → empty groups', () => {
    const r = search(en, 'zzzzqq', { pinned: [] })
    expect(r.groups).toEqual([])
    expect(r.total).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify failure** — FAIL (module not found).

- [ ] **Step 3: Implement**

`src/domain/search.ts`:
```ts
import { CONTINENTS, COUNTRIES, countryName, pickerLabel, zoneLabel, type Continent, type CountryCode, type ZoneId } from './catalog'
import type { Locale } from './types'

export interface SearchEntry {
  zoneId: ZoneId
  country: CountryCode
  continent: Continent
  label: string
  // Match tiers, kept separate so ranking never depends on positions inside a deduped array.
  countryNames: string[]
  zoneLabels: string[]
  cities: string[]
  extras: string[]        // id, aliases, country code, offset strings
  haystack: string[]      // union of the four above; backs the substring tier
}
export interface SearchGroup { key: 'pinned' | Continent; entries: SearchEntry[] }
export interface SearchResult { groups: SearchGroup[]; truncated: boolean; total: number }

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function offsetStrings(minutes: number): string[] {
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  const core = `${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${String(abs % 60).padStart(2, '0')}` : ''}`
  return [`utc${core}`, `gmt${core}`, core]
}

const dedupe = (xs: string[]) => [...new Set(xs.map(normalize))]

const indexCache = new Map<Locale, SearchEntry[]>()

export function buildSearchIndex(locale: Locale): SearchEntry[] {
  const cached = indexCache.get(locale)
  if (cached) return cached
  const entries: SearchEntry[] = []
  const countriesSorted = [...COUNTRIES].sort((a, b) =>
    CONTINENTS.indexOf(a.continent) - CONTINENTS.indexOf(b.continent) ||
    countryName(a.code, locale).localeCompare(countryName(b.code, locale), locale))
  for (const c of countriesSorted) {
    for (const z of c.zones) {
      const countryNames = dedupe([countryName(c.code, locale), countryName(c.code, 'en-US')])
      const zoneLabels = dedupe([zoneLabel(z, locale), zoneLabel(z, 'en-US')])
      const cities = dedupe([...z.cities])
      const extras = dedupe([z.id, ...z.aliases, c.code, ...offsetStrings(z.winter), ...offsetStrings(z.summer)])
      entries.push({
        zoneId: z.id,
        country: c.code,
        continent: c.continent,
        label: pickerLabel(z, locale),
        countryNames, zoneLabels, cities, extras,
        haystack: [...new Set([...countryNames, ...zoneLabels, ...cities, ...extras])],
      })
    }
  }
  indexCache.set(locale, entries)
  return entries
}

/** Lower is better: 0 country-name prefix · 1 zone-label prefix · 2 city prefix · 3 any substring. */
function score(e: SearchEntry, token: string): number {
  if (e.countryNames.some((h) => h.startsWith(token))) return 0
  if (e.zoneLabels.some((h) => h.startsWith(token))) return 1
  if (e.cities.some((h) => h.startsWith(token))) return 2
  if (e.haystack.some((h) => h.includes(token))) return 3
  return Infinity
}

export function search(index: SearchEntry[], query: string, opts: { pinned: ZoneId[]; limit?: number }): SearchResult {
  const limit = opts.limit ?? 50
  const q = normalize(query)
  if (q === '') {
    const byId = new Map(index.map((e) => [e.zoneId, e]))
    const pinned = opts.pinned.map((id) => byId.get(id)).filter((e): e is SearchEntry => Boolean(e))
    const groups: SearchGroup[] = pinned.length ? [{ key: 'pinned', entries: pinned }] : []
    // Pinned zones also stay in their continent group on purpose, so every continent list is complete.
    for (const c of CONTINENTS) {
      const entries = index.filter((e) => e.continent === c)
      if (entries.length) groups.push({ key: c, entries })
    }
    return { groups, truncated: false, total: index.length }
  }
  const tokens = q.split(' ')
  const scored: { e: SearchEntry; s: number; i: number }[] = []
  index.forEach((e, i) => {
    let s = 0
    for (const t of tokens) {
      const ts = score(e, t)
      if (ts === Infinity) return
      s = Math.max(s, ts)
    }
    scored.push({ e, s, i })
  })
  scored.sort((a, b) => a.s - b.s || a.i - b.i)
  const total = scored.length
  const kept = scored.slice(0, limit)
  // Groups are ordered by their best-ranked member, so the closest match is always the first row
  // of the first group. Continent grouping must never outrank relevance (spec §4.3 requires both).
  const byContinent = new Map<Continent, { best: number; entries: SearchEntry[] }>()
  for (const { e, s } of kept) {
    const g = byContinent.get(e.continent)
    if (g) g.entries.push(e)
    else byContinent.set(e.continent, { best: s, entries: [e] })
  }
  const groups: SearchGroup[] = [...byContinent.entries()]
    .sort((a, b) => a[1].best - b[1].best || CONTINENTS.indexOf(a[0]) - CONTINENTS.indexOf(b[0]))
    .map(([key, g]) => ({ key, entries: g.entries }))
  return { groups, truncated: total > limit, total }
}
```
- [ ] **Step 4: Run tests** — pass. If `'in'` ranking fails, check the score order: `India` (country prefix, 0) must beat `Argentina` (substring, 3).

- [ ] **Step 5: Verify + commit**

```bash
npm run verify
git add src/domain/search.ts src/domain/search.test.ts
git commit -m "feat(domain): normalized, ranked, grouped zone search index"
```

---

### Task 8: URL state codec (`src/domain/url.ts`)

Implements spec §6.4.

**Files:**
- Create: `src/domain/url.ts`, `src/domain/url.test.ts`

**Interfaces:**
- Consumes: `zoneForIana` (Task 3), `parseTime` (Task 5).
- Produces:
  ```ts
  export interface UrlState { time?: HHMM; date?: ISODate; from?: ZoneId; to?: ZoneId }
  export function encodeUrlState(s: { time: string; date: ISODate | null; from: ZoneId; to: ZoneId }): string  // "t=15:30&from=…&to=…" (no leading ?)
  export function decodeUrlState(search: string): UrlState  // accepts with/without leading ?, never throws
  ```

- [ ] **Step 1: Write the failing tests**

`src/domain/url.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { decodeUrlState, encodeUrlState } from './url'

describe('url codec', () => {
  it('encodes time/date/from/to, omitting empty time and null date', () => {
    expect(encodeUrlState({ time: '15:30', date: null, from: 'America/Denver', to: 'America/Costa_Rica' }))
      .toBe('t=15%3A30&from=America%2FDenver&to=America%2FCosta_Rica')
    expect(encodeUrlState({ time: '', date: '2026-01-15', from: 'America/Denver', to: 'America/Costa_Rica' }))
      .toBe('d=2026-01-15&from=America%2FDenver&to=America%2FCosta_Rica')
  })
  it('decodes both encoded and raw forms', () => {
    expect(decodeUrlState('?t=15:30&d=2026-08-17&from=America/Denver&to=America/Costa_Rica'))
      .toEqual({ time: '15:30', date: '2026-08-17', from: 'America/Denver', to: 'America/Costa_Rica' })
    expect(decodeUrlState('t=15%3A30&from=America%2FDenver&to=America%2FCosta_Rica'))
      .toEqual({ time: '15:30', from: 'America/Denver', to: 'America/Costa_Rica' })
  })
  it('normalizes aliases and drops invalid values individually', () => {
    expect(decodeUrlState('?from=America/Boise&to=Nowhere/Land&t=25:99&d=2026-13-40'))
      .toEqual({ from: 'America/Denver' })
    expect(decodeUrlState('?t=3pm')).toEqual({ time: '15:00' })
    expect(decodeUrlState('')).toEqual({})
    expect(decodeUrlState('?foo=bar')).toEqual({})
  })
  it('round-trips', () => {
    const q = encodeUrlState({ time: '20:00', date: '2026-08-17', from: 'America/Costa_Rica', to: 'Asia/Kolkata' })
    expect(decodeUrlState('?' + q)).toEqual({ time: '20:00', date: '2026-08-17', from: 'America/Costa_Rica', to: 'Asia/Kolkata' })
  })
})
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

`src/domain/url.ts`:
```ts
import { zoneForIana, type ZoneId } from './catalog'
import { parseTime } from './timeParse'
import type { HHMM, ISODate } from './types'

export interface UrlState { time?: HHMM; date?: ISODate; from?: ZoneId; to?: ZoneId }

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isValidISODate(s: string): s is ISODate {
  const m = ISO_DATE.exec(s)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

export function encodeUrlState(s: { time: string; date: ISODate | null; from: ZoneId; to: ZoneId }): string {
  const p = new URLSearchParams()
  if (s.time.trim() !== '') p.set('t', s.time.trim())
  if (s.date) p.set('d', s.date)
  p.set('from', s.from)
  p.set('to', s.to)
  return p.toString()
}

export function decodeUrlState(search: string): UrlState {
  const out: UrlState = {}
  let p: URLSearchParams
  try { p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search) } catch { return out }
  const t = p.get('t')
  if (t) { const r = parseTime(t); if (r.ok) out.time = r.time }
  const d = p.get('d')
  if (d && isValidISODate(d)) out.date = d
  const from = p.get('from')
  if (from) { const z = zoneForIana(from); if (z) out.from = z.id }
  const to = p.get('to')
  if (to) { const z = zoneForIana(to); if (z) out.to = z.id }
  return out
}
```

- [ ] **Step 4: Run tests** → pass. **Step 5: Verify + commit**

```bash
npm run verify
git add src/domain/url.ts src/domain/url.test.ts
git commit -m "feat(domain): shareable URL state codec with alias normalization"
```

---

### Task 9: i18n strings (`src/i18n/`)

Implements spec §9. Only UI chrome strings; names come from `Intl` (INV-6).

**Files:**
- Create: `src/i18n/en.ts`, `src/i18n/es.ts`, `src/i18n/index.ts`, `src/i18n/index.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type MessageKey = keyof typeof en
  export const LOCALE_OF: Record<Lang, Locale>          // { en: 'en-US', es: 'es-CR' }
  export function detectLang(navigatorLanguage: string | undefined): Lang
  export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string
  ```

- [ ] **Step 1: Write the failing tests**

`src/i18n/index.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { en } from './en'
import { es } from './es'
import { detectLang, LOCALE_OF, translate } from './index'

describe('i18n', () => {
  it('es has exactly the same keys as en', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort())
  })
  it('detects language from navigator.language', () => {
    expect(detectLang('es-CR')).toBe('es')
    expect(detectLang('es')).toBe('es')
    expect(detectLang('en-US')).toBe('en')
    expect(detectLang('fr-FR')).toBe('en')
    expect(detectLang(undefined)).toBe('en')
  })
  it('translates with variables', () => {
    expect(translate('en', 'from')).toBe('From')
    expect(translate('es', 'from')).toBe('Desde')
    expect(translate('en', 'picker.noMatches', { query: 'xyz' })).toBe('No matches for “xyz”')
    expect(LOCALE_OF.es).toBe('es-CR')
  })
})
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

`src/i18n/en.ts`:
```ts
export const en = {
  'app.title': 'Lazy Time Converter',
  'from': 'From',
  'to': 'To',
  'home': 'Home',
  'home.badge': 'Home time zone',
  'home.hint': 'We couldn’t match your time zone — pick your home zone:',
  'home.hint.dismiss': 'Dismiss',
  'swap': 'Swap direction',
  'now': 'Now',
  'now.here': 'now here {time}',
  'now.there': 'now there {time}',
  'time.label': 'Time',
  'time.placeholder.24h': '15:30',
  'time.placeholder.12h': '3:30 pm',
  'time.invalid': 'Enter a time like 15:30 or 3:30 pm',
  'date.pick': 'Pick a date',
  'date.today': 'Back to today',
  'day.same': 'same day',
  'day.next': 'next day (+1)',
  'day.prev': 'previous day (−1)',
  'result.label': 'Converted time',
  'copy': 'Copy result',
  'copy.done': 'Copied ✓',
  'share': 'Share link',
  'share.done': 'Link copied ✓',
  'recent': 'Recent',
  'recent.clear': 'Clear',
  'theme.light': 'Light theme',
  'theme.dark': 'Dark theme',
  'theme.system': 'System theme',
  'format.24h': '24h',
  'format.12h': '12h',
  'lang.en': 'EN',
  'lang.es': 'ES',
  'picker.placeholder': 'Search country or time zone…',
  'picker.pinned': 'Pinned',
  'picker.noMatches': 'No matches for “{query}”',
  'picker.keepTyping': 'Keep typing to narrow down…',
  'continent.AF': 'Africa',
  'continent.AM': 'Americas',
  'continent.AS': 'Asia',
  'continent.EU': 'Europe',
  'continent.OC': 'Oceania',
} as const
```
`src/i18n/es.ts`:
```ts
import type { en } from './en'

export const es: Record<keyof typeof en, string> = {
  'app.title': 'Lazy Time Converter',
  'from': 'Desde',
  'to': 'Hasta',
  'home': 'Casa',
  'home.badge': 'Zona horaria de casa',
  'home.hint': 'No pudimos detectar tu zona horaria — elige tu zona de casa:',
  'home.hint.dismiss': 'Cerrar',
  'swap': 'Invertir dirección',
  'now': 'Ahora',
  'now.here': 'ahora aquí {time}',
  'now.there': 'ahora allá {time}',
  'time.label': 'Hora',
  'time.placeholder.24h': '15:30',
  'time.placeholder.12h': '3:30 pm',
  'time.invalid': 'Escribe una hora como 15:30 o 3:30 pm',
  'date.pick': 'Elegir fecha',
  'date.today': 'Volver a hoy',
  'day.same': 'mismo día',
  'day.next': 'día siguiente (+1)',
  'day.prev': 'día anterior (−1)',
  'result.label': 'Hora convertida',
  'copy': 'Copiar resultado',
  'copy.done': 'Copiado ✓',
  'share': 'Compartir enlace',
  'share.done': 'Enlace copiado ✓',
  'recent': 'Recientes',
  'recent.clear': 'Limpiar',
  'theme.light': 'Tema claro',
  'theme.dark': 'Tema oscuro',
  'theme.system': 'Tema del sistema',
  'format.24h': '24h',
  'format.12h': '12h',
  'lang.en': 'EN',
  'lang.es': 'ES',
  'picker.placeholder': 'Busca país o zona horaria…',
  'picker.pinned': 'Fijados',
  'picker.noMatches': 'Sin resultados para “{query}”',
  'picker.keepTyping': 'Sigue escribiendo para acotar…',
  'continent.AF': 'África',
  'continent.AM': 'América',
  'continent.AS': 'Asia',
  'continent.EU': 'Europa',
  'continent.OC': 'Oceanía',
}
```
`src/i18n/index.ts`:
```ts
import type { Lang, Locale } from '../domain/types'
import { en } from './en'
import { es } from './es'

export type MessageKey = keyof typeof en
const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, es }
export const LOCALE_OF: Record<Lang, Locale> = { en: 'en-US', es: 'es-CR' }

export function detectLang(navigatorLanguage: string | undefined): Lang {
  return navigatorLanguage?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  const raw = MESSAGES[lang][key] ?? MESSAGES.en[key] ?? key
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : raw
}
```

- [ ] **Step 4: Run tests** → pass. **Step 5: Verify + commit**

```bash
npm run verify
git add src/i18n
git commit -m "feat(i18n): EN/ES UI strings and language detection"
```

---

### Task 10: Store (`src/store/clock.ts`, `src/store/converter.ts`)

Implements spec §7. The store never reads the browser environment itself: `main.tsx` (and the acceptance harness) call `bootstrap()` with the detected values, so tests are deterministic.

**Files:**
- Create: `src/store/clock.ts`, `src/store/converter.ts`, `src/store/converter.test.ts`

**Interfaces:**
- Consumes: `detectHomeZone`, `isZoneId`, `zoneForIana` (Task 3); `nowIn` (Task 4); `parseTime` (Task 5); `decodeUrlState` (Task 8); `detectLang` (Task 9).
- Produces:
  ```ts
  // clock.ts
  export const clock: { now: () => Date }
  // converter.ts
  export interface RecentEntry { from: ZoneId; to: ZoneId; time: HHMM; date: ISODate | null }
  export interface Prefs { hourFormat: HourFormat; lang: Lang; theme: Theme }
  export interface ConverterState {
    initialized: boolean; home: ZoneId; homeHint: boolean
    from: { zone: ZoneId; time: string; date: ISODate | null }; to: { zone: ZoneId }
    prefs: Prefs; recents: RecentEntry[]
    bootstrap(env: { browserIana?: string; navigatorLanguage?: string; search?: string }): void
    setFromZone(z: ZoneId): void; setToZone(z: ZoneId): void; setTime(raw: string): void; setDate(d: ISODate | null): void
    useNow(now: Date): void; swap(): void; setHome(z: ZoneId): void; dismissHomeHint(): void
    setPref<K extends keyof Prefs>(k: K, v: Prefs[K]): void
    commitRecent(): void; loadRecent(e: RecentEntry): void; clearRecents(): void
  }
  export const STORAGE_KEY = 'ltc:v1'
  export const DEFAULT_HOME = 'America/Costa_Rica'
  export const useConverterStore: UseBoundStore<StoreApi<ConverterState>>   // zustand hook
  export function initialConverterState(): Pick<ConverterState, 'initialized'|'home'|'homeHint'|'from'|'to'|'prefs'|'recents'>
  export function resetConverterStore(): void                                 // tests: clear storage + state
  export function pinnedZones(home: ZoneId, recents: readonly RecentEntry[]): ZoneId[]   // home + recents' zones, dedup, max 6
  export function selectPinned(s: ConverterState): ZoneId[]                    // test-facing wrapper over pinnedZones
  export function selectParsedTime(s: ConverterState): ReturnType<typeof parseTime>       // test-facing; components memoize parseTime themselves
  export function selectEffectiveDate(s: ConverterState, now: Date): ISODate   // s.from.date ?? today in from zone
  ```

- [ ] **Step 1: `clock.ts`**

```ts
// INV-1: the only place (besides hooks/useNow.ts) allowed to read ambient time.
export const clock = {
  now: (): Date => new Date(),
}
```

- [ ] **Step 2: Write the failing store tests**

`src/store/converter.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_HOME, resetConverterStore, selectEffectiveDate, selectPinned, STORAGE_KEY, useConverterStore } from './converter'

const s = () => useConverterStore.getState()

beforeEach(() => resetConverterStore())

describe('bootstrap', () => {
  it('detects home from the browser zone (alias-aware) and language, sets from=home, to=Denver', () => {
    s().bootstrap({ browserIana: 'America/Boise', navigatorLanguage: 'es-CR' })
    expect(s().home).toBe('America/Denver')
    expect(s().from.zone).toBe('America/Denver')
    expect(s().to.zone).toBe('America/Costa_Rica')
    expect(s().prefs.lang).toBe('es')
    expect(s().homeHint).toBe(false)
    expect(s().initialized).toBe(true)
  })
  it('falls back to Costa Rica with a hint when the zone is unknown; to=Denver', () => {
    s().bootstrap({ browserIana: 'Etc/UTC', navigatorLanguage: 'en-US' })
    expect(s().home).toBe(DEFAULT_HOME)
    expect(s().to.zone).toBe('America/Denver')
    expect(s().homeHint).toBe(true)
  })
  it('does not re-detect once initialized (persisted choice wins)', () => {
    s().bootstrap({ browserIana: 'America/Costa_Rica' })
    s().setHome('Asia/Kolkata')
    s().bootstrap({ browserIana: 'America/Denver' })
    expect(s().home).toBe('Asia/Kolkata')
  })
  it('applies URL state over persisted from/to and time/date', () => {
    s().bootstrap({ browserIana: 'America/Costa_Rica', search: '?t=15:30&d=2026-01-15&from=America/Boise&to=America/Costa_Rica' })
    expect(s().from).toEqual({ zone: 'America/Denver', time: '15:30', date: '2026-01-15' })
    expect(s().to.zone).toBe('America/Costa_Rica')
  })
})

describe('actions', () => {
  beforeEach(() => s().bootstrap({ browserIana: 'America/Costa_Rica' }))
  it('swap exchanges zones and keeps time/date', () => {
    s().setFromZone('America/Denver'); s().setToZone('America/Costa_Rica'); s().setTime('15:30')
    s().swap()
    expect(s().from.zone).toBe('America/Costa_Rica')
    expect(s().to.zone).toBe('America/Denver')
    expect(s().from.time).toBe('15:30')
  })
  it('useNow fills time and date from the from-zone clock', () => {
    s().setFromZone('America/Denver')
    s().useNow(new Date('2026-08-17T14:52:00Z'))
    expect(s().from.time).toBe('08:52')
    expect(s().from.date).toBe('2026-08-17')
  })
  it('effective date is today in the from zone when date is null', () => {
    s().setFromZone('Asia/Manila')
    expect(selectEffectiveDate(s(), new Date('2026-08-17T20:00:00Z'))).toBe('2026-08-18')
    s().setDate('2026-01-15')
    expect(selectEffectiveDate(s(), new Date('2026-08-17T20:00:00Z'))).toBe('2026-01-15')
  })
  it('setHome does not touch from/to', () => {
    s().setHome('Asia/Kolkata')
    expect(s().from.zone).toBe('America/Costa_Rica')
    expect(s().to.zone).toBe('America/Denver')
  })
  it('setPref updates a single pref', () => {
    s().setPref('hourFormat', '12h')
    expect(s().prefs).toMatchObject({ hourFormat: '12h', lang: 'en', theme: 'system' })
  })
})

describe('recents', () => {
  beforeEach(() => s().bootstrap({ browserIana: 'America/Costa_Rica' }))
  it('commitRecent ignores invalid/empty time, dedupes, keeps newest first, caps at 8', () => {
    s().commitRecent()
    expect(s().recents).toEqual([])
    s().setTime('25:99'); s().commitRecent()
    expect(s().recents).toEqual([])
    for (let i = 0; i < 9; i++) { s().setTime(`0${i}:00`); s().commitRecent() }
    expect(s().recents).toHaveLength(8)
    expect(s().recents[0].time).toBe('08:00')
    s().setTime('3:00'); s().commitRecent()  // duplicate of 03:00 → moves to front
    expect(s().recents[0].time).toBe('03:00')
    expect(s().recents.filter((r) => r.time === '03:00')).toHaveLength(1)
    expect(s().recents).toHaveLength(8)
  })
  it('loadRecent restores from/to/time/date and re-commits to the front', () => {
    s().setFromZone('America/Denver'); s().setTime('15:30'); s().commitRecent()
    s().setFromZone('Asia/Manila'); s().setTime('08:00'); s().commitRecent()
    s().loadRecent(s().recents[1])
    expect(s().from).toMatchObject({ zone: 'America/Denver', time: '15:30' })
    expect(s().recents[0]).toMatchObject({ from: 'America/Denver', time: '15:30' })
  })
  it('clearRecents empties the list; selectPinned = home + recents zones (max 6)', () => {
    s().setFromZone('America/Denver'); s().setTime('15:30'); s().commitRecent()
    expect(selectPinned(s())).toEqual(['America/Costa_Rica', 'America/Denver'])
    s().clearRecents()
    expect(s().recents).toEqual([])
    expect(selectPinned(s())).toEqual(['America/Costa_Rica'])
  })
})

describe('persistence', () => {
  it('persists home/from.zone/to.zone/prefs/recents/homeHint but not time/date', () => {
    s().bootstrap({ browserIana: 'America/Costa_Rica' })
    s().setFromZone('America/Denver'); s().setTime('15:30'); s().setDate('2026-01-15'); s().setPref('theme', 'dark')
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(raw.state.from).toEqual({ zone: 'America/Denver' })
    expect(raw.state.prefs.theme).toBe('dark')
    expect(raw.state.initialized).toBe(true)
    expect(raw.version).toBe(1)
  })
  it('drops unknown zones on rehydrate', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state: {
      initialized: true, home: 'Nowhere/Land', homeHint: false, from: { zone: 'America/Boise' }, to: { zone: 'Bogus/Zone' },
      prefs: { hourFormat: '24h', lang: 'en', theme: 'system' },
      recents: [{ from: 'America/Denver', to: 'Bogus/Zone', time: '10:00', date: null }, { from: 'America/Denver', to: 'America/Costa_Rica', time: '11:00', date: null }],
    } }))
    useConverterStore.persist.rehydrate()
    expect(s().home).toBe(DEFAULT_HOME)
    expect(s().from.zone).toBe('America/Denver')  // alias normalized
    expect(s().to.zone).toBe(DEFAULT_HOME)
    expect(s().recents).toEqual([{ from: 'America/Denver', to: 'America/Costa_Rica', time: '11:00', date: null }])
  })
})
```

- [ ] **Step 3: Run to verify failure** — FAIL.

- [ ] **Step 4: Implement**

`src/store/converter.ts`:
```ts
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { detectHomeZone, isZoneId, zoneForIana, type ZoneId } from '../domain/catalog'
import { parseTime } from '../domain/timeParse'
import { nowIn } from '../domain/tz'
import type { HHMM, HourFormat, ISODate, Lang, Theme } from '../domain/types'
import { decodeUrlState } from '../domain/url'
import { detectLang } from '../i18n'

export interface RecentEntry { from: ZoneId; to: ZoneId; time: HHMM; date: ISODate | null }
export interface Prefs { hourFormat: HourFormat; lang: Lang; theme: Theme }
export interface ConverterState {
  initialized: boolean
  home: ZoneId
  homeHint: boolean
  from: { zone: ZoneId; time: string; date: ISODate | null }
  to: { zone: ZoneId }
  prefs: Prefs
  recents: RecentEntry[]
  bootstrap(env: { browserIana?: string; navigatorLanguage?: string; search?: string }): void
  setFromZone(z: ZoneId): void
  setToZone(z: ZoneId): void
  setTime(raw: string): void
  setDate(d: ISODate | null): void
  useNow(now: Date): void
  swap(): void
  setHome(z: ZoneId): void
  dismissHomeHint(): void
  setPref<K extends keyof Prefs>(k: K, v: Prefs[K]): void
  commitRecent(): void
  loadRecent(e: RecentEntry): void
  clearRecents(): void
}

export const STORAGE_KEY = 'ltc:v1'
export const DEFAULT_HOME: ZoneId = 'America/Costa_Rica'
const DEFAULT_OTHER: ZoneId = 'America/Denver'
const MAX_RECENTS = 8
const MAX_PINNED = 6

export const initialConverterState = () => ({
  initialized: false,
  home: DEFAULT_HOME,
  homeHint: false,
  from: { zone: DEFAULT_HOME, time: '', date: null as ISODate | null },
  to: { zone: DEFAULT_OTHER },
  prefs: { hourFormat: '24h', lang: 'en', theme: 'system' } as Prefs,
  recents: [] as RecentEntry[],
})

const sameEntry = (a: RecentEntry, b: RecentEntry) => a.from === b.from && a.to === b.to && a.time === b.time && a.date === b.date

function pushRecent(recents: RecentEntry[], e: RecentEntry): RecentEntry[] {
  return [e, ...recents.filter((r) => !sameEntry(r, e))].slice(0, MAX_RECENTS)
}

/** Repair persisted zones after a catalog regeneration (INV-5). */
function safeZone(id: unknown, fallback: ZoneId): ZoneId {
  return typeof id === 'string' ? (zoneForIana(id)?.id ?? fallback) : fallback
}

export const useConverterStore = create<ConverterState>()(
  persist(
    (set, get) => ({
      ...initialConverterState(),

      bootstrap: ({ browserIana, navigatorLanguage, search }) => {
        if (!get().initialized) {
          const detected = detectHomeZone(browserIana)
          const home = detected ?? DEFAULT_HOME
          set({
            initialized: true,
            home,
            homeHint: !detected,
            from: { zone: home, time: '', date: null },
            to: { zone: home === DEFAULT_HOME ? DEFAULT_OTHER : DEFAULT_HOME },
            prefs: { ...get().prefs, lang: detectLang(navigatorLanguage) },
          })
        }
        if (search) {
          const u = decodeUrlState(search)
          set((s) => ({
            from: { zone: u.from ?? s.from.zone, time: u.time ?? s.from.time, date: u.date ?? s.from.date },
            to: { zone: u.to ?? s.to.zone },
          }))
        }
      },

      setFromZone: (zone) => set((s) => ({ from: { ...s.from, zone } })),
      setToZone: (zone) => set({ to: { zone } }),
      setTime: (time) => set((s) => ({ from: { ...s.from, time } })),
      setDate: (date) => set((s) => ({ from: { ...s.from, date } })),
      useNow: (now) => set((s) => {
        const n = nowIn(s.from.zone, now)
        return { from: { ...s.from, time: n.time, date: n.date } }
      }),
      swap: () => set((s) => ({ from: { ...s.from, zone: s.to.zone }, to: { zone: s.from.zone } })),
      setHome: (home) => set({ home, homeHint: false }),
      dismissHomeHint: () => set({ homeHint: false }),
      setPref: (k, v) => set((s) => ({ prefs: { ...s.prefs, [k]: v } })),

      commitRecent: () => {
        const s = get()
        const parsed = parseTime(s.from.time)
        if (!parsed.ok) return
        set({ recents: pushRecent(s.recents, { from: s.from.zone, to: s.to.zone, time: parsed.time, date: s.from.date }) })
      },
      loadRecent: (e) => set((s) => ({
        from: { zone: e.from, time: e.time, date: e.date },
        to: { zone: e.to },
        recents: pushRecent(s.recents, e),
      })),
      clearRecents: () => set({ recents: [] }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        initialized: s.initialized, home: s.home, homeHint: s.homeHint,
        from: { zone: s.from.zone }, to: { zone: s.to.zone },
        prefs: s.prefs, recents: s.recents,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ReturnType<typeof initialConverterState>> & { from?: { zone?: string }; to?: { zone?: string } }
        const home = safeZone(p.home, DEFAULT_HOME)
        const recents = (p.recents ?? []).filter((r) => isZoneId(r.from) && isZoneId(r.to))
        return {
          ...current,
          initialized: p.initialized ?? current.initialized,
          home,
          homeHint: p.homeHint ?? current.homeHint,
          from: { ...current.from, zone: safeZone(p.from?.zone, home) },
          to: { zone: safeZone(p.to?.zone, home) },
          prefs: { ...current.prefs, ...(p.prefs ?? {}) },
          recents,
        }
      },
    },
  ),
)

export function resetConverterStore(): void {
  localStorage.removeItem(STORAGE_KEY)
  useConverterStore.setState(initialConverterState())
}

/**
 * Pure helper. Components must call this through useMemo over `home` + `recents` rather than
 * passing `selectPinned` to `useConverterStore`: zustand 5 feeds the selector to
 * useSyncExternalStore, which requires a cached snapshot, and this builds a fresh array per call.
 */
export function pinnedZones(home: ZoneId, recents: readonly RecentEntry[]): ZoneId[] {
  const out: ZoneId[] = [home]
  for (const r of recents) for (const z of [r.from, r.to]) if (!out.includes(z) && out.length < MAX_PINNED) out.push(z)
  return out
}

/** Test-facing convenience over `pinnedZones`; never pass this to `useConverterStore`. */
export function selectPinned(s: ConverterState): ZoneId[] {
  return pinnedZones(s.home, s.recents)
}

/** Test-facing convenience; components memoize `parseTime(from.time)` themselves (see pinnedZones). */
export function selectParsedTime(s: ConverterState) {
  return parseTime(s.from.time)
}

export function selectEffectiveDate(s: ConverterState, now: Date): ISODate {
  return s.from.date ?? nowIn(s.from.zone, now).date
}
```

- [ ] **Step 5: Run tests** — `npx vitest run src/store` → all pass. If the "drops unknown zones on rehydrate" test fails because `merge` isn't invoked, call `useConverterStore.persist.rehydrate()` (already in the test) and check `merge` signature for your zustand version (`(persistedState: unknown, currentState: S) => S`).

- [ ] **Step 6: Verify + commit**

```bash
npm run verify
git add src/store
git commit -m "feat(store): persisted converter store with bootstrap, recents and zone repair"
```

---

### Task 11: Design tokens, global styles, and the `useT` / `useNow` / `useTheme` hooks

Implements spec §8.4 and the hook layer. Styles are plain CSS files imported once in `main.tsx`; components use CSS Modules that reference the tokens.

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`, `src/hooks/useT.ts`, `src/hooks/useNow.ts`, `src/hooks/useNow.test.ts`, `src/hooks/useTheme.ts`, `src/hooks/useTheme.test.ts`
- Modify: `src/main.tsx` (import the two CSS files)

**Interfaces:**
- Produces:
  ```ts
  export function useT(): (key: MessageKey, vars?: Record<string, string | number>) => string   // bound to prefs.lang
  export function useLocale(): Locale                                                            // LOCALE_OF[prefs.lang]
  export function useNow(intervalMs?: number): Date                                              // default 30_000; INV-1
  export function useTheme(): void                                                               // applies data-theme to <html>
  export function resolveTheme(pref: Theme, systemDark: boolean): 'light' | 'dark'
  ```

- [ ] **Step 1: Tokens and global CSS**

`src/styles/tokens.css`:
```css
:root, :root[data-theme='dark'] {
  --bg: #0e1016;
  --surface: #151823;
  --surface-home: linear-gradient(160deg, #171c33, #12222b);
  --border: #262b3a;
  --border-home: #2f3d66;
  --text: #e6e8ef;
  --text-muted: #a3a9bb;
  --accent-a: #7c8cff;
  --accent-b: #3ee0c8;
  --accent-gradient: linear-gradient(135deg, var(--accent-a), var(--accent-b));
  --result: #3ee0c8;
  --result-glow: 0 0 18px rgba(62, 224, 200, 0.35);
  --list-hover: #12222b;
  --danger: #ff7b7b;
  --font-ui: -apple-system, 'Inter', system-ui, sans-serif;
  --font-digits: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  --radius-card: 12px;
  --radius-control: 8px;
  --radius-pill: 999px;
  --digits-size: 56px;
  --shadow-pop: 0 12px 30px rgba(0, 0, 0, 0.6);
  color-scheme: dark;
}
:root[data-theme='light'] {
  --bg: #f5f6fa;
  --surface: #ffffff;
  --surface-home: #eaf7f4;
  --border: #e0e3ec;
  --border-home: #9fe3d6;
  --text: #1a1d2a;
  --text-muted: #5b6272;
  --result: #0f9d86;
  --result-glow: none;
  --list-hover: #eaf7f4;
  --danger: #c0392b;
  --shadow-pop: 0 12px 30px rgba(20, 24, 40, 0.18);
  color-scheme: light;
}
@media (max-width: 719.98px) {
  :root { --digits-size: 40px; }
}
```
`src/styles/global.css`:
```css
*, *::before, *::after { box-sizing: border-box; }
html, body, #root { margin: 0; min-height: 100%; }
body { background: var(--bg); color: var(--text); font-family: var(--font-ui); line-height: 1.4; -webkit-font-smoothing: antialiased; }
button, input, select { font: inherit; color: inherit; }
button { cursor: pointer; }
:focus-visible { outline: 2px solid var(--accent-b); outline-offset: 2px; }
.digits { font-family: var(--font-digits); font-variant-numeric: tabular-nums; font-weight: 600; letter-spacing: -0.04em; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```
In `src/main.tsx` add at the top: `import './styles/tokens.css'` and `import './styles/global.css'`.

- [ ] **Step 2: `useT.ts` (no test — thin binding; exercised by every component test)**

```ts
import { useCallback } from 'react'
import type { Locale } from '../domain/types'
import { LOCALE_OF, translate, type MessageKey } from '../i18n'
import { useConverterStore } from '../store/converter'

export function useT() {
  const lang = useConverterStore((s) => s.prefs.lang)
  return useCallback((key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang])
}
export function useLocale(): Locale {
  return LOCALE_OF[useConverterStore((s) => s.prefs.lang)]
}
```

- [ ] **Step 3: `useNow` test (red) then implementation**

`src/hooks/useNow.test.ts`:
```ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clock } from '../store/clock'
import { useNow } from './useNow'

describe('useNow', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())
  it('returns clock.now() and re-reads it every interval', () => {
    let t = new Date('2026-08-17T14:52:00Z')
    vi.spyOn(clock, 'now').mockImplementation(() => t)
    const { result } = renderHook(() => useNow(1000))
    expect(result.current.toISOString()).toBe('2026-08-17T14:52:00.000Z')
    t = new Date('2026-08-17T14:53:00Z')
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.toISOString()).toBe('2026-08-17T14:53:00.000Z')
  })
})
```
`src/hooks/useNow.ts`:
```ts
import { useEffect, useState } from 'react'
import { clock } from '../store/clock'

// INV-1: reads ambient time (via clock.now) on a timer so UI can tick.
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => clock.now())
  useEffect(() => {
    const id = setInterval(() => setNow(clock.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
```

- [ ] **Step 4: `useTheme` test (red) then implementation**

`src/hooks/useTheme.test.ts`:
```ts
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetConverterStore, useConverterStore } from '../store/converter'
import { resolveTheme, useTheme } from './useTheme'

describe('useTheme', () => {
  beforeEach(() => { resetConverterStore(); document.documentElement.removeAttribute('data-theme') })
  it('resolveTheme', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
  it('applies data-theme and follows the preference', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((q) => ({ matches: q.includes('dark'), media: q, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false }) as MediaQueryList)
    renderHook(() => useTheme())
    expect(document.documentElement.dataset.theme).toBe('dark') // system + dark OS
    // act(): React 19 does not flush external-store updates synchronously, so without it the
    // effect has not re-run when the next line asserts.
    act(() => { useConverterStore.getState().setPref('theme', 'light') })
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
```
`src/hooks/useTheme.ts`:
```ts
import { useEffect } from 'react'
import type { Theme } from '../domain/types'
import { useConverterStore } from '../store/converter'

export function resolveTheme(pref: Theme, systemDark: boolean): 'light' | 'dark' {
  return pref === 'system' ? (systemDark ? 'dark' : 'light') : pref
}

export function useTheme(): void {
  const pref = useConverterStore((s) => s.prefs.theme)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => { document.documentElement.dataset.theme = resolveTheme(pref, mq.matches) }
    apply()
    if (pref !== 'system') return
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [pref])
}
```
Note: `useTheme` must be called by `App` (Task 16). `renderHook` uses the same store singleton — the second assertion works because `setPref` triggers a re-render of the hook.

- [ ] **Step 5: Verify + commit**

```bash
npm run verify
git add src/styles src/hooks src/main.tsx
git commit -m "feat(ui): design tokens, global styles, useT/useNow/useTheme hooks"
```

---

### Task 12: Acceptance test harness (`src/acceptance/harness.tsx`)

The ATDD backbone: renders the real `<App/>` with a frozen clock, a chosen browser zone, optional URL and language, and offers helpers that speak the spec's vocabulary. Written now, used by every UI task from Task 13 on. It compiles against the *final* `App` (Task 16); until then, acceptance files that use it are added task by task.

**Files:**
- Create: `src/acceptance/harness.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface RenderOpts { browserIana?: string; navigatorLanguage?: string; now?: string; search?: string; keepStorage?: boolean }
  export function renderApp(opts?: RenderOpts): { user: UserEvent } & RenderResult
  export function reloadApp(opts?: RenderOpts): Promise<{ user: UserEvent } & RenderResult>  // unmount, rehydrate from localStorage, render again
  export function picker(which: 'from' | 'to' | 'home'): HTMLInputElement
  export async function pickZone(user: UserEvent, which: 'from' | 'to' | 'home', query: string, optionText: string | RegExp): Promise<void>
  export async function typeTime(user: UserEvent, text: string): Promise<void>
  export function timeInput(): HTMLInputElement
  export function resultTime(): string          // text of [data-testid=result-time]
  export function resultDate(): string          // text of [data-testid=result-date]
  export function nowLine(which: 'from' | 'to'): string
  export function clipboardText(): string       // last navigator.clipboard.writeText argument
  ```

- [ ] **Step 1: Write the harness**

```tsx
import { cleanup, render, screen, within, type RenderResult } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { vi } from 'vitest'
import App from '../App'
import { clock } from '../store/clock'
import { initialConverterState, resetConverterStore, STORAGE_KEY, useConverterStore } from '../store/converter'

export interface RenderOpts { browserIana?: string; navigatorLanguage?: string; now?: string; search?: string; keepStorage?: boolean }

const DEFAULTS = { browserIana: 'America/Costa_Rica', navigatorLanguage: 'en-US', now: '2026-08-17T14:52:00Z', search: '' }

function freezeClock(iso: string) {
  vi.spyOn(clock, 'now').mockImplementation(() => new Date(iso))
}

export function renderApp(opts: RenderOpts = {}): { user: UserEvent } & RenderResult {
  const o = { ...DEFAULTS, ...opts }
  cleanup() // a test may render the app twice (e.g. opening a shared URL); never leave two trees mounted
  freezeClock(o.now)
  if (!o.keepStorage) resetConverterStore()
  useConverterStore.getState().bootstrap({ browserIana: o.browserIana, navigatorLanguage: o.navigatorLanguage, search: o.search })
  const user = userEvent.setup()
  return { user, ...render(<App />) }
}

/**
 * Simulates a page reload: fresh in-memory state, untouched storage, rehydrate, bootstrap, render.
 * The saved payload is captured and restored around the reset because zustand's persist middleware
 * writes on every setState — resetting first would overwrite storage with defaults and rehydrate
 * would read those defaults back, silently destroying the state under test.
 */
export async function reloadApp(opts: RenderOpts = {}): Promise<{ user: UserEvent } & RenderResult> {
  cleanup()
  const saved = localStorage.getItem(STORAGE_KEY)
  useConverterStore.setState(initialConverterState())
  if (saved === null) localStorage.removeItem(STORAGE_KEY)
  else localStorage.setItem(STORAGE_KEY, saved)
  await useConverterStore.persist.rehydrate()
  return renderApp({ ...opts, keepStorage: true })
}

const PICKER_LABEL: Record<'from' | 'to' | 'home', RegExp> = { from: /^(from|desde)$/i, to: /^(to|hasta)$/i, home: /home time zone|zona horaria de casa/i }

/** First match wins: while the home-hint banner is visible there are two "home" pickers (header + banner). */
export function picker(which: 'from' | 'to' | 'home'): HTMLInputElement {
  return screen.getAllByRole('combobox', { name: PICKER_LABEL[which] })[0] as HTMLInputElement
}

export async function pickZone(user: UserEvent, which: 'from' | 'to' | 'home', query: string, optionText: string | RegExp): Promise<void> {
  const input = picker(which)
  await user.click(input)
  if (query) await user.type(input, query)
  const list = screen.getByRole('listbox')
  await user.click(within(list).getByRole('option', { name: optionText }))
}

export function timeInput(): HTMLInputElement {
  return screen.getByRole('textbox', { name: /^(time|hora)$/i }) as HTMLInputElement
}
export async function typeTime(user: UserEvent, text: string): Promise<void> {
  const input = timeInput()
  await user.clear(input)
  await user.type(input, text)
}

export const resultTime = () => screen.getByTestId('result-time').textContent ?? ''
export const resultDate = () => screen.getByTestId('result-date').textContent ?? ''
export const nowLine = (which: 'from' | 'to') => screen.getByTestId(`now-${which}`).textContent ?? ''

export function clipboardText(): string {
  const fn = navigator.clipboard.writeText as unknown as { mock: { calls: string[][] } }
  return fn.mock.calls.at(-1)?.[0] ?? ''
}
```

- [ ] **Step 2: Typecheck only** (there is nothing to run yet): `npm run typecheck` → passes (the placeholder `App` still exists).

- [ ] **Step 3: Commit**

```bash
git add src/acceptance/harness.tsx
git commit -m "test(acceptance): App render harness with frozen clock and spec-vocabulary helpers"
```

---

### Task 13: ZonePicker — searchable combobox

Implements spec §8.2. Written outside-in: acceptance scenarios K1–K4 first (red until Task 16 wires the App; they are committed now and stay red only if you run them individually — `npm run verify` must stay green, so **the acceptance file is added in Task 16**; here we write the component test), then component tests, then the component.

**Files:**
- Create: `src/components/ZonePicker/ZonePicker.tsx`, `src/components/ZonePicker/ZonePicker.module.css`, `src/components/ZonePicker/ZonePicker.test.tsx`

**Interfaces:**
- Consumes: `buildSearchIndex`, `search`, `SearchEntry` (Task 7); `zoneById`, `pickerLabel`, `Continent` (Task 3); `offsetAt` (Task 4); `currentOffsetLabel` (Task 6); `MessageKey` (Task 9).
- Produces:
  ```tsx
  export interface ZonePickerProps {
    id: string; label: string; value: ZoneId; onChange: (z: ZoneId) => void
    locale: Locale; pinned: ZoneId[]; now: Date
    t: (key: MessageKey, vars?: Record<string, string | number>) => string
    inputRef?: React.RefObject<HTMLInputElement | null>
    hideLabel?: boolean
  }
  export function ZonePicker(props: ZonePickerProps): JSX.Element
  ```
  DOM contract: `<input role="combobox" aria-expanded aria-controls aria-activedescendant aria-autocomplete="list">`, `<ul role="listbox">` with `<li role="group" aria-label>` containing `<li role="option" aria-selected id="{id}-opt-{index}">`. Closed value = `pickerLabel(value)`. Offset badge `data-testid="{id}-offset"`.

- [ ] **Step 1: Component tests (red)**

`src/components/ZonePicker/ZonePicker.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { translate } from '../../i18n'
import { ZonePicker } from './ZonePicker'

const NOW = new Date('2026-08-17T14:52:00Z')
const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate('en', k, v)

function Harness({ initial = 'America/Costa_Rica', onChange = vi.fn() }: { initial?: string; onChange?: (z: string) => void }) {
  const [value, setValue] = useState(initial)
  return <ZonePicker id="from-zone" label="From" value={value} onChange={(z) => { setValue(z); onChange(z) }} locale="en-US" pinned={['America/Costa_Rica']} now={NOW} t={t} />
}

describe('ZonePicker', () => {
  it('shows the selected zone label, current offset, and is closed', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox', { name: 'From' })
    expect(input).toHaveValue('🇨🇷 Costa Rica')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('from-zone-offset')).toHaveTextContent('UTC−6')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
  it('opens on click with pinned + continent groups, and marks the selected option', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('combobox'))
    const list = screen.getByRole('listbox')
    const groups = within(list).getAllByRole('group').map((g) => g.getAttribute('aria-label'))
    expect(groups).toEqual(['Pinned', 'Africa', 'Americas', 'Asia', 'Europe', 'Oceania'])
    expect(within(list).getAllByRole('option', { name: '🇨🇷 Costa Rica' })[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('combobox')).toHaveValue('')
  })
  it('filters while typing and selects with click', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, 'mou')
    const list = screen.getByRole('listbox')
    expect(within(list).getByRole('option', { name: '🇺🇸 United States · Mountain Time' })).toBeInTheDocument()
    expect(within(list).getAllByRole('option').length).toBeLessThanOrEqual(50)
    await user.click(within(list).getByRole('option', { name: '🇺🇸 United States · Mountain Time' }))
    expect(onChange).toHaveBeenCalledWith('America/Denver')
    expect(input).toHaveValue('🇺🇸 United States · Mountain Time')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
  it('keyboard: ArrowDown/Enter selects; Escape restores; aria-activedescendant tracks', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, 'phil')
    await user.keyboard('{ArrowDown}')
    const active = input.getAttribute('aria-activedescendant')!
    expect(document.getElementById(active)).toHaveTextContent('Philippines')
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('Asia/Manila')
    await user.click(input)
    await user.type(input, 'jap')
    await user.keyboard('{Escape}')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(input).toHaveValue('🇵🇭 Philippines')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
  it('shows a no-matches row and a keep-typing hint when truncated', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, 'zzzzqq')
    expect(screen.getByText('No matches for “zzzzqq”')).toBeInTheDocument()
    await user.clear(input)
    await user.type(input, 'a')
    expect(screen.getByText('Keep typing to narrow down…')).toBeInTheDocument()
  })
  it('lists 8 US zones and no zone suffix for single-zone countries', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('combobox'))
    const list = screen.getByRole('listbox')
    expect(within(list).getAllByRole('option', { name: /^🇺🇸 United States · / })).toHaveLength(8)
    expect(within(list).getAllByRole('option', { name: '🇮🇳 India' }).length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run to verify failure** — FAIL (module not found).

- [ ] **Step 3: Implement the component**

`src/components/ZonePicker/ZonePicker.module.css`:
```css
.root { position: relative; display: flex; flex-direction: column; gap: 4px; }
.label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); }
.field { display: flex; align-items: center; gap: 8px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-control); padding: 0 10px; }
.field:focus-within { border-color: var(--accent-b); }
.input { flex: 1; min-width: 0; background: transparent; border: 0; padding: 10px 0; outline: none; text-overflow: ellipsis; }
.offset { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
.list { position: absolute; z-index: 20; top: calc(100% + 4px); left: 0; right: 0; max-height: 320px; overflow: auto; margin: 0; padding: 6px; list-style: none; background: var(--surface); border: 1px solid var(--accent-b); border-radius: 10px; box-shadow: var(--shadow-pop); }
.group { list-style: none; padding: 0; margin: 0; }
.groupLabel { position: sticky; top: 0; background: var(--surface); font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); padding: 8px 8px 2px; }
.option { display: flex; justify-content: space-between; gap: 8px; padding: 7px 8px; border-radius: 6px; cursor: pointer; }
.option[aria-selected='true'], .option.active { background: var(--list-hover); color: var(--accent-b); }
.optionOffset { color: var(--text-muted); font-size: 12px; }
.hint { padding: 8px; color: var(--text-muted); font-size: 12px; }
@media (max-width: 719.98px) {
  .list { position: fixed; top: auto; bottom: 0; left: 0; right: 0; max-height: 70vh; border-radius: 16px 16px 0 0; }
}
```

`src/components/ZonePicker/ZonePicker.tsx`:
```tsx
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { pickerLabel, zoneById, type Continent, type ZoneId } from '../../domain/catalog'
import { currentOffsetLabel } from '../../domain/format'
import { buildSearchIndex, search, type SearchEntry } from '../../domain/search'
import { offsetAt } from '../../domain/tz'
import type { Locale } from '../../domain/types'
import type { MessageKey } from '../../i18n'
import styles from './ZonePicker.module.css'

export interface ZonePickerProps {
  id: string
  label: string
  value: ZoneId
  onChange: (z: ZoneId) => void
  locale: Locale
  pinned: ZoneId[]
  now: Date
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
  inputRef?: RefObject<HTMLInputElement | null>
  hideLabel?: boolean
}

interface IndexedEntry { entry: SearchEntry; index: number }
interface IndexedGroup { key: 'pinned' | Continent; label: string; entries: IndexedEntry[] }

export function ZonePicker({ id, label, value, onChange, locale, pinned, now, t, inputRef, hideLabel }: ZonePickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const localRef = useRef<HTMLInputElement | null>(null)
  const ref = inputRef ?? localRef
  const listId = `${id}-listbox`
  const labelId = useId()

  const index = useMemo(() => buildSearchIndex(locale), [locale])
  const result = useMemo(() => search(index, query, { pinned }), [index, query, pinned])

  // Flatten groups once: `options[i]` is the i-th option in DOM order, so keyboard navigation is a plain index.
  const { groups, options } = useMemo(() => {
    const options: SearchEntry[] = []
    const groups: IndexedGroup[] = result.groups.map((g) => ({
      key: g.key,
      label: g.key === 'pinned' ? t('picker.pinned') : t(`continent.${g.key}` as MessageKey),
      entries: g.entries.map((entry) => ({ entry, index: options.push(entry) - 1 })),
    }))
    return { groups, options }
  }, [result, t])

  const selectedLabel = pickerLabel(zoneById(value), locale)
  const offsetLabel = currentOffsetLabel(offsetAt(value, now.getTime()))
  const optId = (i: number) => `${id}-opt-${i}`

  useEffect(() => {
    if (!open) return
    const i = options.findIndex((o) => o.zoneId === value)
    setActive(i >= 0 ? i : 0)
  }, [open, options, value])

  useEffect(() => {
    if (open) document.getElementById(optId(active))?.scrollIntoView({ block: 'nearest' })
  }, [active, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const openList = () => { if (!open) { setQuery(''); setOpen(true) } }
  const close = () => { setOpen(false); setQuery('') }
  const select = (e: SearchEntry) => { onChange(e.zoneId); close() }

  const onKeyDown = (ev: KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (ev.key === 'ArrowDown' || ev.key === 'Enter' || (ev.key.length === 1 && !ev.metaKey && !ev.ctrlKey)) openList()
      return
    }
    switch (ev.key) {
      case 'ArrowDown': ev.preventDefault(); setActive((a) => (options.length ? (a + 1) % options.length : 0)); break
      case 'ArrowUp': ev.preventDefault(); setActive((a) => (options.length ? (a - 1 + options.length) % options.length : 0)); break
      case 'Home': ev.preventDefault(); setActive(0); break
      case 'End': ev.preventDefault(); setActive(Math.max(0, options.length - 1)); break
      case 'Enter': ev.preventDefault(); if (options[active]) select(options[active]); break
      case 'Escape': ev.preventDefault(); close(); break
      case 'Tab': close(); break
    }
  }

  return (
    <div className={styles.root}>
      <label id={labelId} htmlFor={id} className={hideLabel ? 'sr-only' : styles.label}>{label}</label>
      <div className={styles.field}>
        <input
          id={id}
          ref={ref}
          className={styles.input}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options.length ? optId(active) : undefined}
          autoComplete="off"
          spellCheck={false}
          value={open ? query : selectedLabel}
          placeholder={open ? t('picker.placeholder') : undefined}
          onFocus={openList}
          onClick={openList}
          onChange={(e) => { setQuery(e.target.value); setActive(0) }}
          onKeyDown={onKeyDown}
          onBlur={close}
        />
        {/* aria-hidden: the offset must stay out of the field's and each option's accessible name,
            which every test and every screen-reader announcement matches on exactly. */}
        <span className={styles.offset} data-testid={`${id}-offset`} aria-hidden="true">{offsetLabel}</span>
      </div>
      {open && (
        <ul id={listId} role="listbox" aria-labelledby={labelId} className={styles.list}>
          {groups.length === 0 && <li className={styles.hint} aria-live="polite">{t('picker.noMatches', { query })}</li>}
          {groups.map((g) => (
            <li key={g.key} role="group" aria-label={g.label}>
              <div className={styles.groupLabel} aria-hidden="true">{g.label}</div>
              <ul className={styles.group}>
                {g.entries.map(({ entry, index }) => (
                  <li
                    key={`${g.key}-${entry.zoneId}`}
                    id={optId(index)}
                    role="option"
                    aria-selected={entry.zoneId === value}
                    className={`${styles.option} ${index === active ? styles.active : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => select(entry)}
                  >
                    <span>{entry.label}</span>
                    <span className={styles.optionOffset} aria-hidden="true">{currentOffsetLabel(offsetAt(entry.zoneId, now.getTime()))}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
          {result.truncated && <li className={styles.hint}>{t('picker.keepTyping')}</li>}
        </ul>
      )}
    </div>
  )
}
```
Note: `<ul>` nested inside `<li role="group">` is the WAI-ARIA-recommended grouping for listboxes; the inner `<ul>` has no role so options remain direct children of the group in the accessibility tree.

- [ ] **Step 4: Run tests** — `npx vitest run src/components/ZonePicker` → all pass. Common failures: (a) `onBlur` closing before the option `onClick` fires — the `onMouseDown={e => e.preventDefault()}` prevents focus loss; keep it. (b) `scrollIntoView` undefined — the setup stub covers it.

- [ ] **Step 5: Verify + commit**

```bash
npm run verify
git add src/components/ZonePicker
git commit -m "feat(picker): accessible searchable country·zone combobox"
```

---

### Task 14: TimeInput and DateRow

Implements spec §8.3 (TimeInput, DateRow). Both bind directly to the store.

**Files:**
- Create: `src/components/TimeInput/TimeInput.tsx`, `src/components/TimeInput/TimeInput.module.css`, `src/components/TimeInput/TimeInput.test.tsx`, `src/components/DateRow/DateRow.tsx`, `src/components/DateRow/DateRow.module.css`, `src/components/DateRow/DateRow.test.tsx`

**Interfaces:**
- Consumes: store actions `setTime`, `commitRecent`, `setDate`, `useNow`; selectors `selectParsedTime`, `selectEffectiveDate`; `formatDateLine`, `formatTime`; `useT`, `useLocale`, `useNow`; `clock`.
- Produces: `TimeInput()` — `<input role="textbox" aria-label={t('time.label')} inputMode="numeric">` + error `<p id="…-error" role="alert">`; `DateRow()` — `<span data-testid="date-line">`, 📅 `<button aria-label={t('date.pick')}>` toggling `<input type="date" aria-label={t('date.pick')}>`, × `<button aria-label={t('date.today')}>` when explicit date, `<button>{t('now')}</button>`.

- [ ] **Step 1: TimeInput test (red)**

`src/components/TimeInput/TimeInput.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetConverterStore, useConverterStore } from '../../store/converter'
import { TimeInput } from './TimeInput'

beforeEach(() => { resetConverterStore(); useConverterStore.getState().bootstrap({ browserIana: 'America/Costa_Rica' }) })

describe('TimeInput', () => {
  it('writes raw text to the store and shows no error while empty', async () => {
    const user = userEvent.setup()
    render(<TimeInput />)
    const input = screen.getByRole('textbox', { name: 'Time' })
    expect(input).toHaveAttribute('placeholder', '15:30')
    await user.type(input, '3:30 pm')
    expect(useConverterStore.getState().from.time).toBe('3:30 pm')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('flags invalid input with aria-invalid and a message', async () => {
    const user = userEvent.setup()
    render(<TimeInput />)
    const input = screen.getByRole('textbox', { name: 'Time' })
    await user.type(input, '25:99')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a time like 15:30 or 3:30 pm')
  })
  it('commits a recent on Enter and on blur when valid', async () => {
    const user = userEvent.setup()
    render(<TimeInput />)
    const input = screen.getByRole('textbox', { name: 'Time' })
    await user.type(input, '15:30{Enter}')
    expect(useConverterStore.getState().recents).toHaveLength(1)
    await user.clear(input)
    await user.type(input, '16:00')
    await user.tab()
    expect(useConverterStore.getState().recents[0].time).toBe('16:00')
  })
  it('uses the 12h placeholder when hourFormat is 12h', () => {
    useConverterStore.getState().setPref('hourFormat', '12h')
    render(<TimeInput />)
    expect(screen.getByRole('textbox', { name: 'Time' })).toHaveAttribute('placeholder', '3:30 pm')
  })
})
```

- [ ] **Step 2: TimeInput implementation**

`src/components/TimeInput/TimeInput.module.css`:
```css
.wrap { display: flex; flex-direction: column; gap: 4px; }
.label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); }
.input { width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-control); padding: 8px 12px; font-size: var(--digits-size); line-height: 1.1; }
.input:focus { border-color: var(--accent-b); outline: none; }
.input[aria-invalid='true'] { border-color: var(--danger); }
.error { margin: 0; font-size: 12px; color: var(--danger); }
```
`src/components/TimeInput/TimeInput.tsx`:
```tsx
import { useId, useMemo } from 'react'
import { parseTime } from '../../domain/timeParse'
import { useT } from '../../hooks/useT'
import { useConverterStore } from '../../store/converter'
import styles from './TimeInput.module.css'

export function TimeInput() {
  const t = useT()
  const id = useId()
  const time = useConverterStore((s) => s.from.time)
  const hourFormat = useConverterStore((s) => s.prefs.hourFormat)
  // Derived outside the store subscription: parseTime returns a fresh object, which zustand 5
  // would treat as a changed snapshot on every render.
  const parsed = useMemo(() => parseTime(time), [time])
  const setTime = useConverterStore((s) => s.setTime)
  const commitRecent = useConverterStore((s) => s.commitRecent)
  const invalid = !parsed.ok && parsed.reason === 'invalid'
  return (
    <div className={styles.wrap}>
      <label htmlFor={id} className={styles.label}>{t('time.label')}</label>
      <input
        id={id}
        className={`${styles.input} digits`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={t(hourFormat === '12h' ? 'time.placeholder.12h' : 'time.placeholder.24h')}
        value={time}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={(e) => setTime(e.target.value)}
        onBlur={commitRecent}
        onKeyDown={(e) => { if (e.key === 'Enter') commitRecent() }}
      />
      {invalid && <p id={`${id}-error`} role="alert" className={styles.error}>{t('time.invalid')}</p>}
    </div>
  )
}
```
Run `npx vitest run src/components/TimeInput` → pass.

- [ ] **Step 3: DateRow test (red)**

`src/components/DateRow/DateRow.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clock } from '../../store/clock'
import { resetConverterStore, useConverterStore } from '../../store/converter'
import { DateRow } from './DateRow'

beforeEach(() => {
  resetConverterStore()
  vi.spyOn(clock, 'now').mockImplementation(() => new Date('2026-08-17T14:52:00Z'))
  useConverterStore.getState().bootstrap({ browserIana: 'America/Costa_Rica' })
  useConverterStore.getState().setFromZone('America/Denver')
})

describe('DateRow', () => {
  it('shows today in the from-zone by default and no reset button', () => {
    render(<DateRow />)
    expect(screen.getByTestId('date-line')).toHaveTextContent('Mon, Aug 17')
    expect(screen.queryByRole('button', { name: 'Back to today' })).not.toBeInTheDocument()
  })
  it('opens a native date input, sets an explicit date, and can reset to today', async () => {
    const user = userEvent.setup()
    render(<DateRow />)
    await user.click(screen.getByRole('button', { name: 'Pick a date' }))
    const dateInput = screen.getByLabelText('Pick a date', { selector: 'input' })
    await user.clear(dateInput)
    await user.type(dateInput, '2026-01-15')
    expect(useConverterStore.getState().from.date).toBe('2026-01-15')
    expect(screen.getByTestId('date-line')).toHaveTextContent('Thu, Jan 15')
    await user.click(screen.getByRole('button', { name: 'Back to today' }))
    expect(useConverterStore.getState().from.date).toBeNull()
  })
  it('Now fills time and date from the from-zone clock and commits a recent', async () => {
    const user = userEvent.setup()
    render(<DateRow />)
    await user.click(screen.getByRole('button', { name: 'Now' }))
    expect(useConverterStore.getState().from).toMatchObject({ time: '08:52', date: '2026-08-17' })
    expect(useConverterStore.getState().recents).toHaveLength(1)
  })
})
```

- [ ] **Step 4: DateRow implementation**

`src/components/DateRow/DateRow.module.css`:
```css
.row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; color: var(--text-muted); }
.btn { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-control); padding: 4px 10px; font-size: 12px; color: var(--text); }
.btn:hover { border-color: var(--accent-b); }
.date { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-control); padding: 4px 8px; }
```
`src/components/DateRow/DateRow.tsx`:
```tsx
import { useState } from 'react'
import { formatDateLine } from '../../domain/format'
import { useNow } from '../../hooks/useNow'
import { useLocale, useT } from '../../hooks/useT'
import { clock } from '../../store/clock'
import { selectEffectiveDate, useConverterStore } from '../../store/converter'
import styles from './DateRow.module.css'

export function DateRow() {
  const t = useT()
  const locale = useLocale()
  const now = useNow()
  const explicit = useConverterStore((s) => s.from.date)
  const effective = useConverterStore((s) => selectEffectiveDate(s, now))
  const setDate = useConverterStore((s) => s.setDate)
  const useNowAction = useConverterStore((s) => s.useNow)
  const commitRecent = useConverterStore((s) => s.commitRecent)
  const [editing, setEditing] = useState(false)
  return (
    <div className={styles.row}>
      <span data-testid="date-line">{formatDateLine(effective, locale)}</span>
      <button type="button" className={styles.btn} aria-label={t('date.pick')} aria-expanded={editing} onClick={() => setEditing((v) => !v)}>📅</button>
      {editing && (
        <input
          className={styles.date}
          type="date"
          aria-label={t('date.pick')}
          value={explicit ?? effective}
          onChange={(e) => setDate(e.target.value || null)}
        />
      )}
      {explicit && <button type="button" className={styles.btn} aria-label={t('date.today')} onClick={() => { setDate(null); setEditing(false) }}>×</button>}
      <button type="button" className={styles.btn} onClick={() => { useNowAction(clock.now()); commitRecent() }}>{t('now')}</button>
    </div>
  )
}
```
Run `npx vitest run src/components/DateRow` → pass. If `user.type` on `type="date"` misbehaves in jsdom, use `fireEvent.change(dateInput, { target: { value: '2026-01-15' } })` from `@testing-library/react` instead — the behaviour under test is the store update, not keystroke emulation.

- [ ] **Step 5: Verify + commit**

```bash
npm run verify
git add src/components/TimeInput src/components/DateRow
git commit -m "feat(ui): TimeInput with validation and DateRow with date picker + Now"
```

---

### Task 15: ResultDisplay, NowLine, SwapButton

Implements spec §8.3 (ResultDisplay, NowLine) and the swap control.

**Files:**
- Create: `src/components/ResultDisplay/ResultDisplay.tsx`, `src/components/ResultDisplay/ResultDisplay.module.css`, `src/components/ResultDisplay/ResultDisplay.test.tsx`, `src/components/NowLine/NowLine.tsx`, `src/components/NowLine/NowLine.test.tsx`, `src/components/SwapButton/SwapButton.tsx`, `src/components/SwapButton/SwapButton.module.css`

**Interfaces:**
- Consumes: `convert` (Task 4), `formatTime`, `formatDateLine`, `dayOffsetKey` (Task 6), `nowIn` (Task 4), store selectors, hooks.
- Produces:
  ```tsx
  export function useConversion(): { result: ConvertResult | null; parsed: ParseResult; effectiveDate: ISODate }  // in ResultDisplay.tsx, reused by ActionsRow
  export function ResultDisplay(): JSX.Element   // [data-testid=result-time], [data-testid=result-date], [data-testid=result-offsets], aria-live=polite
  export function NowLine({ which }: { which: 'from' | 'to' }): JSX.Element   // [data-testid=now-from|now-to]
  export function SwapButton(): JSX.Element     // aria-label t('swap')
  ```

- [ ] **Step 1: Tests (red)**

`src/components/ResultDisplay/ResultDisplay.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clock } from '../../store/clock'
import { resetConverterStore, useConverterStore } from '../../store/converter'
import { ResultDisplay } from './ResultDisplay'

beforeEach(() => {
  resetConverterStore()
  vi.spyOn(clock, 'now').mockImplementation(() => new Date('2026-08-17T14:52:00Z'))
  const s = useConverterStore.getState()
  s.bootstrap({ browserIana: 'America/Costa_Rica' })
  s.setFromZone('America/Denver'); s.setToZone('America/Costa_Rica')
})

describe('ResultDisplay', () => {
  it('shows --:-- while the time is empty or invalid', () => {
    render(<ResultDisplay />)
    expect(screen.getByTestId('result-time')).toHaveTextContent('--:--')
    useConverterStore.getState().setTime('99:99')
    expect(screen.getByTestId('result-time')).toHaveTextContent('--:--')
  })
  it('renders the converted time, date line, day offset and offsets (C1)', () => {
    useConverterStore.getState().setTime('15:30')
    render(<ResultDisplay />)
    expect(screen.getByTestId('result-time')).toHaveTextContent('15:30')
    expect(screen.getByTestId('result-date')).toHaveTextContent('Mon, Aug 17 · same day')
    expect(screen.getByTestId('result-offsets')).toHaveTextContent('UTC-06:00 → UTC-06:00')
    expect(screen.getByTestId('result-time').closest('[aria-live="polite"]')).not.toBeNull()
  })
  it('renders next-day and 12h formats', () => {
    const s = useConverterStore.getState()
    s.setFromZone('America/Costa_Rica'); s.setToZone('Asia/Kolkata'); s.setTime('20:00'); s.setPref('hourFormat', '12h')
    render(<ResultDisplay />)
    expect(screen.getByTestId('result-time')).toHaveTextContent('7:30 AM')
    expect(screen.getByTestId('result-date')).toHaveTextContent('Tue, Aug 18 · next day (+1)')
  })
})
```
`src/components/NowLine/NowLine.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clock } from '../../store/clock'
import { resetConverterStore, useConverterStore } from '../../store/converter'
import { NowLine } from './NowLine'

beforeEach(() => {
  resetConverterStore()
  vi.spyOn(clock, 'now').mockImplementation(() => new Date('2026-08-17T14:52:00Z'))
  const s = useConverterStore.getState()
  s.bootstrap({ browserIana: 'America/Costa_Rica' })
  s.setFromZone('America/Denver'); s.setToZone('America/Costa_Rica')
})

describe('NowLine', () => {
  it('says "there" for a non-home panel and "here" for the home panel (I4)', () => {
    render(<><NowLine which="from" /><NowLine which="to" /></>)
    expect(screen.getByTestId('now-from')).toHaveTextContent('now there 08:52')
    expect(screen.getByTestId('now-to')).toHaveTextContent('now here 08:52')
  })
})
```

- [ ] **Step 2: Implement**

`src/components/ResultDisplay/ResultDisplay.module.css`:
```css
.wrap { display: flex; flex-direction: column; gap: 4px; }
.time { font-size: var(--digits-size); line-height: 1.05; color: var(--result); text-shadow: var(--result-glow); }
.line { font-size: 13px; color: var(--text-muted); }
```
`src/components/ResultDisplay/ResultDisplay.tsx`:
```tsx
import { useMemo } from 'react'
import { dayOffsetKey, formatDateLine, formatTime } from '../../domain/format'
import { parseTime, type ParseResult } from '../../domain/timeParse'
import { convert, type ConvertResult } from '../../domain/tz'
import type { ISODate } from '../../domain/types'
import { useNow } from '../../hooks/useNow'
import { useLocale, useT } from '../../hooks/useT'
import { selectEffectiveDate, useConverterStore } from '../../store/converter'
import styles from './ResultDisplay.module.css'

/** Derived, never stored (INV-3). */
export function useConversion(): { result: ConvertResult | null; parsed: ParseResult; effectiveDate: ISODate } {
  const now = useNow()
  const time = useConverterStore((s) => s.from.time)
  const parsed = useMemo(() => parseTime(time), [time])
  const effectiveDate = useConverterStore((s) => selectEffectiveDate(s, now))
  const from = useConverterStore((s) => s.from.zone)
  const to = useConverterStore((s) => s.to.zone)
  const result = parsed.ok ? convert({ date: effectiveDate, time: parsed.time, from, to }) : null
  return { result, parsed, effectiveDate }
}

export function ResultDisplay() {
  const t = useT()
  const locale = useLocale()
  const hourFormat = useConverterStore((s) => s.prefs.hourFormat)
  const { result } = useConversion()
  return (
    <div className={styles.wrap} aria-live="polite" aria-label={t('result.label')}>
      <div className={`${styles.time} digits`} data-testid="result-time">{result ? formatTime(result.time, hourFormat, locale) : '--:--'}</div>
      <div className={styles.line} data-testid="result-date">{result ? `${formatDateLine(result.date, locale)} · ${t(dayOffsetKey(result.dayOffset))}` : ' '}</div>
      <div className={styles.line} data-testid="result-offsets">{result ? `UTC${result.fromOffset} → UTC${result.toOffset}` : ' '}</div>
    </div>
  )
}
```
`src/components/NowLine/NowLine.tsx`:
```tsx
import { formatTime } from '../../domain/format'
import { nowIn } from '../../domain/tz'
import { useNow } from '../../hooks/useNow'
import { useLocale, useT } from '../../hooks/useT'
import { useConverterStore } from '../../store/converter'

export function NowLine({ which }: { which: 'from' | 'to' }) {
  const t = useT()
  const locale = useLocale()
  const now = useNow()
  const zone = useConverterStore((s) => (which === 'from' ? s.from.zone : s.to.zone))
  const home = useConverterStore((s) => s.home)
  const hourFormat = useConverterStore((s) => s.prefs.hourFormat)
  const time = formatTime(nowIn(zone, now).time, hourFormat, locale)
  return <p data-testid={`now-${which}`} style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{t(zone === home ? 'now.here' : 'now.there', { time })}</p>
}
```
`src/components/SwapButton/SwapButton.module.css`:
```css
.swap { width: 40px; height: 40px; border-radius: 50%; border: 0; background: var(--accent-gradient); color: #0e1016; font-size: 18px; display: grid; place-items: center; box-shadow: 0 4px 14px rgba(124, 140, 255, 0.35); transition: transform 0.2s; }
.swap:hover { transform: rotate(180deg); }
```
`src/components/SwapButton/SwapButton.tsx`:
```tsx
import { useT } from '../../hooks/useT'
import { useConverterStore } from '../../store/converter'
import styles from './SwapButton.module.css'

export function SwapButton() {
  const t = useT()
  const swap = useConverterStore((s) => s.swap)
  const commitRecent = useConverterStore((s) => s.commitRecent)
  return <button type="button" className={styles.swap} aria-label={t('swap')} onClick={() => { swap(); commitRecent() }}>⇄</button>
}
```

- [ ] **Step 3: Run tests** — `npx vitest run src/components/ResultDisplay src/components/NowLine` → pass.

- [ ] **Step 4: Verify + commit**

```bash
npm run verify
git add src/components/ResultDisplay src/components/NowLine src/components/SwapButton
git commit -m "feat(ui): ResultDisplay (derived conversion), NowLine, SwapButton"
```

---

### Task 16: Converter panels, Header, HomeHint, App — and the first acceptance suites (A, C, K, I, P)

Implements spec §8.1 (all but ActionsRow/RecentList/Toast) and turns the acceptance scenarios A1–A4, C1–C7, K1–K2, K4, I1–I4, P1–P3 green. ATDD order: write the acceptance files first, run them red, then build the components, then run green.

**Files:**
- Create: `src/acceptance/home.test.tsx`, `src/acceptance/conversion.test.tsx`, `src/acceptance/picker.test.tsx`, `src/acceptance/input.test.tsx`, `src/acceptance/prefs.test.tsx`
- Create: `src/components/Converter/Converter.tsx`, `src/components/Converter/Converter.module.css`, `src/components/Header/Header.tsx`, `src/components/Header/Header.module.css`, `src/components/HomeHint/HomeHint.tsx`
- Modify: `src/App.tsx` (real shell), `src/App.test.tsx` (delete — superseded by acceptance), `src/main.tsx` (bootstrap from env)

**Interfaces:**
- Consumes: everything from Tasks 3–15.
- Produces: `App()`; `Converter()`; `Header()`; `HomeHint()`. Header controls: HomeBadge = `ZonePicker` with `id="home-zone"`, `label={t('home.badge')}`, `hideLabel`; segmented buttons with `aria-pressed` and names `24h`/`12h`, `EN`/`ES`; theme button whose `aria-label` names the **current** mode (`t('theme.system'|'theme.dark'|'theme.light')`) and whose click cycles system → dark → light → system. Panels: `<section aria-labelledby>` "From"/"To" with a `<span data-testid="home-badge-from|to">HOME</span>` on the home panel.

- [ ] **Step 1: Write the acceptance suites (red)**

`src/acceptance/home.test.tsx`:
```tsx
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { picker, pickZone, reloadApp, renderApp } from './harness'

describe('Feature: Home zone', () => {
  it('A1 home auto-detected from browser', () => {
    renderApp({ browserIana: 'America/Costa_Rica' })
    expect(picker('home')).toHaveValue('🇨🇷 Costa Rica')
    expect(screen.getByTestId('home-badge-from')).toBeInTheDocument()
    expect(screen.queryByTestId('home-badge-to')).not.toBeInTheDocument()
  })
  it('A2 home not in catalog → Costa Rica + hint; choosing a zone in the banner fixes home', async () => {
    const { user } = renderApp({ browserIana: 'Etc/UTC' })
    expect(picker('home')).toHaveValue('🇨🇷 Costa Rica')
    const banner = screen.getByRole('status', { name: /home/i })
    expect(banner).toHaveTextContent("We couldn’t match your time zone")
    await pickZone(user, 'home', 'pacific', '🇺🇸 United States · Pacific Time')
    expect(picker('home')).toHaveValue('🇺🇸 United States · Pacific Time')
    expect(screen.queryByRole('status', { name: /home/i })).not.toBeInTheDocument()
  })
  it('A3 home is editable and persisted; from/to unchanged', async () => {
    const { user } = renderApp()
    await pickZone(user, 'home', 'india', '🇮🇳 India')
    await reloadApp()
    expect(picker('home')).toHaveValue('🇮🇳 India')
    expect(picker('from')).toHaveValue('🇨🇷 Costa Rica')
    expect(picker('to')).toHaveValue('🇺🇸 United States · Mountain Time')
  })
  it('A4 browser zone alias resolves to its group without a hint', () => {
    renderApp({ browserIana: 'America/Boise' })
    expect(picker('home')).toHaveValue('🇺🇸 United States · Mountain Time')
    expect(screen.queryByRole('status', { name: /home/i })).not.toBeInTheDocument()
  })
})
```
Note on A2: the hint banner renders as `<div role="status" aria-label={t('home')}>` containing the text and a **second** `ZonePicker` bound to home (`id="home-zone-hint"`, same accessible name as the header badge). `picker('home')` returns the *first* match (header); `pickZone(user,'home',…)` therefore operates on the header badge — that satisfies A2's intent (choose home). Keep the banner's picker for mouse users; the test drives the header one.

`src/acceptance/conversion.test.tsx`:
```tsx
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { picker, pickZone, renderApp, resultDate, resultTime, timeInput, typeTime } from './harness'

async function setupC1() {
  const r = renderApp()
  await pickZone(r.user, 'from', 'mou', '🇺🇸 United States · Mountain Time')
  await pickZone(r.user, 'to', 'costa', '🇨🇷 Costa Rica')
  await typeTime(r.user, '15:30')
  return r
}

describe('Feature: Conversion', () => {
  it('C1 US Mountain → Costa Rica during DST', async () => {
    await setupC1()
    expect(resultTime()).toBe('15:30')
    expect(resultDate()).toBe('Mon, Aug 17 · same day')
  })
  it('C2 …in standard time when the date is January', async () => {
    const { user } = await setupC1()
    await user.click(screen.getByRole('button', { name: 'Pick a date' }))
    fireEvent.change(screen.getByLabelText('Pick a date', { selector: 'input' }), { target: { value: '2026-01-15' } })
    expect(resultTime()).toBe('16:30')
    expect(resultDate()).toBe('Thu, Jan 15 · same day')
  })
  it('C3 reverse with swap keeps the typed time', async () => {
    const { user } = await setupC1()
    await user.click(screen.getByRole('button', { name: 'Swap direction' }))
    expect(picker('from')).toHaveValue('🇨🇷 Costa Rica')
    expect(picker('to')).toHaveValue('🇺🇸 United States · Mountain Time')
    expect(timeInput()).toHaveValue('15:30')
    expect(resultTime()).toBe('15:30')
  })
  it('C4 Costa Rica → India crosses midnight forward', async () => {
    const { user } = renderApp()
    await pickZone(user, 'to', 'india', '🇮🇳 India')
    await typeTime(user, '20:00')
    expect(resultTime()).toBe('07:30')
    expect(resultDate()).toBe('Tue, Aug 18 · next day (+1)')
  })
  it('C5 Philippines → Costa Rica crosses midnight backward', async () => {
    const { user } = renderApp()
    await pickZone(user, 'from', 'phil', '🇵🇭 Philippines')
    await pickZone(user, 'to', 'costa', '🇨🇷 Costa Rica')
    await typeTime(user, '08:00')
    expect(resultTime()).toBe('18:00')
    expect(resultDate()).toBe('Sun, Aug 16 · previous day (−1)')
  })
  it('C6 Arizona ignores DST', async () => {
    const { user } = renderApp()
    await pickZone(user, 'from', 'mountain standard', '🇺🇸 United States · Mountain Standard Time')
    await pickZone(user, 'to', 'costa', '🇨🇷 Costa Rica')
    await typeTime(user, '15:30')
    expect(resultTime()).toBe('16:30')
  })
  it.each([
    ['germany', '🇩🇪 Germany', '20:00', 'same day'],
    ['nigeria', '🇳🇬 Nigeria', '19:00', 'same day'],
    ['japan', '🇯🇵 Japan', '03:00', 'next day (+1)'],
    ['australian eastern', '🇦🇺 Australia · Australian Eastern Time', '04:00', 'next day (+1)'],
  ])('C7 any catalog zone converts: %s', async (query, option, time, day) => {
    const { user } = renderApp()
    await typeTime(user, '12:00')
    await pickZone(user, 'to', query, option)
    expect(resultTime()).toBe(time)
    expect(resultDate()).toContain(day)
  })
})
```

`src/acceptance/picker.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { COUNTRIES } from '../domain/catalog'
import { convert } from '../domain/tz'
import { picker, pickZone, renderApp, resultTime } from './harness'

describe('Feature: Picker', () => {
  it('K1 search by zone name, choose with keyboard, result updates', async () => {
    const { user } = renderApp()
    await pickZone(user, 'to', 'costa', '🇨🇷 Costa Rica')
    await user.type(screen.getByRole('textbox', { name: 'Time' }), '15:30')
    const from = picker('from')
    await user.click(from)
    await user.type(from, 'mou')
    const list = screen.getByRole('listbox')
    expect(within(list).getByRole('option', { name: '🇺🇸 United States · Mountain Time' })).toBeInTheDocument()
    expect(within(list).getByRole('option', { name: '🇺🇸 United States · Mountain Standard Time' })).toBeInTheDocument()
    expect(within(list).getAllByRole('option').length).toBeLessThanOrEqual(50)
    // Walk with ArrowDown until "Mountain Time" is the active descendant, then Enter.
    for (let i = 0; i < 50; i++) {
      const activeId = from.getAttribute('aria-activedescendant')
      if (activeId && document.getElementById(activeId)?.textContent?.includes('United States · Mountain Time')) break
      await user.keyboard('{ArrowDown}')
    }
    await user.keyboard('{Enter}')
    expect(from).toHaveValue('🇺🇸 United States · Mountain Time')
    expect(resultTime()).toBe('15:30') // Denver 15:30 MDT → Costa Rica 15:30 (C1)
  })
  it('K2 search by city, by localized name (ES) and by offset', async () => {
    const { user } = renderApp()
    const from = picker('from')
    await user.click(from); await user.type(from, 'denver')
    expect(within(screen.getByRole('listbox')).getAllByRole('option')[0]).toHaveTextContent('🇺🇸 United States · Mountain Time')
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'ES' }))
    const fromEs = picker('from')
    await user.click(fromEs); await user.type(fromEs, 'alemania')
    expect(within(screen.getByRole('listbox')).getAllByRole('option')[0]).toHaveTextContent('🇩🇪 Alemania')
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'EN' }))
    const fromEn = picker('from')
    await user.click(fromEn); await user.type(fromEn, '+5:30')
    expect(within(screen.getByRole('listbox')).getByRole('option', { name: '🇮🇳 India' })).toBeInTheDocument()
  })
  it('K4 groups in order; single-zone rendering; US lists 8 zones', async () => {
    const { user } = renderApp()
    await user.click(picker('from'))
    const list = screen.getByRole('listbox')
    expect(within(list).getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['Pinned', 'Africa', 'Americas', 'Asia', 'Europe', 'Oceania'])
    expect(within(list).getAllByRole('option', { name: '🇨🇷 Costa Rica' }).length).toBeGreaterThan(0)
    expect(within(list).getAllByRole('option', { name: /^🇺🇸 United States · / })).toHaveLength(8)
  })
  it('K5 catalog sanity: ≥240 countries and every zone converts', () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(240)
    for (const c of COUNTRIES) for (const z of c.zones) {
      expect(() => convert({ date: '2026-08-17', time: '12:00', from: 'America/Costa_Rica', to: z.id })).not.toThrow()
    }
  })
})
```
`src/acceptance/input.test.tsx`:
```tsx
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { nowLine, pickZone, renderApp, resultTime, timeInput, typeTime } from './harness'

describe('Feature: Input', () => {
  it.each([['3:30 pm', '15:30'], ['1530', '15:30'], ['3pm', '15:00']])('I1 accepts %s', async (raw, expected) => {
    const { user } = renderApp()
    await pickZone(user, 'to', 'costa', '🇨🇷 Costa Rica') // CR → CR: identity, so result == parsed input
    await typeTime(user, raw)
    expect(resultTime()).toBe(expected)
  })
  it('I3 Now fills the input from the from-zone clock', async () => {
    const { user } = renderApp({ now: '2026-08-17T14:52:00Z' })
    await pickZone(user, 'from', 'mou', '🇺🇸 United States · Mountain Time')
    await user.click(screen.getByRole('button', { name: 'Now' }))
    expect(timeInput()).toHaveValue('08:52')
    expect(screen.getByTestId('date-line')).toHaveTextContent('Mon, Aug 17')
  })
  it('I4 live now clocks say there/here', async () => {
    const { user } = renderApp({ now: '2026-08-17T14:52:00Z' })
    await pickZone(user, 'from', 'mou', '🇺🇸 United States · Mountain Time')
    await pickZone(user, 'to', 'costa', '🇨🇷 Costa Rica')
    expect(nowLine('from')).toBe('now there 08:52')
    expect(nowLine('to')).toBe('now here 08:52')
  })
})
```
`src/acceptance/prefs.test.tsx`:
```tsx
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { zoneById, zoneLabel } from '../domain/catalog'
import { picker, pickZone, reloadApp, renderApp, resultTime, timeInput, typeTime } from './harness'

describe('Feature: Preferences', () => {
  it('P1 12h toggle affects placeholder and result, survives reload', async () => {
    const { user } = renderApp()
    await pickZone(user, 'from', 'mou', '🇺🇸 United States · Mountain Time')
    await pickZone(user, 'to', 'costa', '🇨🇷 Costa Rica')
    await typeTime(user, '15:30')
    await user.click(screen.getByRole('button', { name: '12h' }))
    expect(resultTime()).toBe('3:30 PM')
    expect(timeInput()).toHaveAttribute('placeholder', '3:30 pm')
    await reloadApp()
    expect(screen.getByRole('button', { name: '12h' })).toHaveAttribute('aria-pressed', 'true')
  })
  it('P2 Spanish UI: labels, Intl-localized names, date line; survives reload', async () => {
    const { user } = renderApp()
    await pickZone(user, 'from', 'mou', '🇺🇸 United States · Mountain Time')
    await typeTime(user, '15:30')
    await user.click(screen.getByRole('button', { name: 'ES' }))
    expect(screen.getByRole('combobox', { name: 'Desde' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Hasta' })).toBeInTheDocument()
    expect(picker('from')).toHaveValue(`🇺🇸 Estados Unidos · ${zoneLabel(zoneById('America/Denver'), 'es-CR')}`)
    expect(screen.getByTestId('result-date')).toHaveTextContent('lun, 17 ago')
    await reloadApp()
    expect(screen.getByRole('button', { name: 'ES' })).toHaveAttribute('aria-pressed', 'true')
  })
  it('P3 theme cycles dark → light → system and persists', async () => {
    const { user } = renderApp()
    const btn = () => screen.getByRole('button', { name: /theme/i })
    expect(document.documentElement.dataset.theme).toBe('light') // system + jsdom matchMedia(dark)=false
    await user.click(btn()) // system → dark
    expect(document.documentElement.dataset.theme).toBe('dark')
    await user.click(btn()) // dark → light
    expect(document.documentElement.dataset.theme).toBe('light')
    await reloadApp()
    expect(btn()).toHaveAccessibleName('Light theme')
  })
})
```

- [ ] **Step 2: Run the new suites — expect them all to FAIL** (App is still the placeholder): `npx vitest run src/acceptance`.

- [ ] **Step 3: Converter (panels + swap)**

`src/components/Converter/Converter.module.css`:
```css
.grid { display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: stretch; }
.panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-card); padding: 16px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.panel.home { background: var(--surface-home); border-color: var(--border-home); }
.head { display: flex; align-items: center; gap: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); }
.badge { font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 4px; background: var(--accent-b); color: #0e1016; }
.swapCell { display: grid; place-items: center; }
@media (max-width: 719.98px) {
  .grid { grid-template-columns: 1fr; }
  .swapCell { margin: -22px 0; z-index: 2; }
}
```
`src/components/Converter/Converter.tsx`:
```tsx
import { useId, useMemo, type RefObject } from 'react'
import { useNow } from '../../hooks/useNow'
import { useLocale, useT } from '../../hooks/useT'
import { pinnedZones, useConverterStore } from '../../store/converter'
import { DateRow } from '../DateRow/DateRow'
import { NowLine } from '../NowLine/NowLine'
import { ResultDisplay } from '../ResultDisplay/ResultDisplay'
import { SwapButton } from '../SwapButton/SwapButton'
import { TimeInput } from '../TimeInput/TimeInput'
import { ZonePicker } from '../ZonePicker/ZonePicker'
import styles from './Converter.module.css'

function Panel({ which, fromInputRef }: { which: 'from' | 'to'; fromInputRef?: RefObject<HTMLInputElement | null> }) {
  const t = useT()
  const locale = useLocale()
  const now = useNow()
  const headingId = useId()
  const zone = useConverterStore((s) => (which === 'from' ? s.from.zone : s.to.zone))
  const home = useConverterStore((s) => s.home)
  const recents = useConverterStore((s) => s.recents)
  // pinnedZones builds a fresh array; memoize it instead of subscribing with it (zustand 5).
  const pinned = useMemo(() => pinnedZones(home, recents), [home, recents])
  const setZone = useConverterStore((s) => (which === 'from' ? s.setFromZone : s.setToZone))
  const commitRecent = useConverterStore((s) => s.commitRecent)
  const isHome = zone === home
  return (
    <section className={`${styles.panel} ${isHome ? styles.home : ''}`} aria-labelledby={headingId}>
      <div className={styles.head}>
        <span id={headingId}>{t(which)}</span>
        {isHome && <span className={styles.badge} data-testid={`home-badge-${which}`}>{t('home').toUpperCase()}</span>}
      </div>
      <ZonePicker id={`${which}-zone`} label={t(which)} hideLabel value={zone} onChange={(z) => { setZone(z); commitRecent() }} locale={locale} pinned={pinned} now={now} t={t} inputRef={fromInputRef} />
      {which === 'from' ? (<><TimeInput /><DateRow /></>) : <ResultDisplay />}
      <NowLine which={which} />
    </section>
  )
}

export function Converter({ fromInputRef }: { fromInputRef?: RefObject<HTMLInputElement | null> }) {
  return (
    <div className={styles.grid}>
      <Panel which="from" fromInputRef={fromInputRef} />
      <div className={styles.swapCell}><SwapButton /></div>
      <Panel which="to" />
    </div>
  )
}
```

- [ ] **Step 4: Header and HomeHint**

`src/components/Header/Header.module.css`:
```css
.bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 8px 0 16px; }
.brand { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; background: var(--accent-gradient); -webkit-background-clip: text; background-clip: text; color: transparent; }
.controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.homeWrap { min-width: 220px; }
.seg { display: inline-flex; border: 1px solid var(--border); border-radius: var(--radius-pill); overflow: hidden; }
.seg button { background: transparent; border: 0; padding: 4px 10px; font-size: 12px; color: var(--text-muted); }
.seg button[aria-pressed='true'] { background: var(--list-hover); color: var(--accent-b); }
.icon { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-pill); padding: 4px 10px; font-size: 12px; }
```
`src/components/Header/Header.tsx`:
```tsx
import { useMemo } from 'react'
import { useNow } from '../../hooks/useNow'
import { useLocale, useT } from '../../hooks/useT'
import { pinnedZones, useConverterStore } from '../../store/converter'
import type { Theme } from '../../domain/types'
import { ZonePicker } from '../ZonePicker/ZonePicker'
import styles from './Header.module.css'

const NEXT_THEME: Record<Theme, Theme> = { system: 'dark', dark: 'light', light: 'system' }
const THEME_ICON: Record<Theme, string> = { light: '☀', dark: '☾', system: '◐' }

export function Header() {
  const t = useT()
  const locale = useLocale()
  const now = useNow()
  const home = useConverterStore((s) => s.home)
  const setHome = useConverterStore((s) => s.setHome)
  const recents = useConverterStore((s) => s.recents)
  const pinned = useMemo(() => pinnedZones(home, recents), [home, recents])
  const prefs = useConverterStore((s) => s.prefs)
  const setPref = useConverterStore((s) => s.setPref)
  return (
    <header className={styles.bar}>
      <h1 className={styles.brand}>{t('app.title')}</h1>
      <div className={styles.controls}>
        <div className={styles.homeWrap} title={t('home.badge')}>
          <ZonePicker id="home-zone" label={t('home.badge')} hideLabel value={home} onChange={setHome} locale={locale} pinned={pinned} now={now} t={t} />
        </div>
        <div className={styles.seg} role="group" aria-label="Hour format">
          <button type="button" aria-pressed={prefs.hourFormat === '24h'} onClick={() => setPref('hourFormat', '24h')}>{t('format.24h')}</button>
          <button type="button" aria-pressed={prefs.hourFormat === '12h'} onClick={() => setPref('hourFormat', '12h')}>{t('format.12h')}</button>
        </div>
        <div className={styles.seg} role="group" aria-label="Language">
          <button type="button" aria-pressed={prefs.lang === 'en'} onClick={() => setPref('lang', 'en')}>{t('lang.en')}</button>
          <button type="button" aria-pressed={prefs.lang === 'es'} onClick={() => setPref('lang', 'es')}>{t('lang.es')}</button>
        </div>
        <button type="button" className={styles.icon} aria-label={t(`theme.${prefs.theme}`)} onClick={() => setPref('theme', NEXT_THEME[prefs.theme])}>{THEME_ICON[prefs.theme]}</button>
      </div>
    </header>
  )
}
```
`src/components/HomeHint/HomeHint.tsx`:
```tsx
import { useMemo } from 'react'
import { useNow } from '../../hooks/useNow'
import { useLocale, useT } from '../../hooks/useT'
import { pinnedZones, useConverterStore } from '../../store/converter'
import { ZonePicker } from '../ZonePicker/ZonePicker'

export function HomeHint() {
  const t = useT()
  const locale = useLocale()
  const now = useNow()
  const show = useConverterStore((s) => s.homeHint)
  const home = useConverterStore((s) => s.home)
  const setHome = useConverterStore((s) => s.setHome)
  const dismiss = useConverterStore((s) => s.dismissHomeHint)
  const recents = useConverterStore((s) => s.recents)
  const pinned = useMemo(() => pinnedZones(home, recents), [home, recents])
  if (!show) return null
  return (
    <div role="status" aria-label={t('home')} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', marginBottom: 12, background: 'var(--surface)', border: '1px solid var(--border-home)', borderRadius: 'var(--radius-card)' }}>
      <span>{t('home.hint')}</span>
      <div style={{ minWidth: 240 }}>
        <ZonePicker id="home-zone-hint" label={t('home.badge')} hideLabel value={home} onChange={setHome} locale={locale} pinned={pinned} now={now} t={t} />
      </div>
      <button type="button" onClick={dismiss} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-control)', padding: '4px 10px' }}>{t('home.hint.dismiss')}</button>
    </div>
  )
}
```

- [ ] **Step 5: App shell and main bootstrap**

`src/App.tsx`:
```tsx
import { useRef } from 'react'
import { Converter } from './components/Converter/Converter'
import { Header } from './components/Header/Header'
import { HomeHint } from './components/HomeHint/HomeHint'
import { useTheme } from './hooks/useTheme'

export default function App() {
  useTheme()
  const fromInputRef = useRef<HTMLInputElement | null>(null)
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '16px 16px 48px' }}>
      <Header />
      <HomeHint />
      <Converter fromInputRef={fromInputRef} />
    </main>
  )
}
```
`src/main.tsx`:
```tsx
import './styles/tokens.css'
import './styles/global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useConverterStore } from './store/converter'

// The only place the browser environment is read for bootstrap (INV-2 keeps it out of the domain).
useConverterStore.getState().bootstrap({
  browserIana: Intl.DateTimeFormat().resolvedOptions().timeZone,
  navigatorLanguage: navigator.language,
  search: window.location.search,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```
Delete `src/App.test.tsx` (superseded).

- [ ] **Step 6: Run the acceptance suites**

Run: `npx vitest run src/acceptance` → A1–A4, C1–C7, K1–K2, K4–K5, I1, I3–I4, P1–P3 pass. Then `npm run verify` → all green. Then `npm run dev` and eyeball the layout against the mockups (`docs/superpowers/mockups/layout.html`, `visual-style.html`, `picker-world.html` option B): two cards, gradient swap, big teal digits, dark theme by default.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(app): converter panels, header, home hint; acceptance suites A/C/K/I/P green"
```

---

### Task 17: Share URL sync, Copy/Share actions, Toast (S1, S2, I2)

Implements spec §6.4 behaviour (`useUrlSync`), §8.1 ActionsRow + Toast.

**Files:**
- Create: `src/hooks/useUrlSync.ts`, `src/hooks/useUrlSync.test.ts`, `src/components/Toast/Toast.tsx`, `src/components/ActionsRow/ActionsRow.tsx`, `src/components/ActionsRow/ActionsRow.module.css`, `src/acceptance/sharing.test.tsx`
- Modify: `src/App.tsx` (add `useUrlSync()`, `<ActionsRow/>`, `<Toast/>`), `src/acceptance/input.test.tsx` (append I2)

**Interfaces:**
- Consumes: `encodeUrlState` (Task 8), `useConversion` (Task 15), `copyText` (Task 6).
- Produces: `useUrlSync(): void`; `useToast(): { message: string | null; show(msg: string): void }` via a tiny zustand store `useToastStore` in `Toast.tsx`; `ActionsRow()` with buttons `t('copy')` / `t('share')` (disabled when no valid result); `Toast()` renders `<div role="status">{message}</div>` for 1500 ms.

- [ ] **Step 1: Acceptance (red)**

`src/acceptance/sharing.test.tsx`:
```tsx
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { clipboardText, picker, pickZone, renderApp, resultTime, timeInput, typeTime } from './harness'

async function c1() {
  const r = renderApp()
  await pickZone(r.user, 'from', 'mou', '🇺🇸 United States · Mountain Time')
  await pickZone(r.user, 'to', 'costa', '🇨🇷 Costa Rica')
  await typeTime(r.user, '15:30')
  return r
}

describe('Feature: Sharing', () => {
  it('S1 share link round-trip (incl. alias in URL)', async () => {
    const { user } = await c1()
    await user.click(screen.getByRole('button', { name: 'Share link' }))
    const url = clipboardText()
    expect(decodeURIComponent(url)).toContain('t=15:30')
    expect(decodeURIComponent(url)).toContain('from=America/Denver')
    expect(decodeURIComponent(url)).toContain('to=America/Costa_Rica')
    expect(screen.getByRole('status')).toHaveTextContent('Link copied ✓')
    expect(window.location.search).toContain('from=America%2FDenver')
    renderApp({ search: '?t=15:30&from=America/Boise&to=America/Costa_Rica' })
    expect(picker('from')).toHaveValue('🇺🇸 United States · Mountain Time')
    expect(timeInput()).toHaveValue('15:30')
    expect(resultTime()).toBe('15:30')
  })
  it('S2 copy result text', async () => {
    const { user } = await c1()
    await user.click(screen.getByRole('button', { name: 'Copy result' }))
    expect(clipboardText()).toBe('15:30 Mountain Time (United States) → 15:30 Central Standard Time (Costa Rica) · Mon, Aug 17, 2026')
    expect(screen.getByRole('status')).toHaveTextContent('Copied ✓')
  })
})
```
Append I2 to `src/acceptance/input.test.tsx` (inside the existing `describe`; it needs the Copy/Share buttons built in this task):
```tsx
  it('I2 invalid time shows an error, --:--, and disables Copy/Share', async () => {
    const { user } = renderApp()
    await typeTime(user, '25:99')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a time like 15:30 or 3:30 pm')
    expect(resultTime()).toBe('--:--')
    expect(screen.getByRole('button', { name: 'Copy result' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Share link' })).toBeDisabled()
  })
```

`src/hooks/useUrlSync.test.ts`:
```ts
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetConverterStore, useConverterStore } from '../store/converter'
import { useUrlSync } from './useUrlSync'

describe('useUrlSync', () => {
  beforeEach(() => { resetConverterStore(); useConverterStore.getState().bootstrap({ browserIana: 'America/Costa_Rica' }); window.history.replaceState(null, '', '/') })
  it('mirrors from/to/time/date into the query string with replaceState', () => {
    renderHook(() => useUrlSync())
    expect(window.location.search).toBe('?from=America%2FCosta_Rica&to=America%2FDenver')
    // act(): the effect that rewrites the URL runs after React flushes the store update.
    act(() => {
      useConverterStore.getState().setTime('15:30')
      useConverterStore.getState().setDate('2026-01-15')
    })
    expect(window.location.search).toBe('?t=15%3A30&d=2026-01-15&from=America%2FCosta_Rica&to=America%2FDenver')
  })
})
```

- [ ] **Step 2: Implement**

`src/hooks/useUrlSync.ts`:
```ts
import { useEffect } from 'react'
import { encodeUrlState } from '../domain/url'
import { useConverterStore } from '../store/converter'

/** Keeps the address bar in sync so the current conversion is always shareable. Never pushes history. */
export function useUrlSync(): void {
  const time = useConverterStore((s) => s.from.time)
  const date = useConverterStore((s) => s.from.date)
  const from = useConverterStore((s) => s.from.zone)
  const to = useConverterStore((s) => s.to.zone)
  useEffect(() => {
    const q = encodeUrlState({ time, date, from, to })
    window.history.replaceState(null, '', `${window.location.pathname}?${q}${window.location.hash}`)
  }, [time, date, from, to])
}
```
`src/components/Toast/Toast.tsx`:
```tsx
import { useEffect } from 'react'
import { create } from 'zustand'

interface ToastState { message: string | null; show(msg: string): void; clear(): void }
export const useToastStore = create<ToastState>((set) => ({ message: null, show: (message) => set({ message }), clear: () => set({ message: null }) }))

export function Toast() {
  const message = useToastStore((s) => s.message)
  const clear = useToastStore((s) => s.clear)
  useEffect(() => {
    if (!message) return
    const id = setTimeout(clear, 1500)
    return () => clearTimeout(id)
  }, [message, clear])
  return (
    <div role="status" aria-live="polite" style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', padding: message ? '8px 14px' : 0, background: 'var(--surface)', border: message ? '1px solid var(--accent-b)' : 0, borderRadius: 999, fontSize: 13 }}>
      {message}
    </div>
  )
}
```
`src/components/ActionsRow/ActionsRow.module.css`:
```css
.row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
.btn { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-control); padding: 6px 12px; font-size: 13px; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
```
`src/components/ActionsRow/ActionsRow.tsx`:
```tsx
import { copyText } from '../../domain/format'
import { useLocale, useT } from '../../hooks/useT'
import { useConverterStore } from '../../store/converter'
import { useConversion } from '../ResultDisplay/ResultDisplay'
import { useToastStore } from '../Toast/Toast'
import styles from './ActionsRow.module.css'

async function writeClipboard(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}

export function ActionsRow() {
  const t = useT()
  const locale = useLocale()
  const show = useToastStore((s) => s.show)
  const from = useConverterStore((s) => s.from.zone)
  const to = useConverterStore((s) => s.to.zone)
  const { result, parsed } = useConversion()
  const disabled = !result || !parsed.ok
  const onCopy = async () => {
    if (!result || !parsed.ok) return
    const text = copyText({ from, to, time: parsed.time, result, locale })
    show((await writeClipboard(text)) ? t('copy.done') : text)
  }
  const onShare = async () => {
    const url = window.location.href
    show((await writeClipboard(url)) ? t('share.done') : url)
  }
  return (
    <div className={styles.row}>
      <button type="button" className={styles.btn} disabled={disabled} onClick={onCopy}>{t('copy')}</button>
      <button type="button" className={styles.btn} disabled={disabled} onClick={onShare}>{t('share')}</button>
    </div>
  )
}
```
`src/App.tsx` — add `useUrlSync()` after `useTheme()`, and render `<ActionsRow />` after `<Converter …/>` and `<Toast />` last.

- [ ] **Step 3: Run** — `npx vitest run src/acceptance/sharing.test.tsx src/acceptance/input.test.tsx src/hooks/useUrlSync.test.ts` → pass; `npm run verify` green.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(share): URL sync, copy result, share link, toast (S1, S2, I2)"
```

---

### Task 18: Recent conversions (S3, S4)

Implements spec §8.1 RecentList.

**Files:**
- Create: `src/components/RecentList/RecentList.tsx`, `src/components/RecentList/RecentList.module.css`
- Modify: `src/App.tsx` (render `<RecentList/>` after `<ActionsRow/>`), `src/acceptance/sharing.test.tsx` (append S3, S4)

**Interfaces:**
- Consumes: `recentLabel` (Task 6), store `recents`, `loadRecent`, `clearRecents`.
- Produces: `RecentList()` — hidden when empty; `<h2>{t('recent')}</h2>`, chips `<button>` with `recentLabel`, `<button>{t('recent.clear')}</button>`.

- [ ] **Step 1: Acceptance (red)** — append to `src/acceptance/sharing.test.tsx`:
```tsx
describe('Feature: Recents', () => {
  it('S3 lists newest first, reload restores, clear persists', async () => {
    const { user } = renderApp()
    await pickZone(user, 'from', 'mou', '🇺🇸 United States · Mountain Time')
    await pickZone(user, 'to', 'costa', '🇨🇷 Costa Rica')
    await typeTime(user, '15:30{Enter}')
    await pickZone(user, 'from', 'costa', '🇨🇷 Costa Rica')
    await pickZone(user, 'to', 'india', '🇮🇳 India')
    await typeTime(user, '20:00{Enter}')
    const chips = () => screen.getAllByRole('button', { name: /→/ }).map((b) => b.textContent)
    expect(chips()[0]).toBe('20:00 🇨🇷 Costa Rica → 🇮🇳 India')
    expect(chips()).toContain('15:30 🇺🇸 Mountain Time → 🇨🇷 Costa Rica')
    await user.click(screen.getByRole('button', { name: '15:30 🇺🇸 Mountain Time → 🇨🇷 Costa Rica' }))
    expect(picker('from')).toHaveValue('🇺🇸 United States · Mountain Time')
    expect(timeInput()).toHaveValue('15:30')
    expect(resultTime()).toBe('15:30')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.queryByRole('button', { name: /→/ })).not.toBeInTheDocument()
    await reloadApp()
    expect(screen.queryByRole('button', { name: /→/ })).not.toBeInTheDocument()
  })
  it('S4 caps at 8 and dedupes to the front', async () => {
    const { user } = renderApp()
    for (let h = 1; h <= 9; h++) await typeTime(user, `0${h}:00{Enter}`)
    const chips = () => screen.getAllByRole('button', { name: /→/ }).map((b) => b.textContent!)
    expect(chips()).toHaveLength(8)
    expect(chips()[0]).toMatch(/^09:00/)
    await typeTime(user, '03:00{Enter}')
    expect(chips()[0]).toMatch(/^03:00/)
    expect(chips().filter((c) => c.startsWith('03:00'))).toHaveLength(1)
    expect(chips()).toHaveLength(8)
  })
})
```
Add `reloadApp` to that file's harness import.

- [ ] **Step 2: Implement**

`src/components/RecentList/RecentList.module.css`:
```css
.wrap { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
.title { margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); font-weight: 600; }
.chip { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-pill); padding: 4px 10px; font-size: 12px; color: var(--text-muted); }
.chip:hover { border-color: var(--accent-b); color: var(--text); }
.clear { margin-left: auto; background: transparent; border: 0; color: var(--text-muted); font-size: 12px; text-decoration: underline; }
```
`src/components/RecentList/RecentList.tsx`:
```tsx
import { recentLabel } from '../../domain/format'
import { useLocale, useT } from '../../hooks/useT'
import { useConverterStore } from '../../store/converter'
import styles from './RecentList.module.css'

export function RecentList() {
  const t = useT()
  const locale = useLocale()
  const recents = useConverterStore((s) => s.recents)
  const hourFormat = useConverterStore((s) => s.prefs.hourFormat)
  const loadRecent = useConverterStore((s) => s.loadRecent)
  const clearRecents = useConverterStore((s) => s.clearRecents)
  if (recents.length === 0) return null
  return (
    <section className={styles.wrap} aria-label={t('recent')}>
      <h2 className={styles.title}>{t('recent')}</h2>
      {recents.map((r) => (
        <button key={`${r.from}|${r.to}|${r.time}|${r.date ?? ''}`} type="button" className={styles.chip} onClick={() => loadRecent(r)}>
          {recentLabel(r, hourFormat, locale)}
        </button>
      ))}
      <button type="button" className={styles.clear} onClick={clearRecents}>{t('recent.clear')}</button>
    </section>
  )
}
```

- [ ] **Step 3: Run** — `npx vitest run src/acceptance/sharing.test.tsx` → pass; `npm run verify` green. **Step 4: Commit**

```bash
git add -A
git commit -m "feat(recents): recent conversions chips with reload and clear (S3, S4)"
```

---

### Task 19: Keyboard shortcut ⌘K / Ctrl+K (K3)

**Files:**
- Create: `src/hooks/useShortcuts.ts`
- Modify: `src/App.tsx` (call `useShortcuts(fromInputRef)`), `src/acceptance/picker.test.tsx` (append K3)

- [ ] **Step 1: Acceptance (red)** — append to `src/acceptance/picker.test.tsx`:
```tsx
  it('K3 ⌘K focuses the From picker; keyboard-only selection; Esc restores', async () => {
    const { user } = renderApp()
    await user.keyboard('{Meta>}k{/Meta}')
    expect(picker('from')).toHaveFocus()
    await user.keyboard('phil{Enter}')
    expect(picker('from')).toHaveValue('🇵🇭 Philippines')
    await user.click(picker('from'))
    await user.keyboard('jap{Escape}')
    expect(picker('from')).toHaveValue('🇵🇭 Philippines')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
```
Note: `{Enter}` selects the *active* option. After typing "phil" the first (active) row is Philippines because `search` ranks country-name prefixes above city prefixes **and orders the continent groups by their best-ranked member**, so Asia's group (Manila, tier 0) renders above the Americas group (Philipsburg/Philadelphia, tier 2).

- [ ] **Step 2: Implement**

`src/hooks/useShortcuts.ts`:
```ts
import { useEffect, type RefObject } from 'react'

/** ⌘K / Ctrl+K focuses (and thereby opens) the From picker. */
export function useShortcuts(fromInputRef: RefObject<HTMLInputElement | null>): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        fromInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fromInputRef])
}
```
In `App.tsx`: `useShortcuts(fromInputRef)`.

- [ ] **Step 3: Run** — `npx vitest run src/acceptance/picker.test.tsx` → pass; `npm run verify` green. **Step 4: Commit**

```bash
git add -A
git commit -m "feat(shortcuts): ⌘K/Ctrl+K focuses the From picker (K3)"
```

---

### Task 20: Playwright smoke suite

Implements spec §11 "Playwright smoke".

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`

- [ ] **Step 1: Config**

`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:4173/lazy-time-conversor/', trace: 'retain-on-failure', timezoneId: 'America/Costa_Rica', locale: 'en-US' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://localhost:4173/lazy-time-conversor/', reuseExistingServer: !process.env.CI, timeout: 60_000 },
})
```
Run once: `npx playwright install chromium`.

- [ ] **Step 2: Smoke tests**

`e2e/smoke.spec.ts`:
```ts
import { expect, test } from '@playwright/test'

test.describe('smoke', () => {
  test('convert, swap, share and reopen the shared link', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('./')
    await expect(page.getByRole('combobox', { name: 'From' })).toHaveValue('🇨🇷 Costa Rica')
    const from = page.getByRole('combobox', { name: 'From' })
    await from.click()
    await from.fill('mou')
    await page.getByRole('option', { name: '🇺🇸 United States · Mountain Time' }).click()
    const to = page.getByRole('combobox', { name: 'To' })
    await to.click()
    await to.fill('costa')
    await page.getByRole('option', { name: '🇨🇷 Costa Rica' }).click()
    await page.getByRole('textbox', { name: 'Time' }).fill('15:30')
    await expect(page.getByTestId('result-time')).toHaveText(/15:30|16:30/) // 15:30 during US DST, 16:30 in US standard time
    await page.getByRole('button', { name: 'Swap direction' }).click()
    await expect(page.getByRole('combobox', { name: 'From' })).toHaveValue('🇨🇷 Costa Rica')
    await page.getByRole('button', { name: 'Share link' }).click()
    await expect(page.getByRole('status')).toContainText('Link copied')
    const url = page.url()
    expect(url).toContain('t=15%3A30')
    const page2 = await context.newPage()
    await page2.goto(url)
    await expect(page2.getByRole('textbox', { name: 'Time' })).toHaveValue('15:30')
    await expect(page2.getByRole('combobox', { name: 'To' })).toHaveValue('🇺🇸 United States · Mountain Time')
  })

  test('mobile: cards stack and picker opens as a sheet', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile project only')
    await page.goto('./')
    const from = page.getByRole('combobox', { name: 'From' })
    const to = page.getByRole('combobox', { name: 'To' })
    const a = await from.boundingBox(); const b = await to.boundingBox()
    expect(b!.y).toBeGreaterThan(a!.y + a!.height) // stacked
    await from.click()
    await expect(page.getByRole('listbox')).toBeVisible()
    await from.fill('japan')
    await page.getByRole('option', { name: '🇯🇵 Japan' }).click()
    await page.getByRole('textbox', { name: 'Time' }).fill('09:00')
    await expect(page.getByTestId('result-time')).not.toHaveText('--:--')
  })

  test('theme toggle persists across reload', async ({ page }) => {
    await page.goto('./')
    const html = page.locator('html')
    await page.getByRole('button', { name: /theme/i }).click() // system → dark
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await page.getByRole('button', { name: /theme/i }).click() // dark → light
    await expect(html).toHaveAttribute('data-theme', 'light')
    await page.reload()
    await expect(html).toHaveAttribute('data-theme', 'light')
  })
})
```

- [ ] **Step 3: Run**

```bash
npm run build && npm run e2e
```
Expected: 3 desktop + 3 mobile results (mobile-only test skipped on desktop) — all green.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts e2e
git commit -m "test(e2e): Playwright smoke — convert/swap/share, mobile sheet, theme persistence"
```

---

### Task 21: CI/CD — GitHub Actions to GitHub Pages

Implements spec §12.

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Workflow**

```yaml
name: CI & Deploy to GitHub Pages

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages-${{ github.ref }}
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run catalog:check
      - run: npm run verify
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
        env:
          CI: true
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report
      - uses: actions/configure-pages@v5
        if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
      - uses: actions/upload-pages-artifact@v3
        if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
        with:
          path: dist

  deploy:
    if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Repository setup (one-time, by Joan)** — create the GitHub repo `lazy-time-conversor`, `git remote add origin …`, push `main`, then in *Settings → Pages* set **Source: GitHub Actions**. If the repo name differs, change `base` in `vite.config.ts` and `baseURL`/`url` in `playwright.config.ts`.

- [ ] **Step 3: Commit + push, watch the run**

```bash
git add .github
git commit -m "ci: verify, catalog drift check, e2e, deploy to GitHub Pages"
git push -u origin main
```
Expected: workflow green; site live at `https://<user>.github.io/lazy-time-conversor/`.

---

### Task 22: README and CLAUDE.md

**Files:**
- Create: `README.md`; Modify: `CLAUDE.md` (replace the pre-implementation version)

- [ ] **Step 1: README.md** — write these sections in this order, each 2–6 lines: `# Lazy Time Converter` + one-paragraph pitch (spec §1); **Live**: `https://<user>.github.io/lazy-time-conversor/`; **Features**: the bullet list from spec §2 "Goals"; **How it works**: three bullets — conversion and names come from the browser's `Intl` API (no date library), the country→zone catalog is generated at build time from `@vvo/tzdb` into `src/domain/catalog.generated.json`, everything runs client-side (localStorage only); **Development**: table of `npm run dev | verify | e2e | gen:catalog | catalog:check`; **Updating time-zone data**: `npm i -D @vvo/tzdb@latest && npm run gen:catalog && npm run verify`, commit the JSON; **Docs**: links to the spec and this plan; **License**: MIT.

- [ ] **Step 2: CLAUDE.md** — the file already exists from the planning session (it points at the spec and plan). Update it: change the status line to "finished, tested, deployed"; fill the commands table with the real scripts and test counts (`npm test` output); keep the invariants section verbatim from spec §5; keep the warning not to read this plan end-to-end.

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: README and CLAUDE.md for the finished release 1"
git push
```

---

## Self-review against the spec (done while writing; re-check before starting)

- **§4 catalog** → Tasks 2, 3, 7. **§5 invariants** → Global Constraints + Tasks 3/10/16 (`main.tsx` is the only env reader). **§6 domain** → Tasks 4, 5, 6, 8. **§7 store** → Task 10. **§8.1–8.3 UI** → Tasks 13–18. **§8.4 tokens** → Task 11. **§9 i18n** → Task 9. **§10 edge cases** → Tasks 4 (gap/overlap), 8 (bad URL), 10 (zone repair), 13 (no matches), 14 (invalid time), 17 (clipboard fallback), 16 (home hint). **§11 scenarios** → A1–A4/C1–C7/K1–K2/K4–K5/I1/I3–I4/P1–P3 in Task 16, S1–S2/I2 in Task 17, S3–S4 in Task 18, K3 in Task 19; unit contract in Tasks 2–10; Playwright in Task 20. **§12 CI** → Task 21. **§13** nothing to build.
- Types used across tasks: `ZoneId`, `Zone`, `Country`, `Continent` (Task 3); `ConvertResult` (Task 4); `ParseResult` (Task 5); `SearchEntry`/`SearchGroup` (Task 7); `MessageKey` (Task 9); `ConverterState`, `RecentEntry`, `selectPinned`, `selectParsedTime`, `selectEffectiveDate`, `initialConverterState`, `resetConverterStore` (Task 10); `useConversion` (Task 15) — names are consistent in every later task.
- Known deviations from the spec text (spec still wins if a reader disagrees — mention in the commit): `useT` lives in `src/hooks/` (spec §9 said `src/i18n/index.ts`) to keep `i18n → nothing`; the header theme button shows the *current* mode and cycles system → dark → light (spec §8.3 listed light → dark → system — order is cosmetic; the acceptance test P3 encodes the implemented order).



