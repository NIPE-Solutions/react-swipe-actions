import { expect, test } from '@playwright/test'

import { beginDrag, gotoFixture } from './helpers'

for (const state of ['closed', 'leading', 'trailing', 'rtl'] as const) {
  test(`${state} canonical state`, async ({ page }) => {
    // Catches mechanical layering or logical-side placement changing visually.
    await gotoFixture(page, 'visual', { state })
    const stage = page.getByTestId('visual-stage')
    await expect(stage).toBeVisible()

    await expect(stage).toHaveScreenshot(`${state}.png`)
  })
}

test('armed full-swipe canonical state', async ({ page }) => {
  // Catches the full-swipe claimant failing to expand and visibly arm.
  await gotoFixture(page, 'visual', { state: 'armed' })
  const stage = page.getByTestId('visual-stage')

  await beginDrag(page, page.getByTestId('visual-row-drag-surface'), -300)
  await expect(page.getByTestId('visual-row-trailing-0')).toHaveAttribute(
    'data-active',
    '',
  )
  await expect(stage).toHaveScreenshot('armed.png')
  await page.mouse.up()
})
