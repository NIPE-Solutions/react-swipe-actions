import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

export async function gotoFixture(
  page: Page,
  scenario: string,
  state: Record<string, string> = {},
) {
  const params = new URLSearchParams({ scenario, ...state })
  await page.goto(`/e2e/app/?${params}`)
  await expect(page.getByTestId('fixture-ready')).toHaveText('ready')
}

export async function pointFor(locator: Locator) {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return {
    x: box!.x + box!.width / 2,
    y: box!.y + box!.height / 2,
  }
}

export async function beginDrag(
  page: Page,
  locator: Locator,
  dx: number,
  dy = 0,
  steps = 6,
) {
  const start = await pointFor(locator)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + dx, start.y + dy, { steps })
  return start
}

export async function drag(
  page: Page,
  locator: Locator,
  dx: number,
  options: { dy?: number; steps?: number; holdMs?: number } = {},
) {
  const start = await beginDrag(
    page,
    locator,
    dx,
    options.dy ?? 0,
    options.steps ?? 6,
  )
  if (options.holdMs !== undefined) {
    await page.waitForTimeout(options.holdMs)
  }
  await page.mouse.up()
  return start
}

export async function offset(locator: Locator) {
  return locator.evaluate((element) => {
    const value = (element as HTMLElement).style.getPropertyValue(
      '--swipe-actions-offset',
    )
    return Number.parseFloat(value) || 0
  })
}

export async function expectClosed(root: Locator) {
  await expect(root).toHaveAttribute('data-state', 'closed')
  await expect.poll(() => offset(root)).toBe(0)
}

export async function expectOpen(root: Locator, expectedOffset: number) {
  await expect(root).toHaveAttribute('data-state', 'open')
  await expect.poll(() => offset(root)).toBe(expectedOffset)
}
