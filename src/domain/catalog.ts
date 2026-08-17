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
