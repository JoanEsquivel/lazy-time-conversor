import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { clipboardText, picker, pickZone, reloadApp, renderApp, resultTime, timeInput, typeTime } from './harness'

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

describe('Feature: Recents', () => {
  it('S3 lists newest first, reload restores, clear persists', async () => {
    const { user } = renderApp()
    await pickZone(user, 'from', 'mou', '🇺🇸 United States · Mountain Time')
    await pickZone(user, 'to', 'costa', '🇨🇷 Costa Rica')
    await typeTime(user, '15:30{Enter}')
    // From now matches the still-set To (Costa Rica → Costa Rica): commitRecent's same-zone guard
    // must skip both this zone change and the time edit below before To moves off Costa Rica.
    await pickZone(user, 'from', 'costa', '🇨🇷 Costa Rica')
    await typeTime(user, '20:00{Enter}')
    await pickZone(user, 'to', 'india', '🇮🇳 India')
    const chips = () => screen.getAllByRole('button', { name: /→/ }).map((b) => b.textContent)
    expect(chips()).toEqual([
      '20:00 🇨🇷 Costa Rica → 🇮🇳 India',
      '15:30 🇺🇸 Mountain Time → 🇨🇷 Costa Rica',
    ])
    await user.click(screen.getByRole('button', { name: '15:30 🇺🇸 Mountain Time → 🇨🇷 Costa Rica' }))
    expect(picker('from')).toHaveValue('🇺🇸 United States · Mountain Time')
    expect(timeInput()).toHaveValue('15:30')
    expect(resultTime()).toBe('15:30')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.queryByRole('button', { name: /→/ })).not.toBeInTheDocument()
    await reloadApp()
    expect(screen.queryByRole('button', { name: /→/ })).not.toBeInTheDocument()
  })
  it('S4 caps at 8 and dedupes to the front', async () => {
    const { user } = renderApp()
    for (let h = 1; h <= 9; h++) await typeTime(user, `0${h}:00{Enter}`)
    const chips = () => screen.getAllByRole('button', { name: /→/ }).map((b) => b.textContent!)
    expect(chips()).toHaveLength(8)
    expect(chips()[0]).toMatch(/^09:00/)
    await typeTime(user, '03:00{Enter}')
    expect(chips()[0]).toMatch(/^03:00/)
    expect(chips().filter((c) => c.startsWith('03:00'))).toHaveLength(1)
    expect(chips()).toHaveLength(8)
  })
})
