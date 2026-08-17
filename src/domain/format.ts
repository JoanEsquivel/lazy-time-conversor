import { countryByCode, countryName, zoneById, zoneLabel, type ZoneId } from './catalog'
import type { ConvertResult } from './tz'
import type { HHMM, HourFormat, ISODate, Locale } from './types'

function utcDate(date: ISODate, h = 12, min = 0): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, h, min))
}

export function formatTime(time: HHMM, hourFormat: HourFormat, locale: Locale): string {
  if (hourFormat === '24h') return time
  const [h, min] = time.split(':').map(Number)
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })
    .format(new Date(Date.UTC(2000, 0, 1, h, min)))
}

export function formatDateLine(date: ISODate, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(utcDate(date))
}

export function formatDateFull(date: ISODate, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(utcDate(date))
}

export function dayOffsetKey(offset: -1 | 0 | 1): 'day.same' | 'day.next' | 'day.prev' {
  return offset === 0 ? 'day.same' : offset > 0 ? 'day.next' : 'day.prev'
}

function zoneWithCountry(id: ZoneId, locale: Locale): string {
  const z = zoneById(id)
  return `${zoneLabel(z, locale)} (${countryName(z.country, locale)})`
}

export function copyText(a: { from: ZoneId; to: ZoneId; time: HHMM; result: ConvertResult; locale: Locale }): string {
  return `${a.time} ${zoneWithCountry(a.from, a.locale)} → ${a.result.time} ${zoneWithCountry(a.to, a.locale)} · ${formatDateFull(a.result.date, a.locale)}`
}

function chipSide(id: ZoneId, locale: Locale): string {
  const z = zoneById(id)
  const c = countryByCode(z.country)
  return `${c.flag} ${c.zones.length > 1 ? zoneLabel(z, locale) : countryName(c.code, locale)}`
}

export function recentLabel(e: { from: ZoneId; to: ZoneId; time: HHMM }, hourFormat: HourFormat, locale: Locale): string {
  return `${formatTime(e.time, hourFormat, locale)} ${chipSide(e.from, locale)} → ${chipSide(e.to, locale)}`
}

export function currentOffsetLabel(minutes: number): string {
  const sign = minutes < 0 ? '−' : '+'
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`
}
