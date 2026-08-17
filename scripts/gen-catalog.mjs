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
