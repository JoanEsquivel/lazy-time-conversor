import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { picker, pickZone, renderApp, resultDate, resultTime, timeInput, typeTime } from './harness'

async function setupC1() {
  const r = renderApp()
  await pickZone(r.user, 'from', 'mou', '🇺🇸 United States · Mountain Time')
  await pickZone(r.user, 'to', 'costa', '🇨🇷 Costa Rica')
  await typeTime(r.user, '15:30')
  return r
}

describe('Feature: Conversion', () => {
  it('C1 US Mountain → Costa Rica during DST', async () => {
    await setupC1()
    expect(resultTime()).toBe('15:30')
    expect(resultDate()).toBe('Mon, Aug 17 · same day')
  })
  it('C2 …in standard time when the date is January', async () => {
    const { user } = await setupC1()
    await user.click(screen.getByRole('button', { name: 'Pick a date' }))
    fireEvent.change(screen.getByLabelText('Pick a date', { selector: 'input' }), { target: { value: '2026-01-15' } })
    expect(resultTime()).toBe('16:30')
    expect(resultDate()).toBe('Thu, Jan 15 · same day')
  })
  it('C3 reverse with swap keeps the typed time', async () => {
    const { user } = await setupC1()
    await user.click(screen.getByRole('button', { name: 'Swap direction' }))
    expect(picker('from')).toHaveValue('🇨🇷 Costa Rica')
    expect(picker('to')).toHaveValue('🇺🇸 United States · Mountain Time')
    expect(timeInput()).toHaveValue('15:30')
    expect(resultTime()).toBe('15:30')
  })
  it('C4 Costa Rica → India crosses midnight forward', async () => {
    const { user } = renderApp()
    await pickZone(user, 'to', 'india', '🇮🇳 India')
    await typeTime(user, '20:00')
    expect(resultTime()).toBe('07:30')
    expect(resultDate()).toBe('Tue, Aug 18 · next day (+1)')
  })
  it('C5 Philippines → Costa Rica crosses midnight backward', async () => {
    const { user } = renderApp()
    await pickZone(user, 'from', 'phil', '🇵🇭 Philippines')
    await pickZone(user, 'to', 'costa', '🇨🇷 Costa Rica')
    await typeTime(user, '08:00')
    expect(resultTime()).toBe('18:00')
    expect(resultDate()).toBe('Sun, Aug 16 · previous day (−1)')
  })
  it('C6 Arizona ignores DST', async () => {
    const { user } = renderApp()
    await pickZone(user, 'from', 'mountain standard', '🇺🇸 United States · Mountain Standard Time')
    await pickZone(user, 'to', 'costa', '🇨🇷 Costa Rica')
    await typeTime(user, '15:30')
    expect(resultTime()).toBe('16:30')
  })
  it.each([
    ['germany', '🇩🇪 Germany', '20:00', 'same day'],
    ['nigeria', '🇳🇬 Nigeria', '19:00', 'same day'],
    ['japan', '🇯🇵 Japan', '03:00', 'next day (+1)'],
    ['australian eastern', '🇦🇺 Australia · Australian Eastern Time', '04:00', 'next day (+1)'],
  ])('C7 any catalog zone converts: %s', async (query, option, time, day) => {
    const { user } = renderApp()
    await typeTime(user, '12:00')
    await pickZone(user, 'to', query, option)
    expect(resultTime()).toBe(time)
    expect(resultDate()).toContain(day)
  })
})
