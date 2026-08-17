import { describe, expect, it } from 'vitest'
import { decodeUrlState, encodeUrlState } from './url'

describe('url codec', () => {
  it('encodes time/date/from/to, omitting empty time and null date', () => {
    expect(encodeUrlState({ time: '15:30', date: null, from: 'America/Denver', to: 'America/Costa_Rica' }))
      .toBe('t=15%3A30&from=America%2FDenver&to=America%2FCosta_Rica')
    expect(encodeUrlState({ time: '', date: '2026-01-15', from: 'America/Denver', to: 'America/Costa_Rica' }))
      .toBe('d=2026-01-15&from=America%2FDenver&to=America%2FCosta_Rica')
  })
  it('decodes both encoded and raw forms', () => {
    expect(decodeUrlState('?t=15:30&d=2026-08-17&from=America/Denver&to=America/Costa_Rica'))
      .toEqual({ time: '15:30', date: '2026-08-17', from: 'America/Denver', to: 'America/Costa_Rica' })
    expect(decodeUrlState('t=15%3A30&from=America%2FDenver&to=America%2FCosta_Rica'))
      .toEqual({ time: '15:30', from: 'America/Denver', to: 'America/Costa_Rica' })
  })
  it('normalizes aliases and drops invalid values individually', () => {
    expect(decodeUrlState('?from=America/Boise&to=Nowhere/Land&t=25:99&d=2026-13-40'))
      .toEqual({ from: 'America/Denver' })
    expect(decodeUrlState('?t=3pm')).toEqual({ time: '15:00' })
    expect(decodeUrlState('')).toEqual({})
    expect(decodeUrlState('?foo=bar')).toEqual({})
  })
  it('round-trips', () => {
    const q = encodeUrlState({ time: '20:00', date: '2026-08-17', from: 'America/Costa_Rica', to: 'Asia/Kolkata' })
    expect(decodeUrlState('?' + q)).toEqual({ time: '20:00', date: '2026-08-17', from: 'America/Costa_Rica', to: 'Asia/Kolkata' })
  })
})
