import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Action, Content, Leading, Root, Trailing } from '../../src'

function ActionsRow({ disabled = false }: { disabled?: boolean }) {
  return (
    <Root aria-label="Message actions" data-testid="root" disabled={disabled}>
      <Leading data-testid="leading">
        <Action onAction={() => undefined}>Archive</Action>
      </Leading>
      <Content>
        <button type="button">Open message</button>
      </Content>
      <Trailing data-testid="trailing">
        <Action onAction={() => undefined}>Delete</Action>
      </Trailing>
    </Root>
  )
}

describe('SwipeActions accessibility', () => {
  it('removes both closed action sides from assistive technology and tab order', () => {
    // Catches visually hidden actions remaining reachable through Tab or a virtual cursor.
    render(<ActionsRow />)

    for (const side of [
      screen.getByTestId('leading'),
      screen.getByTestId('trailing'),
    ]) {
      expect(side).toHaveAttribute('aria-hidden', 'true')
      expect((side as HTMLElement & { inert: boolean }).inert).toBe(true)
    }
    expect(
      screen.getByRole('button', { name: 'Archive', hidden: true }),
    ).toHaveAttribute('tabindex', '-1')
    expect(
      screen.getByRole('button', { name: 'Delete', hidden: true }),
    ).toHaveAttribute('tabindex', '-1')
  })

  it('adds a minimally semantic labeled keyboard surface only when actions exist', () => {
    // Catches unconditional focus stops, dropped native ARIA, or an unnecessary widget role.
    const withActions = render(<ActionsRow />)
    const actionRoot = screen.getByTestId('root')

    expect(actionRoot).toHaveAttribute('tabindex', '0')
    expect(actionRoot).toHaveAttribute('aria-label', 'Message actions')
    expect(actionRoot).not.toHaveAttribute('role')

    withActions.unmount()
    render(
      <Root data-testid="root">
        <Content>Message</Content>
      </Root>,
    )

    expect(screen.getByTestId('root')).not.toHaveAttribute('tabindex')
  })

  it('keeps disabled row content usable without adding a Root focus stop', () => {
    // Catches disabling swipe mechanics by disabling or hiding the row's real content controls.
    render(<ActionsRow disabled />)

    expect(screen.getByTestId('root')).not.toHaveAttribute('tabindex')
    expect(screen.getByRole('button', { name: 'Open message' })).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Open message' }),
    ).not.toHaveAttribute('tabindex', '-1')
  })

  it('removes a focusable Side container itself from tab order and restores it when opened', () => {
    // Catches the inert fallback covering descendants while leaving the hidden container focusable.
    render(
      <Root data-testid="root">
        <Leading data-testid="leading" tabIndex={2}>
          <Action onAction={() => undefined}>Archive</Action>
        </Leading>
        <Content>Message</Content>
      </Root>,
    )
    const side = screen.getByTestId('leading')

    expect(side).toHaveAttribute('tabindex', '-1')
    fireEvent.keyDown(screen.getByTestId('root'), { key: 'ArrowLeft' })

    expect(side).toHaveAttribute('tabindex', '2')
  })
})
