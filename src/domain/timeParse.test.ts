import { describe, expect, it } from 'vitest'
import { parseTime } from './timeParse'

describe('parseTime', () => {
  it.each([
    ['15:30', '15:30'], ['1530', '15:30'], ['930', '09:30'], ['9:5', '09:05'], ['9', '09:00'], ['0:00', '00:00'],
    ['3:30 pm', '15:30'], ['3:30pm', '15:30'], ['3pm', '15:00'], ['3 PM', '15:00'], ['3p', '15:00'],
    ['12am', '00:00'], ['12pm', '12:00'], ['12:30 a.m.', '00:30'], ['  7:45 AM ', '07:45'], ['23:59', '23:59'],
  ])('accepts %s → %s', (raw, expected) => {
    expect(parseTime(raw)).toEqual({ ok: true, time: expected })
  })

  it.each(['24:00', '25:00', '13pm', '0pm', '3:60', 'abc', '15:3x', '1:2:3', '99999'])('rejects %s', (raw) => {
    expect(parseTime(raw)).toEqual({ ok: false, reason: 'invalid' })
  })

  it('reports empty input separately', () => {
    expect(parseTime('')).toEqual({ ok: false, reason: 'empty' })
    expect(parseTime('   ')).toEqual({ ok: false, reason: 'empty' })
  })
})
