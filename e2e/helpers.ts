import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

export type TouchDragFidelity = 'trusted' | 'synthetic-pointer-fallback'

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

export async function touchDrag(
  page: Page,
  browserName: string,
  locator: Locator,
  dx: number,
  dy = 0,
  steps = 6,
): Promise<TouchDragFidelity> {
  const start = await pointFor(locator)

  if (browserName === 'chromium') {
    const session = await page.context().newCDPSession(page)
    await session.send('Input.synthesizeScrollGesture', {
      x: start.x,
      y: start.y,
      xDistance: dx,
      yDistance: dy,
      gestureSourceType: 'touch',
      speed: 800,
    })
    await session.detach()
    return 'trusted'
  }

  // Playwright 1.58 exposes continuous trusted touch input only through
  // Chromium's CDP. Its cross-browser Touchscreen API is tap-only, so Firefox
  // and WebKit use Playwright's documented untrusted event fallback for the
  // component gesture assertion. Native touch scrolling is tested separately
  // and only where the browser protocol can actually generate it.
  const pointerId = 41
  await locator.dispatchEvent('pointerdown', {
    bubbles: true,
    button: 0,
    buttons: 1,
    clientX: start.x,
    clientY: start.y,
    isPrimary: true,
    pointerId,
    pointerType: 'touch',
  })
  for (let step = 1; step <= steps; step += 1) {
    await locator.dispatchEvent('pointermove', {
      bubbles: true,
      button: -1,
      buttons: 1,
      clientX: start.x + (dx * step) / steps,
      clientY: start.y + (dy * step) / steps,
      isPrimary: true,
      pointerId,
      pointerType: 'touch',
    })
  }
  await locator.dispatchEvent('pointerup', {
    bubbles: true,
    button: 0,
    buttons: 0,
    clientX: start.x + dx,
    clientY: start.y + dy,
    isPrimary: true,
    pointerId,
    pointerType: 'touch',
  })
  return 'synthetic-pointer-fallback'
}

export async function chromiumTouchScroll(
  page: Page,
  locator: Locator,
  distance: number,
) {
  const start = await pointFor(locator)
  const session = await page.context().newCDPSession(page)
  const touchPoint = (y: number) => [
    {
      id: 1,
      x: start.x,
      y,
      radiusX: 1,
      radiusY: 1,
      force: 1,
    },
  ]

  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: touchPoint(start.y),
    })
    for (let step = 1; step <= 8; step += 1) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: touchPoint(start.y - (distance * step) / 8),
      })
    }
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
  } finally {
    await session.detach()
  }
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
