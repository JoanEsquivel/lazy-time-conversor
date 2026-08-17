import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetConverterStore, useConverterStore } from '../store/converter'
import { resolveTheme, useTheme } from './useTheme'

describe('useTheme', () => {
  beforeEach(() => { resetConverterStore(); document.documentElement.removeAttribute('data-theme') })
  it('resolveTheme', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
  it('applies data-theme and follows the preference', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((q) => ({ matches: q.includes('dark'), media: q, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false }) as MediaQueryList)
    renderHook(() => useTheme())
    expect(document.documentElement.dataset.theme).toBe('dark') // system + dark OS
    // act(): React 19 does not flush external-store updates synchronously, so without it the
    // effect has not re-run when the next line asserts.
    act(() => { useConverterStore.getState().setPref('theme', 'light') })
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
