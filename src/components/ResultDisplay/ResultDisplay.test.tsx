import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clock } from '../../store/clock'
import { resetConverterStore, useConverterStore } from '../../store/converter'
import { ResultDisplay } from './ResultDisplay'

beforeEach(() => {
  resetConverterStore()
  vi.spyOn(clock, 'now').mockImplementation(() => new Date('2026-08-17T14:52:00Z'))
  const s = useConverterStore.getState()
  s.bootstrap({ browserIana: 'America/Costa_Rica' })
  s.setFromZone('America/Denver'); s.setToZone('America/Costa_Rica')
})

describe('ResultDisplay', () => {
  it('shows --:-- while the time is empty or invalid', () => {
    render(<ResultDisplay />)
    expect(screen.getByTestId('result-time')).toHaveTextContent('--:--')
    useConverterStore.getState().setTime('99:99')
    expect(screen.getByTestId('result-time')).toHaveTextContent('--:--')
  })
  it('renders the converted time, date line, day offset and offsets (C1)', () => {
    useConverterStore.getState().setTime('15:30')
    render(<ResultDisplay />)
    expect(screen.getByTestId('result-time')).toHaveTextContent('15:30')
    expect(screen.getByTestId('result-date')).toHaveTextContent('Mon, Aug 17 · same day')
    expect(screen.getByTestId('result-offsets')).toHaveTextContent('UTC-06:00 → UTC-06:00')
    expect(screen.getByTestId('result-time').closest('[aria-live="polite"]')).not.toBeNull()
  })
  it('renders next-day and 12h formats', () => {
    const s = useConverterStore.getState()
    s.setFromZone('America/Costa_Rica'); s.setToZone('Asia/Kolkata'); s.setTime('20:00'); s.setPref('hourFormat', '12h')
    render(<ResultDisplay />)
    expect(screen.getByTestId('result-time')).toHaveTextContent('7:30 AM')
    expect(screen.getByTestId('result-date')).toHaveTextContent('Tue, Aug 18 · next day (+1)')
  })
})
