import { act, render, screen, waitFor } from '@testing-library/react'
import { createRef, StrictMode, useContext } from 'react'
import { describe, expect, it } from 'vitest'

import { Action, Content, Leading, Root, Trailing } from '../../src'
import { RootContext } from '../../src/components/context'
import type { RootContextValue } from '../../src/components/context'
import type { SwipeActionsHandle } from '../../src/public-types'
import { resizeObserverMock } from '../setup'

function RegistryReader({
  onRegistry,
}: {
  onRegistry: (registry: RootContextValue) => void
}) {
  const registry = useContext(RootContext)

  if (registry === null) {
    throw new Error('RegistryReader must be rendered inside Root')
  }

  onRegistry(registry)
  return null
}

describe('SwipeActions measurement', () => {
  it('registers natural content and logical side widths with Root', async () => {
    // Catches observers updating DOM without reporting the widths gesture logic consumes.
    const handleRef = createRef<SwipeActionsHandle>()
    let registry: RootContextValue | undefined

    render(
      <Root ref={handleRef} defaultOpenSide="leading" data-testid="root">
        <RegistryReader onRegistry={(value) => (registry = value)} />
        <Leading data-testid="leading">
          <Action onAction={() => undefined}>Archive</Action>
        </Leading>
        <Content data-testid="content">Message</Content>
        <Trailing data-testid="trailing">
          <Action onAction={() => undefined}>Delete</Action>
        </Trailing>
      </Root>,
    )

    act(() => {
      resizeObserverMock.emit(screen.getByTestId('leading'), 80)
      resizeObserverMock.emit(screen.getByTestId('trailing'), 144)
      resizeObserverMock.emit(screen.getByTestId('content'), 320)
    })

    await waitFor(() => {
      expect(registry?.measurements()).toMatchObject({
        contentWidth: 320,
        leading: { width: 80 },
        trailing: { width: 144 },
      })
      expect(screen.getByTestId('root')).toHaveStyle({
        '--swipe-actions-offset': '80px',
        '--swipe-actions-progress': '1',
        '--swipe-actions-leading-progress': '1',
        '--swipe-actions-trailing-progress': '0',
      })
    })

    act(() => handleRef.current?.open('trailing'))

    await waitFor(() => {
      expect(screen.getByTestId('root')).toHaveStyle({
        '--swipe-actions-offset': '-144px',
        '--swipe-actions-leading-progress': '0',
        '--swipe-actions-trailing-progress': '1',
      })
    })
  })

  it('updates a localized action width without a consumer measurement prop', () => {
    // Catches action sizing being captured only at mount or delegated to consumers.
    let registry: RootContextValue | undefined
    const { rerender } = render(
      <Root>
        <RegistryReader onRegistry={(value) => (registry = value)} />
        <Leading>
          <Action fullSwipe onAction={() => undefined}>
            Archive
          </Action>
        </Leading>
        <Content>Message</Content>
      </Root>,
    )
    const action = screen.getByRole('button', { name: 'Archive' })

    act(() => resizeObserverMock.emit(action, 72))
    expect(action).toHaveStyle({ '--swipe-actions-action-width': '72px' })

    rerender(
      <Root>
        <RegistryReader onRegistry={(value) => (registry = value)} />
        <Leading>
          <Action fullSwipe onAction={() => undefined}>
            In das Archiv verschieben
          </Action>
        </Leading>
        <Content>Message</Content>
      </Root>,
    )
    const localizedAction = screen.getByRole('button', {
      name: 'In das Archiv verschieben',
    })

    act(() => resizeObserverMock.emit(localizedAction, 176))
    expect(localizedAction).toHaveStyle({
      '--swipe-actions-action-width': '176px',
    })
    const claimant = registry?.measurements().leading.fullSwipeAction
    expect(claimant?.element).toBe(localizedAction)
    expect(claimant?.width).toBe(176)
  })

  it('preserves the logical open side while reconciling a resized side', async () => {
    // Catches resize reconciliation closing state or leaving a stale resting offset.
    render(
      <Root defaultOpenSide="leading" data-testid="root">
        <Leading data-testid="leading">
          <Action onAction={() => undefined}>Archive</Action>
        </Leading>
        <Content>Message</Content>
      </Root>,
    )

    act(() => resizeObserverMock.emit(screen.getByTestId('leading'), 80))
    await waitFor(() =>
      expect(screen.getByTestId('root')).toHaveStyle({
        '--swipe-actions-offset': '80px',
      }),
    )

    act(() => resizeObserverMock.emit(screen.getByTestId('leading'), 120))
    await waitFor(() => {
      expect(screen.getByTestId('root')).toHaveAttribute('data-state', 'open')
      expect(screen.getByTestId('root')).toHaveStyle({
        '--swipe-actions-offset': '120px',
      })
    })
  })

  it('closes an uncontrolled resting state when its side is removed', async () => {
    // Catches a removed side leaving an open logical state with an invalid offset.
    const { rerender } = render(
      <Root defaultOpenSide="leading" data-testid="root">
        <Leading data-testid="leading">
          <Action onAction={() => undefined}>Archive</Action>
        </Leading>
        <Content>Message</Content>
      </Root>,
    )

    act(() => resizeObserverMock.emit(screen.getByTestId('leading'), 80))
    await waitFor(() =>
      expect(screen.getByTestId('root')).toHaveStyle({
        '--swipe-actions-offset': '80px',
      }),
    )

    rerender(
      <Root defaultOpenSide="leading" data-testid="root">
        <Content>Message</Content>
      </Root>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('root')).toHaveAttribute('data-state', 'closed')
      expect(screen.getByTestId('root')).toHaveStyle({
        '--swipe-actions-offset': '0px',
      })
    })
  })

  it('disconnects every mounted observer under Strict Mode cleanup', () => {
    // Catches duplicate live observers surviving Strict Mode's setup/cleanup cycle.
    const { unmount } = render(
      <StrictMode>
        <Root>
          <Leading>
            <Action onAction={() => undefined}>Archive</Action>
          </Leading>
          <Content>Message</Content>
        </Root>
      </StrictMode>,
    )

    expect(resizeObserverMock.activeTargets()).toBe(3)
    expect(resizeObserverMock.disconnects()).toBe(3)

    unmount()

    expect(resizeObserverMock.activeTargets()).toBe(0)
    expect(resizeObserverMock.disconnects()).toBe(6)
  })
})
