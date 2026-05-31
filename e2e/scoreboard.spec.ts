import { test, expect, type Page } from '@playwright/test'

// These cover the cases a real browser is the only honest way to test:
// a genuine page reload + real localStorage round-trip, and the actual
// white-screen failure mode of an uncaught render error (there is no error
// boundary, so a throw blanks the whole page).

const points = (page: Page, i: number) =>
  page.locator(`[data-player="${i}"] .score.points`)
const games = (page: Page, i: number) =>
  page.locator(`[data-player="${i}"] .score.games`)
const scoreBtn = (page: Page, i: number) =>
  page.locator(`.btn-score[data-player="${i}"]`)

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  // Start every test from a clean match (storage persists across runs).
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('score survives a real page reload', async ({ page }) => {
  await scoreBtn(page, 0).click()
  await scoreBtn(page, 0).click() // 30-0
  await expect(points(page, 0)).toHaveText('30')

  await page.reload()

  // After a true browser reload the score is rehydrated from localStorage.
  await expect(points(page, 0)).toHaveText('30')
})

test('reaching a game point does not blank the screen', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  // Love → 15 → 30 → 40 → game: the path that used to throw and unmount.
  for (let n = 0; n < 4; n++) await scoreBtn(page, 0).click()

  // The scoreboard is still on screen (no white-out) and the game was awarded.
  await expect(page.locator('.scoreboard')).toBeVisible()
  await expect(games(page, 0)).toHaveText('1')
  await expect(points(page, 0)).toHaveText('0')
  expect(consoleErrors).toEqual([])
})

test('chosen theme survives a real page reload', async ({ page }) => {
  // Default theme is Roland Garros.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'rg')

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Wimbledon' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'wimbledon')

  await page.reload()

  // Rehydrated from localStorage under its own settings key.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'wimbledon')
})

test('scoring settings survive a real page reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click()
  const bestOf1 = page.getByRole('button', { name: '1', exact: true })
  await bestOf1.click()
  await expect(bestOf1).toHaveAttribute('aria-pressed', 'true')

  await page.reload()

  // Reopen settings: the chosen format was rehydrated from localStorage.
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(
    page.getByRole('button', { name: '1', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
})
