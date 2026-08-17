import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// This file is a global Vitest setupFile, so it also loads for node-environment
// test files (e.g. scripts/**/*.test.mjs) that have no DOM at all.
const hasDom = typeof window !== 'undefined'

// jsdom lacks these browser APIs; components rely on them.
if (hasDom) {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false, media: query, onchange: null,
        addEventListener: () => {}, removeEventListener: () => {},
        addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
      }),
    })
  }
  Element.prototype.scrollIntoView ??= () => {}
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn(async () => {}) },
  })
}

afterEach(() => {
  if (!hasDom) return
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})
