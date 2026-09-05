import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import { drag, gotoFixture, offset } from './helpers'

async function pressForwardTab(
  page: import('@playwright/test').Page,
  browserName: string,
) {
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab')
}

async function focusedTestId(page: import('@playwright/test').Page) {
  return page.evaluate(
    () =>
      (document.activeElement as HTMLElement | null)?.dataset.testid ?? null,
  )
}

for (const state of [
  'closed',
  'leading',
  'trailing',
  'disabled',
  'group',
] as const) {
  test(`${state} state has no automatically detectable accessibility violations`, async ({
    page,
  }) => {
    // Catches hidden actions, labels, focus state, or semantics regressing for this state.
    await gotoFixture(page, 'accessibility', { state })
    await expect(page.getByTestId('accessibility-row')).toBeVisible()

    const results = await new AxeBuilder({ page }).analyze()

    expect(results.violations).toEqual([])
  })
}

test('closed and open tab order excludes hidden action sides', async ({
  browserName,
  page,
}) => {
  // Catches inert or tabindex cleanup leaving hidden action buttons reachable.
  await gotoFixture(page, 'accessibility', { state: 'closed' })
  const root = page.getByTestId('accessibility-row')

  const closedOrder: Array<string | null> = []
  for (let step = 0; step < 4; step += 1) {
    await pressForwardTab(page, browserName)
    closedOrder.push(await focusedTestId(page))
  }
  expect(closedOrder).toEqual([
    'accessibility-row',
    'open-message',
    'message-link',
    'after-fixture',
  ])
  expect(closedOrder).not.toContain('accessibility-row-leading-0')
  expect(closedOrder).not.toContain('accessibility-row-trailing-0')

  await root.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByTestId('accessibility-row-leading-0')).toBeFocused()
  const leadingOpenOrder: Array<string | null> = [await focusedTestId(page)]
  for (let step = 0; step < 3; step += 1) {
    await pressForwardTab(page, browserName)
    leadingOpenOrder.push(await focusedTestId(page))
  }
  expect(leadingOpenOrder).toEqual([
    'accessibility-row-leading-0',
    'open-message',
    'message-link',
    'after-fixture',
  ])
  expect(leadingOpenOrder).not.toContain('accessibility-row-trailing-0')
})

test('keyboard activation invokes an exposed normal Action exactly once', async ({
  page,
}) => {
  await gotoFixture(page, 'inbox')
  const root = page.getByTestId('row-1')
  await root.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByTestId('row-1-leading-0')).toBeFocused()

  await page.keyboard.press('Enter')

  await expect(page.getByTestId('archive-count')).toHaveText('1')
})

test('Escape closes an action-focused row and restores root focus', async ({
  page,
}) => {
  // Catches focus being stranded in a side as it becomes aria-hidden and inert.
  await gotoFixture(page, 'accessibility', { state: 'leading' })
  const root = page.getByTestId('accessibility-row')
  await page.getByTestId('accessibility-row-leading-0').focus()

  await page.keyboard.press('Escape')

  await expect(root).toHaveAttribute('data-state', 'closed')
  await expect(root).toBeFocused()
  await expect(page.getByTestId('accessibility-row-leading')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
})

test('disabled rows skip the root but keep content controls in tab order', async ({
  browserName,
  page,
}) => {
  // Catches disabled swipe mechanics making real content unreachable.
  await gotoFixture(page, 'accessibility', { state: 'disabled' })

  await pressForwardTab(page, browserName)

  await expect(page.getByTestId('open-message')).toBeFocused()
  await expect(page.getByTestId('accessibility-row')).not.toHaveAttribute(
    'tabindex',
  )
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('settles immediately while preserving direct dragging', async ({
    page,
  }) => {
    // Catches reduced motion disabling dragging or scheduling an animated settle.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await gotoFixture(page, 'accessibility', { state: 'closed' })
    const root = page.getByTestId('accessibility-row')
    expect(
      await page.evaluate(
        () => matchMedia('(prefers-reduced-motion: reduce)').matches,
      ),
    ).toBe(true)

    await drag(page, page.getByTestId('accessibility-row-drag-surface'), 76, {
      holdMs: 120,
    })

    expect(await offset(root)).toBe(88)
    await expect(root).toHaveAttribute('data-state', 'open', { timeout: 100 })
  })
})

for (const rows of [100, 1000] as const) {
  test(`${rows}-row route reports deterministic idle resource counts`, async ({
    page,
  }) => {
    // Catches a performance route rendering fewer rows or idle global gesture work.
    await gotoFixture(page, 'performance', { rows: String(rows) })

    await expect(page.getByTestId('performance-row')).toHaveCount(rows)
    await expect(page.getByTestId('performance-row-count')).toHaveText(
      String(rows),
    )
    await expect(page.getByTestId('observer-count')).toHaveText(
      String(rows * 5),
    )
    await expect(page.getByTestId('global-pointer-listener-count')).toHaveText(
      '0',
    )
    await expect(page.getByTestId('pending-frame-count')).toHaveText('0')
    await expect(page.getByTestId('mount-ms')).toHaveText(/^\d+(\.\d)$/)
  })
}

test('1000-row group handoff closes continuously without idle listeners', async ({
  page,
}) => {
  // Catches large-list handoff flashing the prior row closed before it settles.
  await gotoFixture(page, 'performance', { rows: '1000' })
  const first = page.getByTestId('performance-row').nth(0)
  const second = page.getByTestId('performance-row').nth(1)

  await first.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(first).toHaveAttribute('data-state', 'open')
  await first.evaluate((root) => {
    const element = root as HTMLElement & {
      __handoffObserver?: MutationObserver
      __handoffSamples?: Array<{ offset: number; state: string | null }>
    }
    element.__handoffSamples = []
    element.__handoffObserver = new MutationObserver(() => {
      element.__handoffSamples?.push({
        offset:
          Number.parseFloat(
            element.style.getPropertyValue('--swipe-actions-offset'),
          ) || 0,
        state: element.getAttribute('data-state'),
      })
    })
    element.__handoffObserver.observe(element, {
      attributes: true,
      attributeFilter: ['data-state', 'style'],
    })
  })
  await second.focus()
  await page.keyboard.press('ArrowLeft')

  await expect(first).toHaveAttribute('data-state', 'closed')
  await expect(second).toHaveAttribute('data-state', 'open')
  const handoffSamples = await first.evaluate((root) => {
    const element = root as HTMLElement & {
      __handoffObserver?: MutationObserver
      __handoffSamples?: Array<{ offset: number; state: string | null }>
    }
    element.__handoffObserver?.disconnect()
    return element.__handoffSamples ?? []
  })
  expect(
    handoffSamples.some(
      ({ offset: sampleOffset, state }) =>
        state === 'settling' && sampleOffset > 0 && sampleOffset <= 72,
    ),
  ).toBe(true)
  const handoffOffsets = handoffSamples.map(({ offset: sampleOffset }) =>
    Math.max(0, sampleOffset),
  )
  expect(
    handoffOffsets.every(
      (sampleOffset, index) =>
        index === 0 || sampleOffset <= handoffOffsets[index - 1]! + 0.5,
    ),
    JSON.stringify(handoffSamples),
  ).toBe(true)
  expect(handoffSamples.at(-1)).toEqual({ offset: 0, state: 'closed' })
  await expect(page.getByTestId('global-pointer-listener-count')).toHaveText(
    '0',
  )
})
