import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Action, Content, Leading, Root, Trailing } from '../../src'
import { resizeObserverMock } from '../setup'

function createFrames() {
  let identifier = 0
  const callbacks = new Map<number, FrameRequestCallback>()

  return {
    install() {
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
    },
    pending: () => callbacks.size,
    first() {
      const callback = callbacks.values().next().value
      if (callback === undefined) throw new Error('Expected a pending frame')
      return callback
    },
  }
}

function dispatchPointer(
  target: Element,
  type: string,
  x: number,
  timeStamp: number,
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'touch' },
    isPrimary: { value: true },
    button: { value: 0 },
    clientX: { value: x },
    clientY: { value: 0 },
    timeStamp: { value: timeStamp },
  })
  act(() => target.dispatchEvent(event))
}

function patchCapture(content: HTMLElement) {
  const releasePointerCapture = vi.fn()
  Object.assign(content, {
    setPointerCapture: vi.fn(),
    releasePointerCapture,
    hasPointerCapture: () => true,
  })
  return releasePointerCapture
}

function row(direction?: 'ltr' | 'rtl') {
  return (
    <Root
      {...(direction === undefined ? {} : { direction })}
      defaultOpenSide="leading"
      data-testid="root"
    >
      <Leading data-testid="leading">
        <Action onAction={() => undefined}>Archive</Action>
      </Leading>
      <Content data-testid="content">Message</Content>
      <Trailing data-testid="trailing">
        <Action onAction={() => undefined}>Delete</Action>
      </Trailing>
    </Root>
  )
}

async function renderComputedRow(direction?: 'ltr' | 'rtl') {
  const rendered = render(
    <div data-testid="direction-ancestor" dir="ltr">
      {row(direction)}
    </div>,
  )
  act(() => {
    resizeObserverMock.emit(rendered.getByTestId('content'), 320)
    resizeObserverMock.emit(rendered.getByTestId('leading'), 80)
    resizeObserverMock.emit(rendered.getByTestId('trailing'), 96)
  })
  await act(() => Promise.resolve())
  return rendered
}

describe('SwipeActions runtime direction', () => {
  const frames = createFrames()
  let computedDirection: 'ltr' | 'rtl'

  beforeEach(() => {
    computedDirection = 'ltr'
    frames.install()
    const nativeGetComputedStyle = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const styles = nativeGetComputedStyle(element)
      Object.defineProperty(styles, 'direction', {
        configurable: true,
        value: computedDirection,
      })
      return styles
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('preserves an idle logical open side and remaps its offset after ancestor dir changes', async () => {
    // Catches resolving direction once or reinterpreting a logical side as a physical side.
    const rendered = await renderComputedRow()
    const root = rendered.getByTestId('root')
    expect(root).toHaveStyle({ '--swipe-actions-offset': '80px' })

    computedDirection = 'rtl'
    act(() =>
      rendered.getByTestId('direction-ancestor').setAttribute('dir', 'rtl'),
    )
    await act(() => Promise.resolve())

    expect(root).toHaveAttribute('data-state', 'open')
    expect(root).toHaveStyle({ '--swipe-actions-offset': '-80px' })
  })

  it('cancels a drag and restores the same logical side in the new direction', async () => {
    // Catches a queued drag frame writing a stale LTR offset after a runtime RTL switch.
    const rendered = await renderComputedRow()
    const root = rendered.getByTestId('root')
    const content = rendered.getByTestId('content')
    const releasePointerCapture = patchCapture(content)

    dispatchPointer(content, 'pointerdown', 0, 1)
    dispatchPointer(content, 'pointermove', -30, 10)
    expect(frames.pending()).toBe(1)

    computedDirection = 'rtl'
    act(() =>
      rendered.getByTestId('direction-ancestor').setAttribute('dir', 'rtl'),
    )
    await act(() => Promise.resolve())

    expect(releasePointerCapture).toHaveBeenCalledExactlyOnceWith(1)
    expect(frames.pending()).toBe(0)
    expect(root).toHaveAttribute('data-state', 'open')
    expect(root).toHaveStyle({ '--swipe-actions-offset': '-80px' })
  })

  it('cancels a settle generation and remaps the authoritative open side', async () => {
    // Catches an old animation generation overwriting a direction-reconciled resting offset.
    const rendered = await renderComputedRow()
    const root = rendered.getByTestId('root')
    const content = rendered.getByTestId('content')
    patchCapture(content)

    dispatchPointer(content, 'pointerdown', 0, 1)
    dispatchPointer(content, 'pointermove', -30, 10)
    dispatchPointer(content, 'pointerup', -30, 200)
    expect(root).toHaveAttribute('data-state', 'settling')
    const staleFrame = frames.first()

    computedDirection = 'rtl'
    act(() =>
      rendered.getByTestId('direction-ancestor').setAttribute('dir', 'rtl'),
    )
    await act(() => Promise.resolve())
    staleFrame(400)
    await act(() => Promise.resolve())

    expect(frames.pending()).toBe(0)
    expect(root).toHaveAttribute('data-state', 'open')
    expect(root).toHaveStyle({ '--swipe-actions-offset': '-80px' })
  })

  it('keeps an explicit direction authoritative over computed changes', async () => {
    // Catches a computed ancestor direction overriding the public direction prop.
    const rendered = await renderComputedRow('ltr')
    const root = rendered.getByTestId('root')

    computedDirection = 'rtl'
    act(() =>
      rendered.getByTestId('direction-ancestor').setAttribute('dir', 'rtl'),
    )
    await act(() => Promise.resolve())

    expect(root).toHaveAttribute('dir', 'ltr')
    expect(root).toHaveStyle({ '--swipe-actions-offset': '80px' })
  })

  it('uses one attribute-only observer for the Root ancestry and disconnects it', async () => {
    // Catches per-ancestor observers, unrelated subtree observation, or a leaked observer.
    const instances: Array<{
      observe: ReturnType<typeof vi.fn>
      disconnect: ReturnType<typeof vi.fn>
    }> = []
    class TrackingMutationObserver {
      observe = vi.fn()
      disconnect = vi.fn()

      constructor(callback: MutationCallback) {
        void callback
        instances.push(this)
      }

      takeRecords = () => []
    }
    vi.stubGlobal('MutationObserver', TrackingMutationObserver)
    const rendered = await renderComputedRow()
    const root = rendered.getByTestId('root')
    const directionObservers = instances.filter(({ observe }) =>
      observe.mock.calls.some(
        ([, options]) =>
          (options as MutationObserverInit).attributeFilter?.[0] === 'dir',
      ),
    )

    expect(directionObservers).toHaveLength(1)
    const directionObserver = directionObservers[0]!
    expect(directionObserver.observe).toHaveBeenCalled()
    for (const [target, options] of directionObserver.observe.mock.calls) {
      expect((target as Element).contains(root)).toBe(true)
      expect(options).toEqual({
        attributes: true,
        attributeFilter: ['dir'],
      })
    }

    rendered.unmount()

    for (const { disconnect } of instances) {
      expect(disconnect).toHaveBeenCalledOnce()
    }
  })
})
