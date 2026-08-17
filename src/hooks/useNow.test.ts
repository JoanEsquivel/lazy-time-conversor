import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clock } from '../store/clock'
import { useNow } from './useNow'

describe('useNow', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())
  it('returns clock.now() and re-reads it every interval', () => {
    let t = new Date('2026-08-17T14:52:00Z')
    vi.spyOn(clock, 'now').mockImplementation(() => t)
    const { result } = renderHook(() => useNow(1000))
    expect(result.current.toISOString()).toBe('2026-08-17T14:52:00.000Z')
    t = new Date('2026-08-17T14:53:00Z')
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.toISOString()).toBe('2026-08-17T14:53:00.000Z')
  })
})
