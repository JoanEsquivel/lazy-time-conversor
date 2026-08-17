import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { picker, pickZone, reloadApp, renderApp } from './harness'

describe('Feature: Home zone', () => {
  it('A1 home auto-detected from browser', () => {
    renderApp({ browserIana: 'America/Costa_Rica' })
    expect(picker('home')).toHaveValue('🇨🇷 Costa Rica')
    expect(screen.getByTestId('home-badge-from')).toBeInTheDocument()
    expect(screen.queryByTestId('home-badge-to')).not.toBeInTheDocument()
  })
  it('A2 home not in catalog → Costa Rica + hint; choosing a zone in the banner fixes home', async () => {
    const { user } = renderApp({ browserIana: 'Etc/UTC' })
    expect(picker('home')).toHaveValue('🇨🇷 Costa Rica')
    const banner = screen.getByRole('status', { name: /home/i })
    expect(banner).toHaveTextContent("We couldn’t match your time zone")
    await pickZone(user, 'home', 'pacific', '🇺🇸 United States · Pacific Time')
    expect(picker('home')).toHaveValue('🇺🇸 United States · Pacific Time')
    expect(screen.queryByRole('status', { name: /home/i })).not.toBeInTheDocument()
  })
  it('A3 home is editable and persisted; from/to unchanged', async () => {
    const { user } = renderApp()
    await pickZone(user, 'home', 'india', '🇮🇳 India')
    await reloadApp()
    expect(picker('home')).toHaveValue('🇮🇳 India')
    expect(picker('from')).toHaveValue('🇨🇷 Costa Rica')
    expect(picker('to')).toHaveValue('🇺🇸 United States · Mountain Time')
  })
  it('A4 browser zone alias resolves to its group without a hint', () => {
    renderApp({ browserIana: 'America/Boise' })
    expect(picker('home')).toHaveValue('🇺🇸 United States · Mountain Time')
    expect(screen.queryByRole('status', { name: /home/i })).not.toBeInTheDocument()
  })
})
