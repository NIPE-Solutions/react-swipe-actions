import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Action, Content, Leading, Root, Trailing } from '../../src'
import type {
  SwipeActionsDirection,
  SwipeActionsRootProps,
} from '../../src/public-types'
import { resizeObserverMock } from '../setup'

interface PointerInit {
  pointerId?: number
  isPrimary?: boolean
  clientX: number
  timeStamp: number
}

function dispatchPointer(
  target: Element,
  type: string,
  { pointerId = 1, isPrimary = true, clientX, timeStamp }: PointerInit,
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: 'touch' },
    isPrimary: { value: isPrimary },
    button: { value: 0 },
    clientX: { value: clientX },
    clientY: { value: 0 },
    timeStamp: { value: timeStamp },
  })

  act(() => target.dispatchEvent(event))
}

function createFrameLoop() {
  let time = 0
  let identifier = 0
  const callbacks = new Map<number, FrameRequestCallback>()

  return {
    install() {
      time = 0
      identifier = 0
      callbacks.clear()
      vi.stubGlobal(
        'requestAnimationFrame',
        (callback: FrameRequestCallback) => {
          identifier += 1
          callbacks.set(identifier, callback)
          return identifier
        },
      )
      vi.stubGlobal('cancelAnimationFrame', (frame: number) => {
        callbacks.delete(frame)
      })
      vi.spyOn(performance, 'now').mockImplementation(() => time)
    },
    advance(milliseconds: number) {
      time += milliseconds
      const current = [...callbacks.values()]
      callbacks.clear()
      act(() => current.forEach((callback) => callback(time)))
    },
  }
}

interface RowOptions {
  direction?: SwipeActionsDirection
  rootProps?: Partial<SwipeActionsRootProps>
  leadingDisabled?: boolean
  trailingDisabled?: boolean
}

async function renderRow({
  direction = 'ltr',
  rootProps = {},
  leadingDisabled = false,
  trailingDisabled = false,
}: RowOptions = {}) {
  const leadingAction = vi.fn()
  const trailingAction = vi.fn()
  const onOpenSideChange = vi.fn()
  const rendered = render(
    <Root
      {...rootProps}
      direction={direction}
      onOpenSideChange={onOpenSideChange}
      data-testid="root"
    >
      <Leading data-testid="leading">
        <Action
          data-testid="leading-action"
          disabled={leadingDisabled}
          fullSwipe
          onAction={leadingAction}
        >
          Archive
        </Action>
      </Leading>
      <Content data-testid="content">Message</Content>
      <Trailing data-testid="trailing">
        <Action
          data-testid="trailing-action"
          disabled={trailingDisabled}
          fullSwipe
          onAction={trailingAction}
        >
          Delete
        </Action>
      </Trailing>
    </Root>,
  )

  const root = rendered.getByTestId('root')
  const content = rendered.getByTestId('content')
  Object.assign(content, {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: () => true,
  })

  act(() => {
    resizeObserverMock.emit(content, 320)
    resizeObserverMock.emit(rendered.getByTestId('leading'), 80)
    resizeObserverMock.emit(rendered.getByTestId('trailing'), 96)
    resizeObserverMock.emit(rendered.getByTestId('leading-action'), 80)
    resizeObserverMock.emit(rendered.getByTestId('trailing-action'), 96)
  })
  await act(() => Promise.resolve())

  return {
    rendered,
    root,
    content,
    leadingAction: rendered.getByTestId('leading-action'),
    trailingAction: rendered.getByTestId('trailing-action'),
    invokeLeading: leadingAction,
    invokeTrailing: trailingAction,
    onOpenSideChange,
  }
}

function drag(
  content: Element,
  offset: number,
  releaseTime: number,
  frames: ReturnType<typeof createFrameLoop>,
) {
  dispatchPointer(content, 'pointerdown', { clientX: 0, timeStamp: 1 })
  dispatchPointer(content, 'pointermove', { clientX: offset, timeStamp: 10 })
  frames.advance(16)
  dispatchPointer(content, 'pointerup', {
    clientX: offset,
    timeStamp: releaseTime,
  })
}

describe('SwipeActions full swipe', () => {
  const frames = createFrameLoop()

  beforeEach(() => frames.install())

  afterEach(() => vi.unstubAllGlobals())

  it('keeps slow 69% travel unarmed and opens the ordinary side', async () => {
    // Catches rounding below-threshold travel into a full-swipe activation.
    const row = await renderRow()

    drag(row.content, 220.8, 200, frames)

    expect(row.leadingAction).not.toHaveAttribute('data-active')
    expect(row.invokeLeading).not.toHaveBeenCalled()
    expect(row.root).toHaveAttribute('data-state', 'settling')

    frames.advance(400)
    await act(() => Promise.resolve())

    expect(row.root).toHaveStyle({ '--swipe-actions-offset': '80px' })
    expect(row.onOpenSideChange).toHaveBeenCalledExactlyOnceWith('leading')
  })

  it('gradually expands only the eligible claimant before full-swipe arming', async () => {
    // Catches expansion waiting for data-active and jumping at the arm threshold.
    const row = await renderRow()

    dispatchPointer(row.content, 'pointerdown', { clientX: 0, timeStamp: 1 })
    dispatchPointer(row.content, 'pointermove', { clientX: 160, timeStamp: 10 })
    frames.advance(16)

    expect(row.leadingAction).not.toHaveAttribute('data-active')
    expect(row.leadingAction).toHaveAttribute('data-full-swipe-expanding', '')
    expect(row.leadingAction).toHaveStyle({
      '--swipe-actions-full-swipe-expansion-width': '160px',
      '--swipe-actions-full-swipe-expansion-progress': '0.5',
    })
    expect(row.trailingAction).not.toHaveAttribute('data-full-swipe-expanding')

    dispatchPointer(row.content, 'pointermove', { clientX: 200, timeStamp: 20 })
    frames.advance(16)

    expect(row.leadingAction).toHaveStyle({
      '--swipe-actions-full-swipe-expansion-width': '200px',
      '--swipe-actions-full-swipe-expansion-progress': '0.625',
    })
  })

  it('does not expand an ineligible full-swipe action', async () => {
    // Catches disabled or opposite-side claimants receiving expansion state.
    const row = await renderRow({ leadingDisabled: true })

    dispatchPointer(row.content, 'pointerdown', { clientX: 0, timeStamp: 1 })
    dispatchPointer(row.content, 'pointermove', { clientX: 160, timeStamp: 10 })
    frames.advance(16)

    expect(row.leadingAction).not.toHaveAttribute('data-full-swipe-expanding')
    expect(row.trailingAction).not.toHaveAttribute('data-full-swipe-expanding')
  })

  it('reconciles an action-only resize but ignores an identical action delivery', async () => {
    // Catches Action pre-mutating the registered width before Root can compare it.
    const row = await renderRow()

    dispatchPointer(row.content, 'pointerdown', { clientX: 0, timeStamp: 1 })
    dispatchPointer(row.content, 'pointermove', { clientX: 160, timeStamp: 10 })
    frames.advance(16)

    act(() => resizeObserverMock.emit(row.leadingAction, 80))
    await act(() => Promise.resolve())

    expect(row.root).toHaveAttribute('data-state', 'dragging')
    expect(row.leadingAction).toHaveAttribute('data-full-swipe-expanding', '')

    act(() => resizeObserverMock.emit(row.leadingAction, 112))
    await act(() => Promise.resolve())

    expect(row.root).toHaveAttribute('data-state', 'closed')
    expect(row.root).toHaveStyle({ '--swipe-actions-offset': '0px' })
    expect(row.leadingAction).not.toHaveAttribute('data-full-swipe-expanding')
  })

  it('arms slow 71% travel, commits once, settles offscreen, and preserves the row', async () => {
    // Catches delayed/duplicate activation, missing expansion state, or library-owned row removal.
    const row = await renderRow()
    dispatchPointer(row.content, 'pointerdown', { clientX: 0, timeStamp: 0 })
    dispatchPointer(row.content, 'pointermove', {
      clientX: 227.2,
      timeStamp: 10,
    })
    frames.advance(16)

    expect(row.leadingAction).toHaveAttribute('data-active', '')
    expect(row.leadingAction).toHaveStyle({
      '--swipe-actions-full-swipe-width': '227.2px',
      '--swipe-actions-full-swipe-progress': '0.71',
    })
    expect(row.trailingAction).not.toHaveAttribute('data-active')

    dispatchPointer(row.content, 'pointerup', {
      clientX: 227.2,
      timeStamp: 200,
    })

    expect(row.invokeLeading).toHaveBeenCalledOnce()
    expect(row.root).toHaveAttribute('data-state', 'activating')
    expect(row.root.isConnected).toBe(true)

    frames.advance(400)
    expect(row.root).toHaveStyle({ '--swipe-actions-offset': '320px' })
    await act(() => Promise.resolve())

    expect(row.root).toHaveAttribute('data-state', 'closed')
    expect(row.root).toHaveStyle({ '--swipe-actions-offset': '0px' })
    expect(row.leadingAction).not.toHaveAttribute('data-active')
    expect(
      row.leadingAction.style.getPropertyValue(
        '--swipe-actions-full-swipe-width',
      ),
    ).toBe('')
    expect(row.onOpenSideChange).not.toHaveBeenCalled()
    expect(row.root.isConnected).toBe(true)
  })

  it('keeps an armed full swipe stable inside a small threshold hysteresis band', async () => {
    // Catches exact-threshold chatter and release disagreeing with the visible armed state.
    const row = await renderRow()

    dispatchPointer(row.content, 'pointerdown', { clientX: 0, timeStamp: 0 })
    dispatchPointer(row.content, 'pointermove', { clientX: 225, timeStamp: 20 })
    frames.advance(16)
    expect(row.leadingAction).toHaveAttribute('data-active', '')

    dispatchPointer(row.content, 'pointermove', { clientX: 217, timeStamp: 120 })
    frames.advance(16)
    expect(row.leadingAction).toHaveAttribute('data-active', '')

    dispatchPointer(row.content, 'pointerup', { clientX: 217, timeStamp: 220 })
    expect(row.invokeLeading).toHaveBeenCalledOnce()
  })

  it('disarms after reversing below the full-swipe hysteresis band', async () => {
    // Catches hysteresis becoming sticky after a deliberate reversal.
    const row = await renderRow()

    dispatchPointer(row.content, 'pointerdown', { clientX: 0, timeStamp: 0 })
    dispatchPointer(row.content, 'pointermove', { clientX: 225, timeStamp: 20 })
    frames.advance(16)
    expect(row.leadingAction).toHaveAttribute('data-active', '')

    dispatchPointer(row.content, 'pointermove', { clientX: 210, timeStamp: 120 })
    frames.advance(16)
    expect(row.leadingAction).not.toHaveAttribute('data-active')

    dispatchPointer(row.content, 'pointerup', { clientX: 210, timeStamp: 220 })
    expect(row.invokeLeading).not.toHaveBeenCalled()
  })

  it.each([
    { offset: 47, activates: false },
    { offset: 49, activates: true },
  ])(
    'uses the real-travel velocity gate at $offset px',
    async ({ offset, activates }) => {
      // Catches tiny high-speed noise bypassing the 15% real-travel gate.
      const row = await renderRow()

      drag(row.content, offset, 11, frames)

      expect(row.invokeLeading).toHaveBeenCalledTimes(activates ? 1 : 0)
      if (activates) {
        expect(row.leadingAction).toHaveAttribute('data-active', '')
      } else {
        expect(row.leadingAction).not.toHaveAttribute('data-active')
      }
      expect(row.root).toHaveAttribute(
        'data-state',
        activates ? 'activating' : 'settling',
      )
    },
  )

  it.each([
    { direction: 'ltr' as const, extension: -13, activates: false },
    { direction: 'rtl' as const, extension: 13, activates: false },
    { direction: 'ltr' as const, extension: -48, activates: true },
    { direction: 'rtl' as const, extension: 48, activates: true },
  ])(
    'requires genuine pointer travel from a default-open trailing side in $direction ($extension px)',
    async ({ direction, extension, activates }) => {
      // Catches the resting 96px offset counting toward destructive full-swipe travel.
      const row = await renderRow({
        direction,
        rootProps: { defaultOpenSide: 'trailing' },
      })
      const sign = direction === 'ltr' ? -1 : 1
      expect(row.root).toHaveStyle({
        '--swipe-actions-offset': `${sign * 96}px`,
      })

      dispatchPointer(row.content, 'pointerdown', {
        clientX: 0,
        timeStamp: 0.1,
      })
      dispatchPointer(row.content, 'pointermove', {
        clientX: extension,
        timeStamp: 1.1,
      })
      frames.advance(16)
      expect(row.root).toHaveStyle({
        '--swipe-actions-offset': `${sign * (96 + Math.abs(extension))}px`,
      })
      dispatchPointer(row.content, 'pointerup', {
        clientX: extension,
        timeStamp: 1.2,
      })

      expect(row.invokeTrailing).toHaveBeenCalledTimes(activates ? 1 : 0)
      expect(row.root).toHaveAttribute(
        'data-state',
        activates ? 'activating' : 'settling',
      )
    },
  )

  it('never arms or invokes a disabled claimant', async () => {
    // Catches fullSwipe eligibility bypassing native disabled state.
    const row = await renderRow({ leadingDisabled: true })

    drag(row.content, 227.2, 200, frames)

    expect(row.leadingAction).not.toHaveAttribute('data-active')
    expect(row.invokeLeading).not.toHaveBeenCalled()
    expect(row.root).toHaveAttribute('data-state', 'settling')
  })

  it.each([
    {
      direction: 'ltr' as const,
      side: 'leading' as const,
      offset: 227.2,
      target: 320,
    },
    {
      direction: 'ltr' as const,
      side: 'trailing' as const,
      offset: -227.2,
      target: -320,
    },
    {
      direction: 'rtl' as const,
      side: 'leading' as const,
      offset: -227.2,
      target: -320,
    },
    {
      direction: 'rtl' as const,
      side: 'trailing' as const,
      offset: 227.2,
      target: 320,
    },
  ])(
    'activates logical $side and settles to $target px in $direction',
    async ({ direction, side, offset, target }) => {
      // Catches physical direction selecting the wrong logical claimant.
      const row = await renderRow({ direction })
      const action = side === 'leading' ? row.leadingAction : row.trailingAction
      const invoke = side === 'leading' ? row.invokeLeading : row.invokeTrailing

      drag(row.content, offset, 200, frames)

      expect(action).toHaveAttribute('data-active', '')
      expect(invoke).toHaveBeenCalledOnce()
      frames.advance(400)
      expect(row.root).toHaveStyle({
        '--swipe-actions-offset': `${target}px`,
      })
      await act(() => Promise.resolve())
    },
  )

  it('reports consumer callback exceptions instead of swallowing them', async () => {
    // Catches an activation wrapper converting callback failures into library state.
    const failure = new Error('consumer activation failed')
    const errors: unknown[] = []
    const onError = (event: ErrorEvent) => {
      errors.push(event.error)
      event.preventDefault()
    }
    window.addEventListener('error', onError)
    const rendered = render(
      <Root data-testid="root">
        <Leading data-testid="leading">
          <Action
            fullSwipe
            onAction={() => {
              throw failure
            }}
          >
            Archive
          </Action>
        </Leading>
        <Content data-testid="content">Message</Content>
      </Root>,
    )
    const content = rendered.getByTestId('content')
    Object.assign(content, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    })
    act(() => {
      resizeObserverMock.emit(content, 320)
      resizeObserverMock.emit(rendered.getByTestId('leading'), 80)
    })
    await act(() => Promise.resolve())

    dispatchPointer(content, 'pointerdown', { clientX: 0, timeStamp: 0 })
    dispatchPointer(content, 'pointermove', { clientX: 227.2, timeStamp: 10 })
    frames.advance(16)
    dispatchPointer(content, 'pointerup', { clientX: 227.2, timeStamp: 200 })

    expect(errors).toEqual([failure])
    window.removeEventListener('error', onError)
  })

  it('reconciles a controlled closed row after committed activation', async () => {
    // Catches activation mutating controlled semantic state or leaving content offscreen.
    const row = await renderRow({ rootProps: { openSide: null } })

    drag(row.content, 227.2, 200, frames)
    expect(row.invokeLeading).toHaveBeenCalledOnce()

    frames.advance(400)
    await act(() => Promise.resolve())

    expect(row.root).toHaveAttribute('data-state', 'closed')
    expect(row.root).toHaveStyle({ '--swipe-actions-offset': '0px' })
    expect(row.onOpenSideChange).not.toHaveBeenCalled()
  })
})
