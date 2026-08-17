import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { zoneById, zoneLabel } from '../domain/catalog'
import { picker, pickZone, reloadApp, renderApp, resultTime, timeInput, typeTime } from './harness'

describe('Feature: Preferences', () => {
  it('P1 12h toggle affects placeholder and result, survives reload', async () => {
    const { user } = renderApp()
    await pickZone(user, 'from', 'mou', '🇺🇸 United States · Mountain Time')
    await pickZone(user, 'to', 'costa', '🇨🇷 Costa Rica')
    await typeTime(user, '15:30')
    await user.click(screen.getByRole('button', { name: '12h' }))
    expect(resultTime()).toBe('3:30 PM')
    expect(timeInput()).toHaveAttribute('placeholder', '3:30 pm')
    await reloadApp()
    expect(screen.getByRole('button', { name: '12h' })).toHaveAttribute('aria-pressed', 'true')
  })
  it('P2 Spanish UI: labels, Intl-localized names, date line; survives reload', async () => {
    const { user } = renderApp()
    await pickZone(user, 'from', 'mou', '🇺🇸 United States · Mountain Time')
    await typeTime(user, '15:30')
    await user.click(screen.getByRole('button', { name: 'ES' }))
    expect(screen.getByRole('combobox', { name: 'Desde' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Hasta' })).toBeInTheDocument()
    expect(picker('from')).toHaveValue(`🇺🇸 Estados Unidos · ${zoneLabel(zoneById('America/Denver'), 'es-CR')}`)
    expect(screen.getByTestId('result-date')).toHaveTextContent('lun, 17 ago')
    await reloadApp()
    expect(screen.getByRole('button', { name: 'ES' })).toHaveAttribute('aria-pressed', 'true')
  })
  it('P3 theme cycles dark → light → system and persists', async () => {
    const { user } = renderApp()
    const btn = () => screen.getByRole('button', { name: /theme/i })
    expect(document.documentElement.dataset.theme).toBe('light') // system + jsdom matchMedia(dark)=false
    await user.click(btn()) // system → dark
    expect(document.documentElement.dataset.theme).toBe('dark')
    await user.click(btn()) // dark → light
    expect(document.documentElement.dataset.theme).toBe('light')
    await reloadApp()
    expect(btn()).toHaveAccessibleName('Light theme')
  })
})
