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
