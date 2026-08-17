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

  test('desktop dark: populated converter, default theme', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop project only')
    await populateConverter(page)
    await page.screenshot({ path: `${DIR}/desktop-dark.png`, fullPage: true })
  })

  test('desktop light: populated converter after theme toggle', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop project only')
    await populateConverter(page)
    const html = page.locator('html')
    await page.getByRole('button', { name: /theme/i }).click() // system → dark
    await page.getByRole('button', { name: /theme/i }).click() // dark → light
    await expect(html).toHaveAttribute('data-theme', 'light')
    await page.screenshot({ path: `${DIR}/desktop-light.png`, fullPage: true })
  })

  test('mobile dark: populated converter on Pixel 5 viewport', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile project only')
    await populateConverter(page)
    await page.screenshot({ path: `${DIR}/mobile-dark.png`, fullPage: true })
  })

  test('picker open: From picker showing grouped results for "mou"', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop project only')
    await page.goto('./')
    const from = page.getByRole('combobox', { name: 'From' })
    await from.click()
    await from.fill('mou')
    await expect(page.getByRole('listbox')).toBeVisible()
    await expect(page.getByRole('option', { name: '🇺🇸 United States · Mountain Time' })).toBeVisible()
    await page.screenshot({ path: `${DIR}/picker-open.png`, fullPage: true })
  })
})
