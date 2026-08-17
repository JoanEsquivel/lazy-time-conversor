import { zoneForIana, type ZoneId } from './catalog'
import { parseTime } from './timeParse'
import type { HHMM, ISODate } from './types'

export interface UrlState { time?: HHMM; date?: ISODate; from?: ZoneId; to?: ZoneId }

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isValidISODate(s: string): s is ISODate {
  const m = ISO_DATE.exec(s)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

export function encodeUrlState(s: { time: string; date: ISODate | null; from: ZoneId; to: ZoneId }): string {
  const p = new URLSearchParams()
  if (s.time.trim() !== '') p.set('t', s.time.trim())
  if (s.date) p.set('d', s.date)
  p.set('from', s.from)
  p.set('to', s.to)
  return p.toString()
}

export function decodeUrlState(search: string): UrlState {
  const out: UrlState = {}
  let p: URLSearchParams
  try { p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search) } catch { return out }
  const t = p.get('t')
  if (t) { const r = parseTime(t); if (r.ok) out.time = r.time }
  const d = p.get('d')
  if (d && isValidISODate(d)) out.date = d
  const from = p.get('from')
  if (from) { const z = zoneForIana(from); if (z) out.from = z.id }
  const to = p.get('to')
  if (to) { const z = zoneForIana(to); if (z) out.to = z.id }
  return out
}
