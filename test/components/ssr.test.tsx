import { afterEach, describe, expect, it, vi } from 'vitest'

describe('SwipeActions SSR', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('imports and renders logical default state without browser globals', async () => {
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
    const { Action, Content, Leading, Root } = await import('../../src/index')
    const markup = renderToString(
      React.createElement(
        Root,
        { defaultOpenSide: 'leading', 'aria-label': 'Message actions' },
        React.createElement(
          Leading,
          null,
          React.createElement(Action, { onAction: () => undefined }, 'Archive'),
        ),
        React.createElement(Content, null, 'Message'),
      ),
    )

    expect(getComputedStyle).not.toHaveBeenCalled()
    expect(markup).toContain('data-state="open"')
    expect(markup).toContain('aria-label="Message actions"')
    expect(markup).not.toContain('aria-hidden="true"')
    expect(markup).not.toContain('tabindex="0"')
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
    const container = document.createElement('div')
    container.innerHTML = markup
    document.body.append(container)
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    let hydratedRoot: ReturnType<typeof hydrateRoot> | undefined
    await React.act(async () => {
      hydratedRoot = hydrateRoot(container, tree)
      await Promise.resolve()
    })

    const hydrationWarnings = consoleError.mock.calls.filter(([message]) =>
      /hydration|did not match|server rendered html/i.test(String(message)),
    )
    expect(hydrationWarnings).toEqual([])
    const root = container.querySelector<HTMLElement>(
      '[data-swipe-actions-root]',
    )
    expect(root?.getAttribute('data-state')).toBe('open')
    expect(root?.hasAttribute('dir')).toBe(false)
    expect(root?.getAttribute('tabindex')).toBe('0')

    React.act(() => hydratedRoot?.unmount())
    container.remove()
  })
})
