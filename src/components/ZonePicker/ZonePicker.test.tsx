import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { translate } from '../../i18n'
import { ZonePicker } from './ZonePicker'

const NOW = new Date('2026-08-17T14:52:00Z')
const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate('en', k, v)

function Harness({ initial = 'America/Costa_Rica', onChange = vi.fn() }: { initial?: string; onChange?: (z: string) => void }) {
  const [value, setValue] = useState(initial)
  return <ZonePicker id="from-zone" label="From" value={value} onChange={(z) => { setValue(z); onChange(z) }} locale="en-US" pinned={['America/Costa_Rica']} now={NOW} t={t} />
}

describe('ZonePicker', () => {
  it('shows the selected zone label, current offset, and is closed', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox', { name: 'From' })
    expect(input).toHaveValue('🇨🇷 Costa Rica')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('from-zone-offset')).toHaveTextContent('UTC−6')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
  it('opens on click with pinned + continent groups, and marks the selected option', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('combobox'))
    const list = screen.getByRole('listbox')
    const groups = within(list).getAllByRole('group').map((g) => g.getAttribute('aria-label'))
    expect(groups).toEqual(['Pinned', 'Africa', 'Americas', 'Asia', 'Europe', 'Oceania'])
    expect(within(list).getAllByRole('option', { name: '🇨🇷 Costa Rica' })[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('combobox')).toHaveValue('')
  })
  it('filters while typing and selects with click', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, 'mou')
    const list = screen.getByRole('listbox')
    expect(within(list).getByRole('option', { name: '🇺🇸 United States · Mountain Time' })).toBeInTheDocument()
    expect(within(list).getAllByRole('option').length).toBeLessThanOrEqual(50)
    await user.click(within(list).getByRole('option', { name: '🇺🇸 United States · Mountain Time' }))
    expect(onChange).toHaveBeenCalledWith('America/Denver')
    expect(input).toHaveValue('🇺🇸 United States · Mountain Time')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
  it('keyboard: ArrowDown/Enter selects; Escape restores; aria-activedescendant tracks', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, 'phil')
    await user.keyboard('{ArrowDown}')
    const active = input.getAttribute('aria-activedescendant')!
    expect(document.getElementById(active)).toHaveTextContent('Philippines')
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('Asia/Manila')
    await user.click(input)
    await user.type(input, 'jap')
    await user.keyboard('{Escape}')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(input).toHaveValue('🇵🇭 Philippines')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
  it('shows a no-matches row and a keep-typing hint when truncated', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, 'zzzzqq')
    expect(screen.getByText('No matches for “zzzzqq”')).toBeInTheDocument()
    await user.clear(input)
    await user.type(input, 'a')
    expect(screen.getByText('Keep typing to narrow down…')).toBeInTheDocument()
  })
  it('lists 8 US zones and no zone suffix for single-zone countries', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('combobox'))
    const list = screen.getByRole('listbox')
    expect(within(list).getAllByRole('option', { name: /^🇺🇸 United States · / })).toHaveLength(8)
    expect(within(list).getAllByRole('option', { name: '🇮🇳 India' }).length).toBeGreaterThan(0)
  })
})
