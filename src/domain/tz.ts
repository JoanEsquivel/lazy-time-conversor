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
