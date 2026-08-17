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
