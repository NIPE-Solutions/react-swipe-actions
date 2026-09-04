import { afterEach, describe, expect, it, vi } from 'vitest'

describe('SwipeActions SSR', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('imports and renders closed sides hidden without browser globals', async () => {
    // Catches module initialization or server rendering reading DOM, direction, or media APIs.
    vi.resetModules()
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)
    vi.stubGlobal('MutationObserver', undefined)
    vi.stubGlobal('ResizeObserver', undefined)
    vi.stubGlobal('matchMedia', undefined)
    const getComputedStyle = vi.fn(() => {
      throw new Error('computed style is unavailable during SSR')
    })
    vi.stubGlobal('getComputedStyle', getComputedStyle)

    const React = await import('react')
    const { renderToString } = await import('react-dom/server')
    const { Action, Content, Leading, Root, Trailing } =
      await import('../../src/index')
    const markup = renderToString(
      React.createElement(
        Root,
        { 'aria-label': 'Message actions' },
        React.createElement(
          Leading,
          null,
          React.createElement(Action, { onAction: () => undefined }, 'Archive'),
        ),
        React.createElement(Content, null, 'Message'),
        React.createElement(
          Trailing,
          null,
          React.createElement(Action, { onAction: () => undefined }, 'Delete'),
        ),
      ),
    )

    expect(getComputedStyle).not.toHaveBeenCalled()
    expect(markup).toContain('data-state="closed"')
    expect(markup).toContain('aria-label="Message actions"')
    expect(markup.match(/aria-hidden="true"/g)).toHaveLength(2)
    expect(markup.match(/inert=""/g)).toHaveLength(2)
    expect(markup.match(/tabindex="-1"/g)).toHaveLength(4)
    expect(markup).not.toContain('tabindex="0"')
  })

  it('renders only the logical default-open side accessible on the server', async () => {
    // Catches server markup hiding the active logical side or exposing the inactive one.
    vi.resetModules()
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)
    const React = await import('react')
    const { renderToString } = await import('react-dom/server')
    const { Action, Content, Leading, Root, Trailing } =
      await import('../../src/index')
    const markup = renderToString(
      React.createElement(
        Root,
        { defaultOpenSide: 'leading' },
        React.createElement(
          Leading,
          null,
          React.createElement(Action, { onAction: () => undefined }, 'Archive'),
        ),
        React.createElement(Content, null, 'Message'),
        React.createElement(
          Trailing,
          null,
          React.createElement(Action, { onAction: () => undefined }, 'Delete'),
        ),
      ),
    )
    const leadingMarkup = markup.match(
      /<div[^>]*data-side="leading"[^>]*>.*?<\/div>/,
    )?.[0]
    const trailingMarkup = markup.match(
      /<div[^>]*data-side="trailing"[^>]*>.*?<\/div>/,
    )?.[0]

    expect(markup).toContain('data-state="open"')
    expect(leadingMarkup).not.toContain('aria-hidden="true"')
    expect(leadingMarkup).not.toContain('inert=""')
    expect(leadingMarkup).not.toContain('tabindex="-1"')
    expect(trailingMarkup).toContain('aria-hidden="true"')
    expect(trailingMarkup).toContain('inert=""')
    expect(trailingMarkup?.match(/tabindex="-1"/g)).toHaveLength(2)
  })

  it('hydrates identical logical markup before reconciling computed RTL without warnings', async () => {
    // Catches mounted direction or inert state leaking into the first client render and mismatching SSR.
    vi.resetModules()
    const React = await import('react')
    const { renderToString } = await import('react-dom/server')
    const { hydrateRoot } = await import('react-dom/client')
    const { Action, Content, Leading, Root, Trailing } =
      await import('../../src/index')
    const tree = React.createElement(
      'div',
      { dir: 'rtl' },
      React.createElement(
        Root,
        { defaultOpenSide: 'leading', 'aria-label': 'Message actions' },
        React.createElement(
          Leading,
          null,
          React.createElement(Action, { onAction: () => undefined }, 'Archive'),
        ),
        React.createElement(Content, null, 'Message'),
        React.createElement(
          Trailing,
          null,
          React.createElement(Action, { onAction: () => undefined }, 'Delete'),
        ),
      ),
    )
    const markup = renderToString(tree)
    expect(markup.match(/aria-hidden="true"/g)).toHaveLength(1)
    expect(markup.match(/inert=""/g)).toHaveLength(1)
    expect(markup.match(/tabindex="-1"/g)).toHaveLength(2)
    const container = document.createElement('div')
    container.innerHTML = markup
    document.body.append(container)
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const recoverableErrors: unknown[] = []

    let hydratedRoot: ReturnType<typeof hydrateRoot> | undefined
    await React.act(async () => {
      hydratedRoot = hydrateRoot(container, tree, {
        onRecoverableError: (error) => recoverableErrors.push(error),
      })
      await Promise.resolve()
    })

    const hydrationWarnings = consoleError.mock.calls.filter(([message]) =>
      /hydration|did not match|server rendered html/i.test(String(message)),
    )
    expect(hydrationWarnings).toEqual([])
    expect(recoverableErrors).toEqual([])
    const root = container.querySelector<HTMLElement>(
      '[data-swipe-actions-root]',
    )
    expect(root?.getAttribute('data-state')).toBe('open')
    expect(root?.hasAttribute('dir')).toBe(false)
    expect(root?.getAttribute('tabindex')).toBe('0')
    const leading = container.querySelector<HTMLElement>(
      '[data-swipe-actions-side][data-side="leading"]',
    )
    const trailing = container.querySelector<HTMLElement>(
      '[data-swipe-actions-side][data-side="trailing"]',
    )
    expect(leading?.hasAttribute('aria-hidden')).toBe(false)
    expect((leading as HTMLElement & { inert: boolean }).inert).toBe(false)
    expect(trailing?.getAttribute('aria-hidden')).toBe('true')
    expect((trailing as HTMLElement & { inert: boolean }).inert).toBe(true)

    React.act(() => hydratedRoot?.unmount())
    container.remove()
  })
})
