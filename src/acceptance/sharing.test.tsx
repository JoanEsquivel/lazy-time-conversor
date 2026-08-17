import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { clipboardText, picker, pickZone, renderApp, resultTime, timeInput, typeTime } from './harness'

async function c1() {
  const r = renderApp()
  await pickZone(r.user, 'from', 'mou', '🇺🇸 United States · Mountain Time')
  await pickZone(r.user, 'to', 'costa', '🇨🇷 Costa Rica')
  await typeTime(r.user, '15:30')
  return r
}

describe('Feature: Sharing', () => {
  it('S1 share link round-trip (incl. alias in URL)', async () => {
    const { user } = await c1()
    await user.click(screen.getByRole('button', { name: 'Share link' }))
    const url = clipboardText()
    expect(decodeURIComponent(url)).toContain('t=15:30')
    expect(decodeURIComponent(url)).toContain('from=America/Denver')
    expect(decodeURIComponent(url)).toContain('to=America/Costa_Rica')
    expect(screen.getByRole('status')).toHaveTextContent('Link copied ✓')
    expect(window.location.search).toContain('from=America%2FDenver')
    renderApp({ search: '?t=15:30&from=America/Boise&to=America/Costa_Rica' })
    expect(picker('from')).toHaveValue('🇺🇸 United States · Mountain Time')
    expect(timeInput()).toHaveValue('15:30')
    expect(resultTime()).toBe('15:30')
  })
  it('S2 copy result text', async () => {
    const { user } = await c1()
    await user.click(screen.getByRole('button', { name: 'Copy result' }))
    expect(clipboardText()).toBe('15:30 Mountain Time (United States) → 15:30 Central Standard Time (Costa Rica) · Mon, Aug 17, 2026')
    expect(screen.getByRole('status')).toHaveTextContent('Copied ✓')
  })
})
