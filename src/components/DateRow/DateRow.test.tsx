import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clock } from '../../store/clock'
import { resetConverterStore, useConverterStore } from '../../store/converter'
import { DateRow } from './DateRow'

beforeEach(() => {
  resetConverterStore()
  vi.spyOn(clock, 'now').mockImplementation(() => new Date('2026-08-17T14:52:00Z'))
  useConverterStore.getState().bootstrap({ browserIana: 'America/Costa_Rica' })
  useConverterStore.getState().setFromZone('America/Denver')
})

describe('DateRow', () => {
  it('shows today in the from-zone by default and no reset button', () => {
    render(<DateRow />)
    expect(screen.getByTestId('date-line')).toHaveTextContent('Mon, Aug 17')
    expect(screen.queryByRole('button', { name: 'Back to today' })).not.toBeInTheDocument()
  })
  it('opens a native date input, sets an explicit date, and can reset to today', async () => {
    const user = userEvent.setup()
    render(<DateRow />)
    await user.click(screen.getByRole('button', { name: 'Pick a date' }))
    const dateInput = screen.getByLabelText('Pick a date', { selector: 'input' })
    fireEvent.change(dateInput, { target: { value: '2026-01-15' } })
    expect(useConverterStore.getState().from.date).toBe('2026-01-15')
    expect(screen.getByTestId('date-line')).toHaveTextContent('Thu, Jan 15')
    await user.click(screen.getByRole('button', { name: 'Back to today' }))
    expect(useConverterStore.getState().from.date).toBeNull()
  })
  it('Now fills time and date from the from-zone clock and commits a recent', async () => {
    const user = userEvent.setup()
    render(<DateRow />)
    await user.click(screen.getByRole('button', { name: 'Now' }))
    expect(useConverterStore.getState().from).toMatchObject({ time: '08:52', date: '2026-08-17' })
    expect(useConverterStore.getState().recents).toHaveLength(1)
  })
})
