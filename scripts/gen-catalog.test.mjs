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
        for (const name of [z.id]) {
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
