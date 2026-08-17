import { existsSync, mkdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const DIR = 'screenshots'

async function populateConverter(page: import('@playwright/test').Page) {
  await page.goto('./')
  const from = page.getByRole('combobox', { name: 'From' })
  await from.click()
  await from.fill('mou')
  await page.getByRole('option', { name: '🇺🇸 United States · Mountain Time' }).click()
  const to = page.getByRole('combobox', { name: 'To' })
  await to.click()
  await to.fill('costa')
  await page.getByRole('option', { name: '🇨🇷 Costa Rica' }).click()
  await page.getByRole('textbox', { name: 'Time' }).fill('15:30')
  await expect(page.getByTestId('result-time')).toHaveText(/15:30|16:30/)
}

test.describe('review screenshots', () => {
  test.beforeAll(() => {
    if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
  })

  // Playwright's Chromium reports `prefers-color-scheme: light` unless told otherwise, so the app's
  // default `system` preference would otherwise resolve to light every time — force the media
  // feature explicitly before navigating, and assert the resulting data-theme so a regression here
  // fails the test instead of silently producing a light screenshot.
  test('desktop dark: populated converter, forced dark theme', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop project only')
    await page.emulateMedia({ colorScheme: 'dark' })
    await populateConverter(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.screenshot({ path: `${DIR}/desktop-dark.png`, fullPage: true })
  })

  test('desktop light: populated converter, forced light theme', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop project only')
    await page.emulateMedia({ colorScheme: 'light' })
    await populateConverter(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page.screenshot({ path: `${DIR}/desktop-light.png`, fullPage: true })
  })

  test('mobile dark: populated converter on Pixel 5 viewport, forced dark theme', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile project only')
    await page.emulateMedia({ colorScheme: 'dark' })
    await populateConverter(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.screenshot({ path: `${DIR}/mobile-dark.png`, fullPage: true })
  })

  test('picker open: From picker showing grouped results for "mou", forced dark theme', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop project only')
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('./')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    const from = page.getByRole('combobox', { name: 'From' })
    await from.click()
    await from.fill('mou')
    await expect(page.getByRole('listbox')).toBeVisible()
    await expect(page.getByRole('option', { name: '🇺🇸 United States · Mountain Time' })).toBeVisible()
    await page.screenshot({ path: `${DIR}/picker-open.png`, fullPage: true })
  })
})
