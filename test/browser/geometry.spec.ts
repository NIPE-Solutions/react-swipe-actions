import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

declare global {
  interface Window {
    deliverObservedBoxes(): void
  }
}

async function dragTo(page: Page) {
  const content = page.getByTestId('content')
  await content.dispatchEvent('pointerdown', {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    clientX: 0,
    clientY: 0,
  })
  await content.dispatchEvent('pointermove', {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    clientX: 160,
    clientY: 0,
  })
}

test('pre-arm expansion survives actual-size observer delivery without changing measured boxes', async ({
  page,
}) => {
  await page.goto('/test/browser/geometry.html')

  const root = page.getByTestId('root')
  const side = page.getByTestId('leading')
  const action = page.getByTestId('leading-action')

  await expect
    .poll(() =>
      action.evaluate((element) =>
        element.style.getPropertyValue('--swipe-actions-action-width'),
      ),
    )
    .not.toBe('')

  const naturalBoxes = await Promise.all([
    side.boundingBox(),
    action.boundingBox(),
  ])

  await dragTo(page)

  await expect(action).toHaveAttribute('data-full-swipe-expanding', '')
  await expect(action).not.toHaveAttribute('data-active')
  await expect(action).toHaveCSS(
    '--swipe-actions-full-swipe-expansion-width',
    '160px',
  )

  expect(await Promise.all([side.boundingBox(), action.boundingBox()])).toEqual(
    naturalBoxes,
  )

  await page.evaluate(() => window.deliverObservedBoxes())

  await expect(root).toHaveAttribute('data-state', 'dragging')
  await expect(action).toHaveAttribute('data-full-swipe-expanding', '')
  await expect(action).not.toHaveAttribute('data-active')
  expect(await Promise.all([side.boundingBox(), action.boundingBox()])).toEqual(
    naturalBoxes,
  )
})
