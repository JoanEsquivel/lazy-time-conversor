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
