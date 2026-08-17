import { expect, test } from '@playwright/test'

test.describe('smoke', () => {
  test('convert, swap, share and reopen the shared link', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('./')
    await expect(page.getByRole('combobox', { name: 'From' })).toHaveValue('🇨🇷 Costa Rica')
    const from = page.getByRole('combobox', { name: 'From' })
    await from.click()
    await from.fill('mou')
    await page.getByRole('option', { name: '🇺🇸 United States · Mountain Time' }).click()
    const to = page.getByRole('combobox', { name: 'To' })
    await to.click()
    await to.fill('costa')
    await page.getByRole('option', { name: '🇨🇷 Costa Rica' }).click()
    await page.getByRole('textbox', { name: 'Time' }).fill('15:30')
    await expect(page.getByTestId('result-time')).toHaveText(/15:30|16:30/) // 15:30 during US DST, 16:30 in US standard time
    await page.getByRole('button', { name: 'Swap direction' }).click()
    await expect(page.getByRole('combobox', { name: 'From' })).toHaveValue('🇨🇷 Costa Rica')
    await page.getByRole('button', { name: 'Share link' }).click()
    await expect(page.getByRole('status')).toContainText('Link copied')
    const url = page.url()
    expect(url).toContain('t=15%3A30')
    const page2 = await context.newPage()
    await page2.goto(url)
    await expect(page2.getByRole('textbox', { name: 'Time' })).toHaveValue('15:30')
    await expect(page2.getByRole('combobox', { name: 'To' })).toHaveValue('🇺🇸 United States · Mountain Time')
  })

  test('mobile: cards stack and picker opens as a sheet', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile project only')
    await page.goto('./')
    const from = page.getByRole('combobox', { name: 'From' })
    const to = page.getByRole('combobox', { name: 'To' })
    const a = await from.boundingBox(); const b = await to.boundingBox()
    expect(b!.y).toBeGreaterThan(a!.y + a!.height) // stacked
    await from.click()
    await expect(page.getByRole('listbox')).toBeVisible()
    await from.fill('japan')
    await page.getByRole('option', { name: '🇯🇵 Japan' }).click()
    await page.getByRole('textbox', { name: 'Time' }).fill('09:00')
    await expect(page.getByTestId('result-time')).not.toHaveText('--:--')
  })

  test('theme toggle persists across reload', async ({ page }) => {
    await page.goto('./')
    const html = page.locator('html')
    await page.getByRole('button', { name: /theme/i }).click() // system → dark
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await page.getByRole('button', { name: /theme/i }).click() // dark → light
    await expect(html).toHaveAttribute('data-theme', 'light')
    await page.reload()
    await expect(html).toHaveAttribute('data-theme', 'light')
  })
})
