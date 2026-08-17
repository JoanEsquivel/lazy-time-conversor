import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:4173/lazy-time-conversor/', trace: 'retain-on-failure', timezoneId: 'America/Costa_Rica', locale: 'en-US' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://localhost:4173/lazy-time-conversor/', reuseExistingServer: !process.env.CI, timeout: 60_000 },
})
