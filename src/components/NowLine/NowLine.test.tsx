import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clock } from '../../store/clock'
import { resetConverterStore, useConverterStore } from '../../store/converter'
import { NowLine } from './NowLine'

beforeEach(() => {
  resetConverterStore()
  vi.spyOn(clock, 'now').mockImplementation(() => new Date('2026-08-17T14:52:00Z'))
  const s = useConverterStore.getState()
  s.bootstrap({ browserIana: 'America/Costa_Rica' })
  s.setFromZone('America/Denver'); s.setToZone('America/Costa_Rica')
})

describe('NowLine', () => {
  it('says "there" for a non-home panel and "here" for the home panel (I4)', () => {
    render(<><NowLine which="from" /><NowLine which="to" /></>)
    expect(screen.getByTestId('now-from')).toHaveTextContent('now there 08:52')
    expect(screen.getByTestId('now-to')).toHaveTextContent('now here 08:52')
  })
})
