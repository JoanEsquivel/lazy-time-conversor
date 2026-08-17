import { describe, expect, it } from 'vitest'
import { copyText, currentOffsetLabel, dayOffsetKey, formatDateFull, formatDateLine, formatTime, recentLabel } from './format'

describe('format', () => {
  it('formats time in 24h and 12h per locale', () => {
    expect(formatTime('15:30', '24h', 'en-US')).toBe('15:30')
    expect(formatTime('15:30', '12h', 'en-US')).toBe('3:30 PM')
    expect(formatTime('00:05', '12h', 'en-US')).toBe('12:05 AM')
    expect(formatTime('15:30', '12h', 'es-CR')).toBe('3:30 p.\u00A0m.')
  })
  it('formats date lines per locale (never via UTC-string slicing)', () => {
    expect(formatDateLine('2026-08-17', 'en-US')).toBe('Mon, Aug 17')
    expect(formatDateLine('2026-08-17', 'es-CR')).toBe('lun, 17 ago')
    expect(formatDateFull('2026-08-17', 'en-US')).toBe('Mon, Aug 17, 2026')
  })
  it('maps day offsets to i18n keys', () => {
    expect(dayOffsetKey(0)).toBe('day.same')
    expect(dayOffsetKey(1)).toBe('day.next')
    expect(dayOffsetKey(-1)).toBe('day.prev')
  })
  it('builds the copy text (spec S2)', () => {
    const text = copyText({
      from: 'America/Denver', to: 'America/Costa_Rica', time: '15:30', locale: 'en-US',
      result: { date: '2026-08-17', time: '15:30', dayOffset: 0, fromOffset: '-06:00', toOffset: '-06:00' },
    })
    expect(text).toBe('15:30 Mountain Time (United States) → 15:30 Central Standard Time (Costa Rica) · Mon, Aug 17, 2026')
  })
  it('builds recent chip labels (flag + zone for multi-zone, flag + country otherwise)', () => {
    expect(recentLabel({ from: 'America/Denver', to: 'America/Costa_Rica', time: '15:30' }, '24h', 'en-US'))
      .toBe('15:30 🇺🇸 Mountain Time → 🇨🇷 Costa Rica')
    expect(recentLabel({ from: 'America/Costa_Rica', to: 'Asia/Kolkata', time: '20:00' }, '12h', 'en-US'))
      .toBe('8:00 PM 🇨🇷 Costa Rica → 🇮🇳 India')
  })
  it('labels current offsets compactly', () => {
    expect(currentOffsetLabel(-360)).toBe('UTC−6')
    expect(currentOffsetLabel(330)).toBe('UTC+5:30')
    expect(currentOffsetLabel(0)).toBe('UTC+0')
  })
})
