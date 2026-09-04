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
})
