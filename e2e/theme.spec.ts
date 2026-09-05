import { expect, test } from '@playwright/test'

import { beginDrag, offset } from './helpers'

test('optional theme fades a partially revealed action with its own progress', async ({
  page,
}) => {
  await page.goto('/e2e/theme-app/')
  await expect(page.getByTestId('fixture-ready')).toHaveText('ready')
  const root = page.getByTestId('theme-root')
  const surface = page.getByTestId('theme-content')
  const action = root.locator('[data-swipe-actions-action]')

  await beginDrag(page, surface, 24, 0, 1)
  await expect(root).toHaveAttribute('data-state', 'dragging')
  await expect.poll(() => offset(root)).toBeGreaterThan(20)
  const partialOpacity = Number.parseFloat(
    await action.evaluate((element) => getComputedStyle(element).opacity),
  )
  expect(partialOpacity).toBeGreaterThan(0)
  expect(partialOpacity).toBeLessThan(1)

  await page.waitForTimeout(140)
  await page.mouse.up()
  await expect(root).toHaveAttribute('data-state', 'closed')
  await expect.poll(() => offset(root)).toBe(0)
  await expect
    .poll(() =>
      action.evaluate((element) => Number(getComputedStyle(element).opacity)),
    )
    .toBe(0)
})

test('combined styles keep direct drag motion at the written coordinate', async ({
  page,
}) => {
  // Catches theme.css interpolating transform behind the pointer's direct JS writes.
  await page.goto('/e2e/theme-app/')
  await expect(page.getByTestId('fixture-ready')).toHaveText('ready')
  const root = page.getByTestId('theme-root')
  const surface = page.getByTestId('theme-content')

  await beginDrag(page, surface, 120)
  await expect(root).toHaveAttribute('data-state', 'dragging')
  await expect.poll(() => offset(root)).toBeGreaterThan(100)

  const motion = await surface.evaluate((element) => {
    const root = element.closest<HTMLElement>('[data-swipe-actions-root]')!
    const style = getComputedStyle(element)
    return {
      computedX: new DOMMatrixReadOnly(style.transform).m41,
      transitionDuration: style.transitionDuration,
      transitionProperty: style.transitionProperty,
      writtenOffset: Number.parseFloat(
        root.style.getPropertyValue('--swipe-actions-offset'),
      ),
    }
  })

  expect(
    motion.transitionProperty.split(',').map((value) => value.trim()),
  ).not.toContain('transform')
  expect(motion.transitionDuration.split(',')).toEqual(['0s'])
  expect(motion.computedX).toBeCloseTo(motion.writtenOffset, 1)
  await page.mouse.up()
})
