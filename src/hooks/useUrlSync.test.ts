import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetConverterStore, useConverterStore } from '../store/converter'
import { useUrlSync } from './useUrlSync'

describe('useUrlSync', () => {
  beforeEach(() => { resetConverterStore(); useConverterStore.getState().bootstrap({ browserIana: 'America/Costa_Rica' }); window.history.replaceState(null, '', '/') })
  it('mirrors from/to/time/date into the query string with replaceState', () => {
    renderHook(() => useUrlSync())
    expect(window.location.search).toBe('?from=America%2FCosta_Rica&to=America%2FDenver')
    // act(): the effect that rewrites the URL runs after React flushes the store update.
    act(() => {
      useConverterStore.getState().setTime('15:30')
      useConverterStore.getState().setDate('2026-01-15')
    })
    expect(window.location.search).toBe('?t=15%3A30&d=2026-01-15&from=America%2FCosta_Rica&to=America%2FDenver')
  })
})
