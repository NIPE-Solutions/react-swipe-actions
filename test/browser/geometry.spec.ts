import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

declare global {
  interface Window {
    deliverObservedBoxes(): void
  }
}

async function dragTo(page: Page) {
  const content = page.getByTestId('content')
  const box = await content.boundingBox()
  expect(box).not.toBeNull()
  const x = box!.x + 48
  const y = box!.y + box!.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 160, y, { steps: 6 })
}

test('pre-arm expansion survives actual-size observer delivery without changing measured boxes', async ({
  page,
}) => {
  await page.goto('/e2e/app/?scenario=geometry')

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
  await page.mouse.up()
})

test('an actual action-only resize cancels a live pre-arm expansion', async ({
  page,
}) => {
  await page.goto('/e2e/app/?scenario=geometry')

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
  const naturalSideBox = await side.boundingBox()

  const resize = page.getByTestId('widen-leading-action')
  await dragTo(page)
  await expect(action).toHaveAttribute('data-full-swipe-expanding', '')

  await resize.focus()
  await page.keyboard.press('Enter')
  await page.mouse.up()

  await expect(root).toHaveAttribute('data-state', 'closed')
  await expect(action).not.toHaveAttribute('data-full-swipe-expanding')
  expect(await side.boundingBox()).toEqual(naturalSideBox)
})
