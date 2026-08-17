import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetConverterStore, useConverterStore } from '../../store/converter'
import { TimeInput } from './TimeInput'

beforeEach(() => { resetConverterStore(); useConverterStore.getState().bootstrap({ browserIana: 'America/Costa_Rica' }) })

describe('TimeInput', () => {
  it('writes raw text to the store and shows no error while empty', async () => {
    const user = userEvent.setup()
    render(<TimeInput />)
    const input = screen.getByRole('textbox', { name: 'Time' })
    expect(input).toHaveAttribute('placeholder', '15:30')
    await user.type(input, '3:30 pm')
    expect(useConverterStore.getState().from.time).toBe('3:30 pm')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('flags invalid input with aria-invalid and a message', async () => {
    const user = userEvent.setup()
    render(<TimeInput />)
    const input = screen.getByRole('textbox', { name: 'Time' })
    await user.type(input, '25:99')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a time like 15:30 or 3:30 pm')
  })
  it('commits a recent on Enter and on blur when valid', async () => {
    const user = userEvent.setup()
    render(<TimeInput />)
    const input = screen.getByRole('textbox', { name: 'Time' })
    await user.type(input, '15:30{Enter}')
    expect(useConverterStore.getState().recents).toHaveLength(1)
    await user.clear(input)
    await user.type(input, '16:00')
    await user.tab()
    expect(useConverterStore.getState().recents[0].time).toBe('16:00')
  })
  it('uses the 12h placeholder when hourFormat is 12h', () => {
    useConverterStore.getState().setPref('hourFormat', '12h')
    render(<TimeInput />)
    expect(screen.getByRole('textbox', { name: 'Time' })).toHaveAttribute('placeholder', '3:30 pm')
  })
})
