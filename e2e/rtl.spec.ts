import { expect, test } from '@playwright/test'

import {
  beginDrag,
  drag,
  expectClosed,
  expectOpen,
  gotoFixture,
} from './helpers'

test('document RTL maps a leftward swipe to logical leading', async ({
  page,
}) => {
  // Catches document direction being ignored when no direction prop is set.
  await gotoFixture(page, 'rtl', { mode: 'document' })

  await drag(page, page.getByTestId('rtl-root-drag-surface'), -76, {
    holdMs: 120,
  })

  await expectOpen(page.getByTestId('rtl-root'), -88)
  await expect(page.getByTestId('rtl-root-leading')).not.toHaveAttribute(
    'aria-hidden',
  )
})

test('nested RTL resolves independently from an LTR document', async ({
  page,
}) => {
  // Catches resolving direction from documentElement instead of the root ancestry.
  await gotoFixture(page, 'rtl', { mode: 'nested' })
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')

  await drag(page, page.getByTestId('rtl-root-drag-surface'), -76, {
    holdMs: 120,
  })

  await expectOpen(page.getByTestId('rtl-root'), -88)
})

test('an explicit LTR direction overrides an RTL ancestor', async ({
  page,
}) => {
  // Catches computed CSS direction overriding the public direction prop.
  await gotoFixture(page, 'rtl', { mode: 'explicit' })

  await drag(page, page.getByTestId('rtl-root-drag-surface'), 76, {
    holdMs: 120,
  })

  await expectOpen(page.getByTestId('rtl-root'), 88)
  await expect(page.getByTestId('rtl-root')).toHaveAttribute('dir', 'ltr')
})

test('runtime direction changes remap an open logical side', async ({
  page,
}) => {
  // Catches direction changes reinterpreting leading as a physical side.
  await gotoFixture(page, 'rtl', { mode: 'runtime', open: 'leading' })
  const root = page.getByTestId('rtl-root')
  await expectOpen(root, 88)

  await page.getByTestId('toggle-direction').click()

  await expect(page.getByTestId('direction-state')).toHaveText('rtl')
  await expectOpen(root, -88)
  await expect(page.getByTestId('rtl-root-leading')).not.toHaveAttribute(
    'aria-hidden',
  )
})

test('runtime direction changes cancel an active drag', async ({ page }) => {
  // Catches a coordinate-system change preserving stale pointer deltas.
  await gotoFixture(page, 'rtl', { mode: 'runtime' })
  const toggle = page.getByTestId('toggle-direction')

  await beginDrag(page, page.getByTestId('rtl-root-drag-surface'), 76)
  await toggle.focus()
  await page.keyboard.press('Enter')
  await page.mouse.up()

  await expect(page.getByTestId('direction-state')).toHaveText('rtl')
  await expectClosed(page.getByTestId('rtl-root'))
})

test('RTL keyboard arrows map physically and Escape restores root focus', async ({
  page,
}) => {
  // Catches treating ArrowRight as trailing regardless of writing direction.
  await gotoFixture(page, 'rtl', { mode: 'document' })
  const root = page.getByTestId('rtl-root')
  await root.focus()

  await page.keyboard.press('ArrowRight')

  await expectOpen(root, -88)
  await expect(page.getByTestId('rtl-root-leading-0')).toBeFocused()
  await page.keyboard.press('Escape')
  await expectClosed(root)
  await expect(root).toBeFocused()

  await page.keyboard.press('ArrowLeft')
  await expectOpen(root, 88)
  await expect(page.getByTestId('rtl-root-trailing-0')).toBeFocused()
})
