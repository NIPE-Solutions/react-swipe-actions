import { expect, test } from '@playwright/test'

for (const width of [1440, 390, 320]) {
  test(`homepage support links remain usable at ${String(width)}px`, async ({
    page,
    browserName,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const support = page.getByRole('region', {
      name: 'Useful in your project?',
    })
    await expect(support).toBeVisible()
    await expect(
      support.getByRole('heading', {
        level: 2,
        name: 'Useful in your project?',
      }),
    ).toBeVisible()
    expect(
      await support.evaluate((section) =>
        section.previousElementSibling?.matches('.opening'),
      ),
    ).toBe(true)

    const star = support.getByRole('link', { name: 'Star on GitHub' })
    const explore = support.getByRole('link', {
      name: 'Explore NIPE Open Source',
    })
    await expect(star).toHaveAttribute(
      'href',
      'https://github.com/NIPE-Solutions/react-swipe-actions',
    )
    await expect(explore).toHaveAttribute(
      'href',
      'https://opensource.nipesolutions.com',
    )
    await expect(support.locator('p')).not.toBeEmpty()
    await support.scrollIntoViewIfNeeded()
    for (const link of [star, explore]) {
      await expect(link).toBeVisible()
      const box = await link.boundingBox()
      expect(box).not.toBeNull()
      if (!box) throw new Error('Support link is not measurable')
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
    }
    expect(
      await support.evaluate(
        (section) => section.scrollWidth <= section.clientWidth,
      ),
    ).toBe(true)

    await star.focus()
    const macWebKit = browserName === 'webkit' && process.platform === 'darwin'
    const tab = macWebKit ? 'Alt+Tab' : 'Tab'
    await page.keyboard.press(macWebKit ? 'Shift+Alt+Tab' : 'Shift+Tab')
    await page.keyboard.press(tab)
    await expect(star).toBeFocused()
    const outline = await star.evaluate((link) => {
      const style = getComputedStyle(link)
      return {
        width: parseFloat(style.outlineWidth),
        style: style.outlineStyle,
      }
    })
    expect(outline.width).toBeGreaterThanOrEqual(2)
    expect(outline.style).not.toBe('none')
    await page.keyboard.press(tab)
    await expect(explore).toBeFocused()
    await expect(explore).toHaveCSS('outline-style', 'solid')
    expect(
      await explore.evaluate((link) =>
        parseFloat(getComputedStyle(link).outlineWidth),
      ),
    ).toBeGreaterThanOrEqual(2)
    if (process.env.SUPPORT_CTA_SCREENSHOTS === '1')
      await support.screenshot({
        path: testInfo.outputPath('support-cta.png'),
      })
  })
}
