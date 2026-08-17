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
