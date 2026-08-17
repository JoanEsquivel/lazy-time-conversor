import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { nowLine, pickZone, renderApp, resultTime, timeInput, typeTime } from './harness'

describe('Feature: Input', () => {
  it.each([['3:30 pm', '15:30'], ['1530', '15:30'], ['3pm', '15:00']])('I1 accepts %s', async (raw, expected) => {
    const { user } = renderApp()
    await pickZone(user, 'to', 'costa', '🇨🇷 Costa Rica') // CR → CR: identity, so result == parsed input
    await typeTime(user, raw)
    expect(resultTime()).toBe(expected)
  })
  it('I3 Now fills the input from the from-zone clock', async () => {
    const { user } = renderApp({ now: '2026-08-17T14:52:00Z' })
    await pickZone(user, 'from', 'mou', '🇺🇸 United States · Mountain Time')
    await user.click(screen.getByRole('button', { name: 'Now' }))
    expect(timeInput()).toHaveValue('08:52')
    expect(screen.getByTestId('date-line')).toHaveTextContent('Mon, Aug 17')
  })
  it('I4 live now clocks say there/here', async () => {
    const { user } = renderApp({ now: '2026-08-17T14:52:00Z' })
    await pickZone(user, 'from', 'mou', '🇺🇸 United States · Mountain Time')
    await pickZone(user, 'to', 'costa', '🇨🇷 Costa Rica')
    expect(nowLine('from')).toBe('now there 08:52')
    expect(nowLine('to')).toBe('now here 08:52')
  })
})
