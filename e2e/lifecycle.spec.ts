import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import {
  beginDrag,
  drag,
  expectClosed,
  expectOpen,
  gotoFixture,
  offset,
  pointFor,
} from './helpers'

function pageErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

async function capturedPointerId(content: Locator) {
  return content.evaluate((element) => {
    for (let pointerId = 0; pointerId <= 32; pointerId += 1) {
      if ((element as HTMLElement).hasPointerCapture(pointerId)) {
        return pointerId
      }
    }
    return null
  })
}

async function interruptWithPointerCancel(content: Locator) {
  const pointerId = await capturedPointerId(content)
  expect(pointerId).not.toBeNull()
  await content.evaluate((element, activePointerId) => {
    element.dispatchEvent(
      new PointerEvent('pointercancel', {
        bubbles: true,
        cancelable: false,
        isPrimary: true,
        pointerId: activePointerId!,
        pointerType: 'mouse',
      }),
    )
  }, pointerId)
}

test('pointer cancellation restores the resting state', async ({ page }) => {
  // Catches pointercancel leaving capture, translation, or dragging state behind.
  const errors = pageErrors(page)
  await gotoFixture(page, 'lifecycle')
  const root = page.getByTestId('lifecycle-row')
  const content = page.getByTestId('lifecycle-row-content')

  await beginDrag(page, page.getByTestId('lifecycle-row-drag-surface'), 96)
  await expect(root).toHaveAttribute('data-state', 'dragging')
  await interruptWithPointerCancel(content)
  await page.mouse.up()

  await expectClosed(root)
  expect(errors).toEqual([])
})

test('native lost pointer capture cancels the active drag', async ({
  page,
}) => {
  // Catches capture loss leaving a stale session that consumes later pointers.
  const errors = pageErrors(page)
  await gotoFixture(page, 'lifecycle')
  const root = page.getByTestId('lifecycle-row')
  const content = page.getByTestId('lifecycle-row-content')

  await beginDrag(page, page.getByTestId('lifecycle-row-drag-surface'), 96)
  const pointerId = await capturedPointerId(content)
  expect(pointerId).not.toBeNull()
  await content.evaluate((element, activePointerId) => {
    ;(element as HTMLElement).releasePointerCapture(activePointerId!)
  }, pointerId)
  await page.mouse.up()

  await expectClosed(root)
  expect(errors).toEqual([])
})

test('window blur-equivalent cancellation restores the row', async ({
  page,
}) => {
  // Catches a window-level interruption preserving a live gesture session.
  const errors = pageErrors(page)
  await gotoFixture(page, 'lifecycle')
  const root = page.getByTestId('lifecycle-row')

  await beginDrag(page, page.getByTestId('lifecycle-row-drag-surface'), 96)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.mouse.up()

  await expectClosed(root)
  expect(errors).toEqual([])
})

test('a new grab interrupts settling from the visible coordinate', async ({
  page,
}) => {
  // Catches a settling interruption snapping to stale logical state.
  const errors = pageErrors(page)
  await gotoFixture(page, 'lifecycle')
  const root = page.getByTestId('lifecycle-row')
  const surface = page.getByTestId('lifecycle-row-drag-surface')
  const start = await pointFor(surface)

  await drag(page, surface, 74, { holdMs: 120 })
  const settlingOffset = await offset(root)
  expect(settlingOffset).toBeGreaterThan(0)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x - 24, start.y, { steps: 6 })
  await expect(root).toHaveAttribute('data-state', 'dragging')
  await expect.poll(() => offset(root)).toBeLessThan(settlingOffset)
  await interruptWithPointerCancel(page.getByTestId('lifecycle-row-content'))
  await page.mouse.up()

  await expectClosed(root)
  expect(errors).toEqual([])
})

test('an action resize during drag cancels and reconciles geometry', async ({
  page,
}) => {
  // Catches ResizeObserver changes preserving a stale drag offset.
  const errors = pageErrors(page)
  await gotoFixture(page, 'lifecycle')
  const resize = page.getByTestId('resize-action')
  await resize.focus()
  await beginDrag(page, page.getByTestId('lifecycle-row-drag-surface'), 96)
  await resize.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('lifecycle-row-leading-0')).toHaveCSS(
    'width',
    '132px',
  )
  await page.mouse.up()
  await expect(page.getByTestId('lifecycle-change-count')).toHaveText('1')
  await expectClosed(page.getByTestId('lifecycle-row'))
  expect(errors).toEqual([])
})

test('unmounting during drag cleans up without invoking an action', async ({
  page,
}) => {
  // Catches unmount cleanup firing an action or leaving a global handler error.
  const errors = pageErrors(page)
  await gotoFixture(page, 'lifecycle')
  const unmount = page.getByTestId('unmount-row')
  await beginDrag(page, page.getByTestId('lifecycle-row-drag-surface'), -96)
  await unmount.focus()
  await page.keyboard.press('Enter')
  await page.mouse.up()

  await expect(page.getByTestId('lifecycle-row')).toHaveCount(0)
  await expect(page.getByTestId('lifecycle-action-count')).toHaveText('0')
  expect(errors).toEqual([])
})

test('a controlled side change during drag becomes authoritative', async ({
  page,
}) => {
  // Catches configuration cancellation restoring stale uncontrolled state.
  const errors = pageErrors(page)
  await gotoFixture(page, 'lifecycle')
  const setTrailing = page.getByTestId('set-controlled-trailing')
  await beginDrag(page, page.getByTestId('controlled-row-drag-surface'), 76)
  await setTrailing.focus()
  await page.keyboard.press('Enter')
  await page.mouse.up()

  await expectOpen(page.getByTestId('controlled-row'), -88)
  await expect(page.getByTestId('controlled-state')).toHaveText('trailing')
  expect(errors).toEqual([])
})

test('removing the active side during drag closes safely', async ({ page }) => {
  // Catches side removal leaving an offset with no measured action container.
  const errors = pageErrors(page)
  await gotoFixture(page, 'lifecycle')
  const removeLeading = page.getByTestId('remove-leading')
  await beginDrag(page, page.getByTestId('lifecycle-row-drag-surface'), 96)
  await removeLeading.focus()
  await page.keyboard.press('Enter')
  await page.mouse.up()

  await expect(page.getByTestId('lifecycle-row-leading')).toHaveCount(0)
  await expectClosed(page.getByTestId('lifecycle-row'))
  expect(errors).toEqual([])
})

test('rapid repeated swipes settle once without page errors', async ({
  page,
}) => {
  // Catches stale animation completions winning over later swipe sessions.
  const errors = pageErrors(page)
  await gotoFixture(page, 'lifecycle')
  const root = page.getByTestId('lifecycle-row')
  const surface = page.getByTestId('lifecycle-row-drag-surface')

  await drag(page, surface, 74)
  await drag(page, surface, -164)
  await drag(page, surface, 164)
  await drag(page, surface, -164, { holdMs: 120 })

  await expectOpen(root, -88)
  await expect(page.getByTestId('lifecycle-action-count')).toHaveText('0')
  expect(errors).toEqual([])
})

test('a second active pointer cancels the first pointer session', async ({
  page,
}) => {
  // Catches multi-pointer input being merged into the primary drag.
  const errors = pageErrors(page)
  await gotoFixture(page, 'lifecycle')
  const root = page.getByTestId('lifecycle-row')
  const content = page.getByTestId('lifecycle-row-content')

  await beginDrag(page, page.getByTestId('lifecycle-row-drag-surface'), 96)
  await content.evaluate((element) => {
    element.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 120,
        clientY: 120,
        isPrimary: false,
        pointerId: 23,
        pointerType: 'touch',
      }),
    )
  })
  await page.mouse.up()

  await expectClosed(root)
  expect(errors).toEqual([])
})
