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
