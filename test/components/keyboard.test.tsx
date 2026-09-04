import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Action, Content, Leading, Root, Trailing } from '../../src'
import type { SwipeActionsDirection } from '../../src'

function KeyboardRow({
  direction = 'ltr',
  disabled = false,
  defaultOpenSide,
  onOpenSideChange = () => undefined,
}: {
  direction?: SwipeActionsDirection
  disabled?: boolean
  defaultOpenSide?: 'leading' | 'trailing'
  onOpenSideChange?: (side: 'leading' | 'trailing' | null) => void
}) {
  return (
    <Root
      aria-label="Message actions"
      data-testid="root"
      {...(defaultOpenSide === undefined ? {} : { defaultOpenSide })}
      direction={direction}
      disabled={disabled}
      onOpenSideChange={onOpenSideChange}
    >
      <Leading data-testid="leading">
        <Action disabled onAction={() => undefined}>
          Disabled archive
        </Action>
        <Action onAction={() => undefined}>Archive</Action>
      </Leading>
      <Content>
        <button type="button" onKeyDown={(event) => event.preventDefault()}>
          Handled child
        </button>
        <input aria-label="Subject" />
        <button type="button">Open message</button>
        <a href="#message">Open message link</a>
        <div role="slider" tabIndex={0} data-testid="custom-slider">
          Volume
        </div>
        <details>
          <summary data-testid="summary">Message details</summary>
        </details>
        <audio controls data-testid="audio" />
        <video controls data-testid="video" />
        <span data-testid="plain-content">Plain metadata</span>
      </Content>
      <Trailing data-testid="trailing">
        <Action onAction={() => undefined}>Delete</Action>
      </Trailing>
    </Root>
  )
}

describe('SwipeActions keyboard disclosure', () => {
  it.each([
    ['ltr', 'ArrowLeft', 'leading', 'Archive'],
    ['ltr', 'ArrowRight', 'trailing', 'Delete'],
    ['rtl', 'ArrowLeft', 'trailing', 'Delete'],
    ['rtl', 'ArrowRight', 'leading', 'Archive'],
  ] as const)(
    'maps physical %s %s disclosure to logical %s and focuses its first enabled action',
    (direction, key, expectedSide, actionName) => {
      // Catches treating arrow names as logical sides or focusing a disabled first action.
      const onOpenSideChange = vi.fn()
      render(
        <KeyboardRow
          direction={direction}
          onOpenSideChange={onOpenSideChange}
        />,
      )
      const root = screen.getByTestId('root')
      root.focus()

      fireEvent.keyDown(root, { key })

      expect(onOpenSideChange).toHaveBeenCalledExactlyOnceWith(expectedSide)
      expect(screen.getByTestId(expectedSide)).not.toHaveAttribute(
        'aria-hidden',
      )
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: actionName }),
      )
    },
  )

  it.each([
    ['custom role control', 'custom-slider'],
    ['summary', 'summary'],
    ['audio controls', 'audio'],
    ['video controls', 'video'],
  ] as const)(
    'does not steal physical arrows from %s descendants',
    (_label, testId) => {
      // Catches keyboard controls outside the pointer-interactive selector opening a side.
      const onOpenSideChange = vi.fn()
      render(<KeyboardRow onOpenSideChange={onOpenSideChange} />)
      const target = screen.getByTestId(testId)
      const left = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'ArrowLeft',
      })
      const right = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'ArrowRight',
      })

      fireEvent(target, left)
      fireEvent(target, right)

      expect(onOpenSideChange).not.toHaveBeenCalled()
      expect(left.defaultPrevented).toBe(false)
      expect(right.defaultPrevented).toBe(false)
      expect(screen.getByTestId('root')).toHaveAttribute('data-state', 'closed')
    },
  )

  it('keeps ordinary noninteractive descendants eligible for arrow disclosure', () => {
    // Catches an over-broad keyboard guard disabling disclosure from normal row content.
    const onOpenSideChange = vi.fn()
    render(<KeyboardRow onOpenSideChange={onOpenSideChange} />)
    const arrow = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'ArrowLeft',
    })

    fireEvent(screen.getByTestId('plain-content'), arrow)

    expect(onOpenSideChange).toHaveBeenCalledExactlyOnceWith('leading')
    expect(arrow.defaultPrevented).toBe(true)
  })

  it('ignores Root shortcuts from editable controls, modified keys, and handled descendants', () => {
    // Catches disclosure stealing editing keys, browser shortcuts, or descendant-owned events.
    const onOpenSideChange = vi.fn()
    render(<KeyboardRow onOpenSideChange={onOpenSideChange} />)
    const root = screen.getByTestId('root')
    const input = screen.getByRole('textbox', { name: 'Subject' })

    input.focus()
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    fireEvent.keyDown(input, { key: 'Escape' })
    root.focus()
    fireEvent.keyDown(root, { key: 'ArrowRight', ctrlKey: true })
    fireEvent.keyDown(root, { key: 'ArrowLeft', shiftKey: true })
    fireEvent.keyDown(screen.getByRole('button', { name: 'Handled child' }), {
      key: 'ArrowRight',
    })

    expect(onOpenSideChange).not.toHaveBeenCalled()
    expect(root).toHaveAttribute('data-state', 'closed')
  })

  it('closes on Escape and restores Root focus only when the closing side owned focus', () => {
    // Catches focus remaining in an aria-hidden side or unrelated content focus being stolen.
    const onOpenSideChange = vi.fn()
    const rendered = render(
      <KeyboardRow
        defaultOpenSide="leading"
        onOpenSideChange={onOpenSideChange}
      />,
    )
    const root = screen.getByTestId('root')
    const archive = screen.getByRole('button', { name: 'Archive' })

    archive.focus()
    fireEvent.keyDown(archive, { key: 'Escape' })

    expect(root).toHaveAttribute('data-state', 'closed')
    expect(document.activeElement).toBe(root)
    expect(onOpenSideChange).toHaveBeenCalledExactlyOnceWith(null)

    rendered.unmount()
    render(
      <KeyboardRow
        defaultOpenSide="leading"
        onOpenSideChange={onOpenSideChange}
      />,
    )
    const contentButton = screen.getByRole('button', { name: 'Open message' })
    contentButton.focus()
    fireEvent.keyDown(contentButton, { key: 'Escape' })

    expect(document.activeElement).toBe(contentButton)
    expect(onOpenSideChange).toHaveBeenCalledTimes(2)
  })

  it('leaves disabled roots inert to arrows while content controls remain focusable', () => {
    // Catches the disabled flag swallowing native content interaction or opening action sides.
    const onOpenSideChange = vi.fn()
    render(<KeyboardRow disabled onOpenSideChange={onOpenSideChange} />)
    const contentButton = screen.getByRole('button', { name: 'Open message' })

    contentButton.focus()
    fireEvent.keyDown(contentButton, { key: 'ArrowRight' })

    expect(onOpenSideChange).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(contentButton)
    expect(screen.getByTestId('root')).toHaveAttribute('data-state', 'closed')
  })

  it.each([
    ['button', 'Open message'],
    ['link', 'Open message link'],
  ] as const)(
    'does not steal physical arrows from an unhandled %s descendant',
    (role, name) => {
      // Catches ordinary native controls bubbling unhandled arrow keys into Root disclosure.
      const onOpenSideChange = vi.fn()
      render(<KeyboardRow onOpenSideChange={onOpenSideChange} />)
      const target = screen.getByRole(role, { name })
      target.focus()
      const left = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'ArrowLeft',
      })
      const right = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'ArrowRight',
      })

      fireEvent(target, left)
      fireEvent(target, right)

      expect(onOpenSideChange).not.toHaveBeenCalled()
      expect(left.defaultPrevented).toBe(false)
      expect(right.defaultPrevented).toBe(false)
      expect(screen.getByTestId('root')).toHaveAttribute('data-state', 'closed')
      expect(document.activeElement).toBe(target)
    },
  )

  it('preserves an action tabindex update made while closed and skips it on reveal', () => {
    // Catches fallback cleanup removing a consumer's newer -1 and focusing that action.
    function Row({ firstTabIndex }: { firstTabIndex?: number }) {
      return (
        <Root data-testid="root">
          <Leading>
            <Action
              {...(firstTabIndex === undefined
                ? {}
                : { tabIndex: firstTabIndex })}
              onAction={() => undefined}
            >
              First action
            </Action>
            <Action onAction={() => undefined}>Second action</Action>
          </Leading>
          <Content>Message</Content>
        </Root>
      )
    }
    const rendered = render(<Row />)

    rendered.rerender(<Row firstTabIndex={-1} />)
    fireEvent.keyDown(screen.getByTestId('root'), { key: 'ArrowLeft' })

    expect(
      screen.getByRole('button', { name: 'First action' }),
    ).toHaveAttribute('tabindex', '-1')
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Second action' }),
    )
  })
})
