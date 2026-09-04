import { act, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import {
  Action,
  Content,
  Leading,
  Root,
  SwipeActions,
  Trailing,
} from '../../src'
import type {
  SwipeActionsActionProps,
  SwipeActionsContentProps,
  SwipeActionsGroupProps,
  SwipeActionsHandle,
  SwipeActionsRootProps,
  SwipeActionsSideProps,
} from '../../src'

describe('SwipeActions compound components', () => {
  it('renders the canonical semantic structure and documented styling hooks', () => {
    // Catches a component rendering the wrong element or dropping a public data hook.
    render(
      <SwipeActions.Group>
        <SwipeActions.Root defaultOpenSide="leading" disabled>
          <SwipeActions.Leading>
            <SwipeActions.Action onAction={() => undefined}>
              Archive
            </SwipeActions.Action>
          </SwipeActions.Leading>
          <SwipeActions.Content>Message</SwipeActions.Content>
          <SwipeActions.Trailing>
            <SwipeActions.Action
              destructive
              fullSwipe
              disabled
              onAction={() => undefined}
            >
              Delete
            </SwipeActions.Action>
          </SwipeActions.Trailing>
        </SwipeActions.Root>
      </SwipeActions.Group>,
    )

    const root = screen
      .getByText('Message')
      .closest('[data-swipe-actions-root]')
    const leading = screen.getByRole('button', {
      name: 'Archive',
    }).parentElement
    const trailing = screen.getByRole('button', {
      name: 'Delete',
    }).parentElement
    const archive = screen.getByRole('button', { name: 'Archive' })
    const remove = screen.getByRole('button', { name: 'Delete' })

    expect(root).toHaveAttribute('data-state', 'open')
    expect(root).toHaveAttribute('data-disabled', '')
    expect(screen.getByText('Message')).toHaveAttribute(
      'data-swipe-actions-content',
      '',
    )
    expect(leading).toHaveAttribute('data-swipe-actions-side', '')
    expect(leading).toHaveAttribute('data-side', 'leading')
    expect(leading).toHaveAttribute('data-active', '')
    expect(trailing).toHaveAttribute('data-swipe-actions-side', '')
    expect(trailing).toHaveAttribute('data-side', 'trailing')
    expect(trailing).not.toHaveAttribute('data-active')
    expect(archive).toHaveAttribute('type', 'button')
    expect(archive).toHaveAttribute('data-swipe-actions-action', '')
    expect(archive).toHaveAttribute('data-side', 'leading')
    expect(archive).not.toHaveAttribute('data-active')
    expect(remove).toHaveAttribute('type', 'button')
    expect(remove).toHaveAttribute('data-side', 'trailing')
    expect(remove).toHaveAttribute('data-full-swipe', '')
    expect(remove).toHaveAttribute('data-destructive', '')
    expect(remove).toHaveAttribute('data-disabled', '')
    expect(remove).toBeDisabled()
  })

  it('exposes an imperative handle while forwarding DOM refs from leaf components', () => {
    // Catches Root exposing its DOM node or leaf components swallowing consumer refs.
    const handleRef = createRef<SwipeActionsHandle>()
    const contentRef = createRef<HTMLDivElement>()
    const leadingRef = createRef<HTMLDivElement>()
    const trailingRef = createRef<HTMLDivElement>()
    const actionRef = createRef<HTMLButtonElement>()

    render(
      <Root ref={handleRef}>
        <Leading ref={leadingRef}>
          <Action ref={actionRef} onAction={() => undefined}>
            Archive
          </Action>
        </Leading>
        <Content ref={contentRef}>Message</Content>
        <Trailing ref={trailingRef} />
      </Root>,
    )

    expect(handleRef.current).toEqual({
      open: expect.any(Function),
      close: expect.any(Function),
    })
    expect(handleRef.current).not.toBeInstanceOf(HTMLElement)
    expect(contentRef.current).toBeInstanceOf(HTMLDivElement)
    expect(leadingRef.current).toBeInstanceOf(HTMLDivElement)
    expect(trailingRef.current).toBeInstanceOf(HTMLDivElement)
    expect(actionRef.current).toBeInstanceOf(HTMLButtonElement)
  })

  it('supports an imperative standalone root without requiring a group', () => {
    // Catches Root accidentally depending on Group or bypassing uncontrolled state.
    const handleRef = createRef<SwipeActionsHandle>()

    render(
      <Root ref={handleRef} data-testid="root">
        <Leading>
          <Action onAction={() => undefined}>Archive</Action>
        </Leading>
        <Content>Message</Content>
      </Root>,
    )

    act(() => handleRef.current?.open('leading'))
    expect(screen.getByTestId('root')).toHaveAttribute('data-state', 'open')
    expect(
      screen.getByRole('button', { name: 'Archive' }).parentElement,
    ).toHaveAttribute('data-active', '')

    act(() => handleRef.current?.close())
    expect(screen.getByTestId('root')).toHaveAttribute('data-state', 'closed')
  })

  it('routes imperative requests through controlled Root state', () => {
    // Catches the public handle mutating controlled state instead of requesting it.
    const handleRef = createRef<SwipeActionsHandle>()
    const onOpenSideChange = vi.fn()
    const { rerender } = render(
      <Root
        ref={handleRef}
        openSide={null}
        onOpenSideChange={onOpenSideChange}
        data-testid="root"
      >
        <Leading />
        <Trailing />
      </Root>,
    )

    act(() => handleRef.current?.open('leading'))
    expect(onOpenSideChange).toHaveBeenCalledExactlyOnceWith('leading')
    expect(screen.getByTestId('root')).toHaveAttribute('data-state', 'closed')

    rerender(
      <Root
        ref={handleRef}
        openSide="leading"
        onOpenSideChange={onOpenSideChange}
        data-testid="root"
      >
        <Leading />
        <Trailing />
      </Root>,
    )
    expect(screen.getByTestId('root')).toHaveAttribute('data-state', 'open')

    act(() => handleRef.current?.close())
    expect(onOpenSideChange).toHaveBeenNthCalledWith(2, null)
    expect(screen.getByTestId('root')).toHaveAttribute('data-state', 'open')
  })

  it('ignores imperative open and close while Root is disabled', () => {
    // Catches disabled Root allowing its public imperative handle to change state.
    const closedHandleRef = createRef<SwipeActionsHandle>()
    const openHandleRef = createRef<SwipeActionsHandle>()
    const onClosedChange = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <>
        <Root
          ref={closedHandleRef}
          disabled
          onOpenSideChange={onClosedChange}
          data-testid="closed-root"
        >
          <Leading />
        </Root>
        <Root
          ref={openHandleRef}
          disabled
          defaultOpenSide="leading"
          onOpenSideChange={onOpenChange}
          data-testid="open-root"
        >
          <Leading />
        </Root>
      </>,
    )

    act(() => {
      closedHandleRef.current?.open('leading')
      openHandleRef.current?.close()
    })

    expect(screen.getByTestId('closed-root')).toHaveAttribute(
      'data-state',
      'closed',
    )
    expect(screen.getByTestId('open-root')).toHaveAttribute(
      'data-state',
      'open',
    )
    expect(onClosedChange).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('passes through non-conflicting div and ARIA attributes', () => {
    // Catches Root silently dropping native attributes while handling direction.
    render(
      <Root
        aria-label="Message actions"
        className="consumer-row"
        dir="rtl"
        data-testid="root"
      >
        <Content>Message</Content>
      </Root>,
    )

    expect(screen.getByTestId('root')).toHaveAttribute(
      'aria-label',
      'Message actions',
    )
    expect(screen.getByTestId('root')).toHaveClass('consumer-row')
    expect(screen.getByTestId('root')).toHaveAttribute('dir', 'rtl')
  })

  it('exports the supported component prop types', () => {
    // Catches an accidental omission from the declaration entry point.
    expectTypeOf<SwipeActionsRootProps>().toBeObject()
    expectTypeOf<SwipeActionsContentProps>().toBeObject()
    expectTypeOf<SwipeActionsSideProps>().toBeObject()
    expectTypeOf<SwipeActionsActionProps>().toBeObject()
    expectTypeOf<SwipeActionsGroupProps>().toBeObject()
  })
})
