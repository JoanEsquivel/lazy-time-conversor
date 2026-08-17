import { cleanup, render, screen, within, type RenderResult } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { vi } from 'vitest'
import App from '../App'
import { clock } from '../store/clock'
import { initialConverterState, resetConverterStore, STORAGE_KEY, useConverterStore } from '../store/converter'

export interface RenderOpts { browserIana?: string; navigatorLanguage?: string; now?: string; search?: string; keepStorage?: boolean }

const DEFAULTS = { browserIana: 'America/Costa_Rica', navigatorLanguage: 'en-US', now: '2026-08-17T14:52:00Z', search: '' }

function freezeClock(iso: string) {
  vi.spyOn(clock, 'now').mockImplementation(() => new Date(iso))
}

export function renderApp(opts: RenderOpts = {}): { user: UserEvent } & RenderResult {
  const o = { ...DEFAULTS, ...opts }
  cleanup() // a test may render the app twice (e.g. opening a shared URL); never leave two trees mounted
  freezeClock(o.now)
  if (!o.keepStorage) resetConverterStore()
  useConverterStore.getState().bootstrap({ browserIana: o.browserIana, navigatorLanguage: o.navigatorLanguage, search: o.search })
  const user = userEvent.setup()
  // userEvent.setup() unconditionally replaces navigator.clipboard with its own copy/paste stub,
  // shadowing the vi.fn() mock installed in test/setup.ts. Re-spy so clipboardText() keeps working.
  vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
  return { user, ...render(<App />) }
}

/**
 * Simulates a page reload: fresh in-memory state, untouched storage, rehydrate, bootstrap, render.
 * The saved payload is captured and restored around the reset because zustand's persist middleware
 * writes on every setState — resetting first would overwrite storage with defaults and rehydrate
 * would read those defaults back, silently destroying the state under test.
 */
export async function reloadApp(opts: RenderOpts = {}): Promise<{ user: UserEvent } & RenderResult> {
  cleanup()
  const saved = localStorage.getItem(STORAGE_KEY)
  useConverterStore.setState(initialConverterState())
  if (saved === null) localStorage.removeItem(STORAGE_KEY)
  else localStorage.setItem(STORAGE_KEY, saved)
  await useConverterStore.persist.rehydrate()
  return renderApp({ ...opts, keepStorage: true })
}

const PICKER_LABEL: Record<'from' | 'to' | 'home', RegExp> = { from: /^(from|desde)$/i, to: /^(to|hasta)$/i, home: /home time zone|zona horaria de casa/i }

/** First match wins: while the home-hint banner is visible there are two "home" pickers (header + banner). */
export function picker(which: 'from' | 'to' | 'home'): HTMLInputElement {
  return screen.getAllByRole('combobox', { name: PICKER_LABEL[which] })[0] as HTMLInputElement
}

export async function pickZone(user: UserEvent, which: 'from' | 'to' | 'home', query: string, optionText: string | RegExp): Promise<void> {
  const input = picker(which)
  await user.click(input)
  if (query) await user.type(input, query)
  const list = screen.getByRole('listbox')
  await user.click(within(list).getByRole('option', { name: optionText }))
}

export function timeInput(): HTMLInputElement {
  return screen.getByRole('textbox', { name: /^(time|hora)$/i }) as HTMLInputElement
}
export async function typeTime(user: UserEvent, text: string): Promise<void> {
  const input = timeInput()
  await user.clear(input)
  await user.type(input, text)
}

export const resultTime = () => screen.getByTestId('result-time').textContent ?? ''
export const resultDate = () => screen.getByTestId('result-date').textContent ?? ''
export const nowLine = (which: 'from' | 'to') => screen.getByTestId(`now-${which}`).textContent ?? ''

export function clipboardText(): string {
  const fn = navigator.clipboard.writeText as unknown as { mock: { calls: string[][] } }
  return fn.mock.calls.at(-1)?.[0] ?? ''
}
