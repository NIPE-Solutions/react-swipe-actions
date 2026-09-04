import { expect, test } from '@playwright/test'

import {
  beginDrag,
  drag,
  expectClosed,
  expectOpen,
  gotoFixture,
  offset,
  pointFor,
} from './helpers'

test('a slow partial swipe below threshold settles closed', async ({
  page,
}) => {
  // Catches distance-independent opening after a deliberate short drag.
  await gotoFixture(page, 'inbox')
  const root = page.getByTestId('row-1')

  await drag(page, page.getByTestId('row-1-drag-surface'), 36, {
    holdMs: 140,
  })

  await expectClosed(root)
})

test('a distance swipe opens the complete unequal-width leading side', async ({
  page,
}) => {
  // Catches settling to one action width instead of the measured side width.
  await gotoFixture(page, 'inbox')
  const root = page.getByTestId('row-1')

  await drag(page, page.getByTestId('row-1-drag-surface'), 104, {
    holdMs: 140,
  })

  await expectOpen(root, 160)
  await expect(page.getByTestId('row-1-leading')).not.toHaveAttribute(
    'aria-hidden',
  )
})

test('a short fast flick opens by velocity', async ({ page }) => {
  // Catches release resolution ignoring recent pointer velocity.
  await gotoFixture(page, 'inbox')
  const root = page.getByTestId('row-1')

  await drag(page, page.getByTestId('row-1-drag-surface'), 48, { steps: 2 })

  await expectOpen(root, 160)
})

test('a full trailing swipe invokes its action exactly once and closes', async ({
  page,
}) => {
  // Catches duplicate activation or leaving the row open after full swipe.
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await gotoFixture(page, 'inbox')
  const root = page.getByTestId('row-1')

  await drag(page, page.getByTestId('row-1-drag-surface'), -330, {
    holdMs: 120,
  })

  await expect(page.getByTestId('delete-count')).toHaveText('1')
  await expectClosed(root)
  expect(errors).toEqual([])
})

test('body scrolling over a row does not translate its content', async ({
  page,
}) => {
  // Catches wheel input over a swipe surface being trapped by gesture plumbing.
  await gotoFixture(page, 'body-scroll')
  const root = page.getByTestId('body-row-0')
  const point = await pointFor(page.getByTestId('body-row-0-drag-surface'))

  await page.mouse.move(point.x, point.y)
  await page.mouse.wheel(0, 360)

  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(100)
  await expectClosed(root)
})

test('vertical pointer intent leaves the row untranslated and wheel input scrolls', async ({
  page,
}) => {
  // Catches horizontal gesture ownership stealing a vertical scroll surface.
  await gotoFixture(page, 'overflow')
  const root = page.getByTestId('overflow-row-0')
  const surface = page.getByTestId('overflow-row-0-drag-surface')

  await drag(page, surface, 4, { dy: 96 })
  await expectClosed(root)

  const point = await pointFor(page.getByTestId('overflow-scroll'))
  await page.mouse.move(point.x, point.y)
  await page.mouse.wheel(0, 260)
  await expect
    .poll(() =>
      page
        .getByTestId('overflow-scroll')
        .evaluate((element) => element.scrollTop),
    )
    .toBeGreaterThan(100)
  await expect.poll(() => offset(root)).toBe(0)
})

test('a diagonal gesture biased to vertical never reactivates horizontally', async ({
  page,
}) => {
  // Catches axis ownership changing after a vertical decision.
  await gotoFixture(page, 'inbox')
  const root = page.getByTestId('row-1')
  const surface = page.getByTestId('row-1-drag-surface')
  const start = await pointFor(surface)

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 12, start.y + 18)
  await page.mouse.move(start.x + 130, start.y + 20)
  await page.mouse.up()

  await expectClosed(root)
})

test('buttons, links, and checkboxes keep native interaction', async ({
  page,
}) => {
  // Catches the swipe surface stealing pointer interaction from child controls.
  await gotoFixture(page, 'inbox')

  await page.getByTestId('row-button').click()
  await page.getByTestId('row-link').click()
  await page.getByTestId('row-checkbox').check()
  await expect(page.getByTestId('child-count')).toHaveText('3')
  await expect(page.getByTestId('row-checkbox')).toBeChecked()
  await expectClosed(page.getByTestId('row-1'))
})

test('touchscreen taps keep child button interaction native', async ({
  browserName,
  page,
}) => {
  // Catches touch compatibility events being mistaken for a swipe.
  test.skip(
    browserName !== 'chromium',
    'Playwright touchscreen is Chromium-only',
  )
  await gotoFixture(page, 'inbox')

  const tapPoint = await pointFor(page.getByTestId('row-button'))
  await page.touchscreen.tap(tapPoint.x, tapPoint.y)
  await expect(page.getByTestId('child-count')).toHaveText('1')
})

test('the compatibility click after a drag is suppressed', async ({ page }) => {
  // Catches a completed drag also activating the row content click handler.
  await gotoFixture(page, 'inbox')
  const surface = page.getByTestId('row-1-drag-surface')

  await drag(page, surface, 104, { holdMs: 120 })

  await expect(page.getByTestId('content-count')).toHaveText('0')
  await expectOpen(page.getByTestId('row-1'), 160)
})

test('opening a grouped row closes the previously open row', async ({
  page,
}) => {
  // Catches group coordination retaining multiple open rows.
  await gotoFixture(page, 'inbox')

  await drag(page, page.getByTestId('row-1-drag-surface'), 104, {
    holdMs: 120,
  })
  await expectOpen(page.getByTestId('row-1'), 160)
  await drag(page, page.getByTestId('row-2-drag-surface'), -104, {
    holdMs: 120,
  })

  await expectClosed(page.getByTestId('row-1'))
  await expectOpen(page.getByTestId('row-2'), -144)
})

test('a row with no actions resists horizontal travel and settles closed', async ({
  page,
}) => {
  // Catches unavailable sides moving one-to-one with the pointer or settling open.
  await gotoFixture(page, 'inbox')
  const root = page.getByTestId('no-action-row')

  await beginDrag(page, page.getByTestId('no-action-row-drag-surface'), 180)
  await expect(root).toHaveAttribute('data-state', 'dragging')
  await expect.poll(() => offset(root)).toBeGreaterThan(120)
  await expect.poll(() => offset(root)).toBeLessThan(130)
  await page.mouse.up()

  await expectClosed(root)
})

test('dialog and bottom-sheet-compatible nesting retain swipe behavior', async ({
  page,
}) => {
  // Catches containment styles or nested scroll surfaces breaking hit testing.
  await gotoFixture(page, 'containment')

  await drag(page, page.getByTestId('dialog-row-drag-surface'), 80, {
    holdMs: 120,
  })
  await expectOpen(page.getByTestId('dialog-row'), 88)
  await drag(page, page.getByTestId('sheet-row-drag-surface'), -80, {
    holdMs: 120,
  })
  await expectOpen(page.getByTestId('sheet-row'), -88)
})
