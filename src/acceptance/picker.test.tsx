import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { COUNTRIES } from '../domain/catalog'
import { convert } from '../domain/tz'
import { picker, pickZone, renderApp, resultTime } from './harness'

describe('Feature: Picker', () => {
  it('K1 search by zone name, choose with keyboard, result updates', async () => {
    const { user } = renderApp()
    await pickZone(user, 'to', 'costa', '🇨🇷 Costa Rica')
    await user.type(screen.getByRole('textbox', { name: 'Time' }), '15:30')
    const from = picker('from')
    await user.click(from)
    await user.type(from, 'mou')
    const list = screen.getByRole('listbox')
    expect(within(list).getByRole('option', { name: '🇺🇸 United States · Mountain Time' })).toBeInTheDocument()
    expect(within(list).getByRole('option', { name: '🇺🇸 United States · Mountain Standard Time' })).toBeInTheDocument()
    expect(within(list).getAllByRole('option').length).toBeLessThanOrEqual(50)
    // Walk with ArrowDown until "Mountain Time" is the active descendant, then Enter.
    for (let i = 0; i < 50; i++) {
      const activeId = from.getAttribute('aria-activedescendant')
      if (activeId && document.getElementById(activeId)?.textContent?.includes('United States · Mountain Time')) break
      await user.keyboard('{ArrowDown}')
    }
    await user.keyboard('{Enter}')
    expect(from).toHaveValue('🇺🇸 United States · Mountain Time')
    expect(resultTime()).toBe('15:30') // Denver 15:30 MDT → Costa Rica 15:30 (C1)
  })
  it('K2 search by city, by localized name (ES) and by offset', async () => {
    const { user } = renderApp()
    const from = picker('from')
    await user.click(from); await user.type(from, 'denver')
    expect(within(screen.getByRole('listbox')).getAllByRole('option')[0]).toHaveTextContent('🇺🇸 United States · Mountain Time')
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'ES' }))
    const fromEs = picker('from')
    await user.click(fromEs); await user.type(fromEs, 'alemania')
    expect(within(screen.getByRole('listbox')).getAllByRole('option')[0]).toHaveTextContent('🇩🇪 Alemania')
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'EN' }))
    const fromEn = picker('from')
    await user.click(fromEn); await user.type(fromEn, '+5:30')
    expect(within(screen.getByRole('listbox')).getByRole('option', { name: '🇮🇳 India' })).toBeInTheDocument()
  })
  it('K4 groups in order; single-zone rendering; US lists 8 zones', async () => {
    const { user } = renderApp()
    await user.click(picker('from'))
    const list = screen.getByRole('listbox')
    expect(within(list).getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['Pinned', 'Africa', 'Americas', 'Asia', 'Europe', 'Oceania'])
    expect(within(list).getAllByRole('option', { name: '🇨🇷 Costa Rica' }).length).toBeGreaterThan(0)
    expect(within(list).getAllByRole('option', { name: /^🇺🇸 United States · / })).toHaveLength(8)
  })
  it('K5 catalog sanity: ≥240 countries and every zone converts', () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(240)
    for (const c of COUNTRIES) for (const z of c.zones) {
      expect(() => convert({ date: '2026-08-17', time: '12:00', from: 'America/Costa_Rica', to: z.id })).not.toThrow()
    }
  })
  it('K3 ⌘K focuses the From picker; keyboard-only selection; Esc restores', async () => {
    const { user } = renderApp()
    await user.keyboard('{Meta>}k{/Meta}')
    expect(picker('from')).toHaveFocus()
    await user.keyboard('phil{Enter}')
    expect(picker('from')).toHaveValue('🇵🇭 Philippines')
    await user.click(picker('from'))
    await user.keyboard('jap{Escape}')
    expect(picker('from')).toHaveValue('🇵🇭 Philippines')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
