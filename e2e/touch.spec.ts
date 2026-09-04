import { expect, test } from '@playwright/test'

import {
  chromiumTouchScroll,
  expectClosed,
  expectOpen,
  gotoFixture,
  pointFor,
  touchDrag,
} from './helpers'

test.use({ hasTouch: true })

test('touchscreen taps keep child button interaction native', async ({
  page,
}) => {
  // Catches touch compatibility events being mistaken for a swipe.
  await gotoFixture(page, 'inbox')

  const tapPoint = await pointFor(page.getByTestId('row-button'))
  await page.touchscreen.tap(tapPoint.x, tapPoint.y)
  await expect(page.getByTestId('child-count')).toHaveText('1')
})

test('a touch-pointer swipe opens the rendered row', async ({
  browserName,
  page,
}) => {
  // Catches the browser fixture covering only mouse pointer behavior.
  await gotoFixture(page, 'inbox')
  await expect
    .poll(() =>
      page
        .getByTestId('row-1-leading-0')
        .evaluate((element) =>
          element.style.getPropertyValue('--swipe-actions-action-width'),
        ),
    )
    .not.toBe('')
  const fidelity = await touchDrag(
    page,
    browserName,
    page.getByTestId('row-1-drag-surface'),
    104,
  )

  await expect(page.getByTestId('last-pointer-type')).toHaveText('touch')
  await expect(page.getByTestId('last-pointer-trusted')).toHaveText(
    browserName === 'chromium' ? 'true' : 'false',
  )
  await expectOpen(page.getByTestId('row-1'), 160)
  expect(fidelity).toBe(
    browserName === 'chromium' ? 'trusted' : 'synthetic-pointer-fallback',
  )
})

test('native vertical touch competition scrolls without moving the row', async ({
  browserName,
  page,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Playwright 1.58 has no trusted continuous touch API for Firefox/WebKit',
  )
  await gotoFixture(page, 'overflow')
  const root = page.getByTestId('overflow-row-0')

  await chromiumTouchScroll(
    page,
    page.getByTestId('overflow-row-0-drag-surface'),
    300,
  )

  await expect
    .poll(() =>
      page
        .getByTestId('overflow-scroll')
        .evaluate((element) => element.scrollTop),
    )
    .toBeGreaterThan(100)
  await expectClosed(root)
})
