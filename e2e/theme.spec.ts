import { expect, test } from '@playwright/test'

import { beginDrag, offset } from './helpers'

test('combined styles keep direct drag motion at the written coordinate', async ({
  page,
}) => {
  // Catches theme.css interpolating transform behind the pointer's direct JS writes.
  await page.goto('/e2e/theme-app/')
  await expect(page.getByTestId('fixture-ready')).toHaveText('ready')
  const root = page.getByTestId('theme-root')
  const surface = page.getByTestId('theme-content')

  await beginDrag(page, surface, 120, 0, 1)
  await expect(root).toHaveAttribute('data-state', 'dragging')

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
  expect(await offset(root)).toBeGreaterThan(100)
  await page.mouse.up()
})
