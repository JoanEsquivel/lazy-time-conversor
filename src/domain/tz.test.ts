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
    // Denver is MST (UTC-7) on this date, Costa Rica is fixed UTC-6 (no DST) — Costa Rica is
    // 1h AHEAD of Denver in winter (they're only equal in summer, per C1). Verified against
    // Node's own Intl: at 2026-01-15T22:30Z, Denver reads 15:30 and Costa Rica reads 16:30.
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
