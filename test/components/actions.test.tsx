import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useContext } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Action, Content, Leading, Root, Trailing } from '../../src'
import { RootContext } from '../../src/components/context'
import type { RootContextValue } from '../../src/components/context'
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

describe('SwipeActions actions and configuration', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development'
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('invokes onAction once per native click and excludes disabled actions', () => {
    // Catches duplicate library activation or bypassing native disabled semantics.
    const enabledAction = vi.fn()
    const disabledAction = vi.fn()

    render(
      <Root>
        <Leading>
          <Action onAction={enabledAction}>Archive</Action>
          <Action disabled onAction={disabledAction}>
            Disabled
          </Action>
        </Leading>
        <Content>Message</Content>
      </Root>,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Archive', hidden: true }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Disabled', hidden: true }),
    )

    expect(enabledAction).toHaveBeenCalledOnce()
    expect(disabledAction).not.toHaveBeenCalled()
  })

  it('warns once when Action is missing its Root and Side parents', async () => {
    // Catches an invalid standalone Action failing silently or flooding the console.
    const { rerender } = render(
      <Action onAction={() => undefined}>Archive</Action>,
    )
    rerender(<Action onAction={() => undefined}>Archive again</Action>)

    await waitFor(() => expect(console.warn).toHaveBeenCalledOnce())
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/Action.*inside.*Root.*Leading.*Trailing.*Move/i),
    )
  })

  it('warns once when an Action side is missing Root', async () => {
    // Catches a Side context masking the missing Root requirement.
    const { rerender } = render(
      <Leading>
        <Action onAction={() => undefined}>Archive</Action>
      </Leading>,
    )
    rerender(
      <Leading>
        <Action onAction={() => undefined}>Archive again</Action>
      </Leading>,
    )

    await waitFor(() => expect(console.warn).toHaveBeenCalledOnce())
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/Action.*inside.*Root.*Move.*Leading.*root/i),
    )
  })

  it('warns once when an Action inside Root is missing a Side', async () => {
    // Catches Root context masking the required logical Side parent.
    const { rerender } = render(
      <Root>
        <Action onAction={() => undefined}>Archive</Action>
      </Root>,
    )
    rerender(
      <Root>
        <Action onAction={() => undefined}>Archive again</Action>
      </Root>,
    )

    await waitFor(() => expect(console.warn).toHaveBeenCalledOnce())
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/Action.*inside.*Leading.*Trailing.*Move/i),
    )
  })

  it.each([
    ['Leading', Leading, 'leading'],
    ['Trailing', Trailing, 'trailing'],
  ] as const)(
    'warns once and keeps the first %s container',
    async (_name, Side, side) => {
      // Catches ambiguous duplicate logical containers changing with later mounts.
      let registry: RootContextValue | undefined
      const { rerender } = render(
        <Root>
          <RegistryReader onRegistry={(value) => (registry = value)} />
          <Side data-testid="first" />
          <Side data-testid="second" />
        </Root>,
      )

      rerender(
        <Root>
          <RegistryReader onRegistry={(value) => (registry = value)} />
          <Side data-testid="first" />
          <Side data-testid="second" />
        </Root>,
      )

      await waitFor(() => expect(console.warn).toHaveBeenCalledOnce())
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`${_name}.*Keep one.*first`, 'i')),
      )
      act(() => {
        resizeObserverMock.emit(screen.getByTestId('first'), 80)
        resizeObserverMock.emit(screen.getByTestId('second'), 144)
      })
      expect(registry?.measurements()[side].width).toBe(80)
    },
  )

  it('warns once for two initially enabled full-swipe actions', async () => {
    // Catches child-first Action registration being validated before its Side exists.
    render(
      <Root>
        <Leading>
          <Action fullSwipe onAction={() => undefined}>
            First
          </Action>
          <Action fullSwipe onAction={() => undefined}>
            Second
          </Action>
        </Leading>
      </Root>,
    )

    await waitFor(() => expect(console.warn).toHaveBeenCalledOnce())
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /Leading.*more than one enabled.*fullSwipe.*first enabled/i,
      ),
    )
  })

  it('excludes a disabled full-swipe action and warns once when it becomes eligible', async () => {
    // Catches disabled claimants winning selection or duplicate eligible actions being silent.
    let registry: RootContextValue | undefined
    const { rerender } = render(
      <Root>
        <RegistryReader onRegistry={(value) => (registry = value)} />
        <Trailing>
          <Action disabled fullSwipe onAction={() => undefined}>
            First
          </Action>
          <Action fullSwipe onAction={() => undefined}>
            Second
          </Action>
        </Trailing>
      </Root>,
    )

    expect(registry?.measurements().trailing.fullSwipeAction?.element).toBe(
      screen.getByRole('button', { name: 'Second', hidden: true }),
    )
    expect(console.warn).not.toHaveBeenCalled()

    rerender(
      <Root>
        <RegistryReader onRegistry={(value) => (registry = value)} />
        <Trailing>
          <Action fullSwipe onAction={() => undefined}>
            First
          </Action>
          <Action fullSwipe onAction={() => undefined}>
            Second
          </Action>
        </Trailing>
      </Root>,
    )

    await waitFor(() => expect(console.warn).toHaveBeenCalledOnce())
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/more than one enabled.*fullSwipe.*first enabled/i),
    )
    expect(registry?.measurements().trailing.fullSwipeAction?.element).toBe(
      screen.getByRole('button', { name: 'First', hidden: true }),
    )
  })

  it('falls back to both defaults for an invalid threshold pair and warns once', async () => {
    // Catches invalid ratios reaching gesture resolution or only one value being repaired.
    let registry: RootContextValue | undefined
    const { rerender } = render(
      <Root openThreshold={0.8} fullSwipeThreshold={0.7}>
        <RegistryReader onRegistry={(value) => (registry = value)} />
        <Content>Message</Content>
      </Root>,
    )

    rerender(
      <Root openThreshold={0.8} fullSwipeThreshold={0.7}>
        <RegistryReader onRegistry={(value) => (registry = value)} />
        <Content>Message</Content>
      </Root>,
    )

    expect(registry).toMatchObject({
      openThreshold: 0.35,
      fullSwipeThreshold: 0.7,
    })
    await waitFor(() => expect(console.warn).toHaveBeenCalledOnce())
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /0 < openThreshold < fullSwipeThreshold < 1.*defaults 0\.35 and 0\.7/i,
      ),
    )
  })
})
