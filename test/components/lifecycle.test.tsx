import { act, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Action, Content, Leading, Root, Trailing } from '../../src'
import { resizeObserverMock } from '../setup'

function dispatchPointer(
  target: Element,
  type: string,
  x: number,
  timeStamp: number,
  pointerId = 1,
  isPrimary = true,
) {
  const EventConstructor = target.ownerDocument.defaultView?.Event ?? Event
  const event = new EventConstructor(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: 'touch' },
    isPrimary: { value: isPrimary },
    button: { value: 0 },
    clientX: { value: x },
    clientY: { value: 0 },
    timeStamp: { value: timeStamp },
  })
  act(() => target.dispatchEvent(event))
}

function createFrames() {
  let identifier = 0
  const callbacks = new Map<number, FrameRequestCallback>()
  return {
    install() {
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
    },
    pending: () => callbacks.size,
    first() {
      const callback = callbacks.values().next().value
      if (callback === undefined) throw new Error('Expected a pending frame')
      return callback
    },
  }
}

function patchCapture(content: HTMLElement) {
  const captured = new Set<number>()
  const setPointerCapture = vi.fn((pointerId: number) =>
    captured.add(pointerId),
  )
  const releasePointerCapture = vi.fn((pointerId: number) =>
    captured.delete(pointerId),
  )
  Object.assign(content, {
    setPointerCapture,
    releasePointerCapture,
    hasPointerCapture: (pointerId: number) => captured.has(pointerId),
  })
  return { setPointerCapture, releasePointerCapture }
}

function row(
  openSide?: 'leading' | 'trailing' | null,
  onChange = vi.fn(),
  disabled = false,
) {
  return (
    <Root
      {...(openSide === undefined ? {} : { openSide })}
      onOpenSideChange={onChange}
      disabled={disabled}
      data-testid="root"
    >
      <Leading data-testid="leading" />
      <Content data-testid="content">Message</Content>
      <Trailing data-testid="trailing" />
    </Root>
  )
}

function measure(container: HTMLElement) {
  act(() => {
    resizeObserverMock.emit(
      container.querySelector('[data-testid="content"]')!,
      320,
    )
    resizeObserverMock.emit(
      container.querySelector('[data-testid="leading"]')!,
      80,
    )
    resizeObserverMock.emit(
      container.querySelector('[data-testid="trailing"]')!,
      96,
    )
  })
}

function activationRow(
  onAction: () => unknown,
  onChange = vi.fn(),
  openSide?: 'leading' | 'trailing' | null,
  includeClaimant = true,
) {
  return (
    <Root
      {...(openSide === undefined ? {} : { openSide })}
      onOpenSideChange={onChange}
      data-testid="root"
    >
      <Leading data-testid="leading">
        {includeClaimant ? (
          <Action data-testid="claimant" fullSwipe onAction={onAction}>
            Archive
          </Action>
        ) : null}
      </Leading>
      <Content data-testid="content">Message</Content>
      <Trailing data-testid="trailing" />
    </Root>
  )
}

async function prepareActivationRow(container: HTMLElement) {
  measure(container)
  const claimant = container.querySelector('[data-testid="claimant"]')
  if (claimant !== null) {
    act(() => resizeObserverMock.emit(claimant, 80))
  }
  await act(() => Promise.resolve())
}

function startActivation(content: Element) {
  dispatchPointer(content, 'pointerdown', 0, 1)
  dispatchPointer(content, 'pointermove', 227.2, 10)
  dispatchPointer(content, 'pointerup', 227.2, 200)
}

describe('SwipeActions gesture lifecycle', () => {
  const frames = createFrames()

  beforeEach(() => frames.install())

  afterEach(() => vi.unstubAllGlobals())

  it('cleans capture, drag frames, observers, and blur listeners on unmount', async () => {
    // Catches resources from an owned pointer surviving component teardown.
    const addListener = vi.spyOn(window, 'addEventListener')
    const removeListener = vi.spyOn(window, 'removeEventListener')
    const rendered = render(row(null))
    measure(rendered.container)
    await act(() => Promise.resolve())
    const content = rendered.getByTestId('content')
    const capture = patchCapture(content)

    dispatchPointer(content, 'pointerdown', 0, 1)
    dispatchPointer(content, 'pointermove', 40, 10)
    expect(frames.pending()).toBe(1)

    rendered.unmount()

    expect(capture.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(1)
    expect(frames.pending()).toBe(0)
    expect(resizeObserverMock.activeTargets()).toBe(0)
    expect(
      addListener.mock.calls.filter(([type]) => type === 'blur'),
    ).toHaveLength(1)
    expect(
      removeListener.mock.calls.filter(([type]) => type === 'blur'),
    ).toHaveLength(1)
  })

  it('uses one blur listener after a Strict Mode effect remount', async () => {
    // Catches Strict Mode setup/cleanup leaving duplicate global listeners.
    const addListener = vi.spyOn(window, 'addEventListener')
    const removeListener = vi.spyOn(window, 'removeEventListener')
    const rendered = render(<StrictMode>{row(null)}</StrictMode>)
    measure(rendered.container)
    await act(() => Promise.resolve())
    const content = rendered.getByTestId('content')
    patchCapture(content)

    dispatchPointer(content, 'pointerdown', 0, 1)
    dispatchPointer(content, 'pointermove', 40, 10)
    dispatchPointer(content, 'pointercancel', 40, 20)

    expect(
      addListener.mock.calls.filter(([type]) => type === 'blur'),
    ).toHaveLength(1)
    expect(
      removeListener.mock.calls.filter(([type]) => type === 'blur'),
    ).toHaveLength(1)
  })

  it('cancels and reconciles once when measurements change mid-drag', async () => {
    // Catches a resize letting stale drag frames overwrite the new resting layout.
    const rendered = render(row(null))
    measure(rendered.container)
    await act(() => Promise.resolve())
    const root = rendered.getByTestId('root')
    const content = rendered.getByTestId('content')
    const capture = patchCapture(content)

    dispatchPointer(content, 'pointerdown', 0, 1)
    dispatchPointer(content, 'pointermove', 40, 10)
    act(() => resizeObserverMock.emit(rendered.getByTestId('leading'), 120))
    await act(() => Promise.resolve())

    expect(capture.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(1)
    expect(frames.pending()).toBe(0)
    expect(root).toHaveStyle({ '--swipe-actions-offset': '0px' })
    expect(root).toHaveAttribute('data-state', 'closed')
  })

  it('closes and releases a drag when its resting side is removed', async () => {
    // Catches side removal retaining capture or an invalid open offset.
    const onChange = vi.fn()
    const rendered = render(
      <Root
        defaultOpenSide="leading"
        onOpenSideChange={onChange}
        data-testid="root"
      >
        <Leading data-testid="leading" />
        <Content data-testid="content">Message</Content>
      </Root>,
    )
    act(() => {
      resizeObserverMock.emit(rendered.getByTestId('content'), 320)
      resizeObserverMock.emit(rendered.getByTestId('leading'), 80)
    })
    await act(() => Promise.resolve())
    const content = rendered.getByTestId('content')
    const capture = patchCapture(content)
    dispatchPointer(content, 'pointerdown', 80, 1)
    dispatchPointer(content, 'pointermove', 40, 10)

    rendered.rerender(
      <Root
        defaultOpenSide="leading"
        onOpenSideChange={onChange}
        data-testid="root"
      >
        <Content data-testid="content">Message</Content>
      </Root>,
    )
    await act(() => Promise.resolve())

    expect(capture.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(1)
    expect(rendered.getByTestId('root')).toHaveStyle({
      '--swipe-actions-offset': '0px',
    })
    expect(rendered.getByTestId('root')).toHaveAttribute('data-state', 'closed')
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null)
  })

  it('cancels a drag and follows a controlled prop change', async () => {
    // Catches in-flight physical motion overriding authoritative controlled state.
    const onChange = vi.fn()
    const rendered = render(row(null, onChange))
    measure(rendered.container)
    await act(() => Promise.resolve())
    const content = rendered.getByTestId('content')
    const capture = patchCapture(content)
    dispatchPointer(content, 'pointerdown', 0, 1)
    dispatchPointer(content, 'pointermove', 40, 10)

    rendered.rerender(row('leading', onChange))
    await act(() => Promise.resolve())

    expect(capture.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(1)
    expect(frames.pending()).toBe(0)
    expect(rendered.getByTestId('root')).toHaveStyle({
      '--swipe-actions-offset': '80px',
    })
    expect(rendered.getByTestId('root')).toHaveAttribute('data-state', 'open')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('reconciles an idle row when controlled state changes', async () => {
    // Catches configuration reconciliation being conditional on active gesture work.
    const rendered = render(row(null))
    measure(rendered.container)
    await act(() => Promise.resolve())

    rendered.rerender(row('leading'))
    await act(() => Promise.resolve())

    expect(rendered.getByTestId('root')).toHaveStyle({
      '--swipe-actions-offset': '80px',
    })
  })

  it('invalidates a stale settle callback after a controlled change', async () => {
    // Catches canceled animation generations writing or requesting old state.
    const onChange = vi.fn()
    const rendered = render(row(null, onChange))
    measure(rendered.container)
    await act(() => Promise.resolve())
    const content = rendered.getByTestId('content')
    patchCapture(content)
    dispatchPointer(content, 'pointerdown', 0, 1)
    dispatchPointer(content, 'pointermove', 50, 10)
    dispatchPointer(content, 'pointerup', 50, 20)
    const staleFrame = frames.first()

    rendered.rerender(row('trailing', onChange))
    await act(() => Promise.resolve())
    staleFrame(400)
    await act(() => Promise.resolve())

    expect(rendered.getByTestId('root')).toHaveStyle({
      '--swipe-actions-offset': '-96px',
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('treats capture loss during pointer release as idempotent cleanup', async () => {
    // Catches synchronous capture-loss delivery canceling a committed release twice.
    const rendered = render(row(null))
    measure(rendered.container)
    await act(() => Promise.resolve())
    const content = rendered.getByTestId('content')
    Object.assign(content, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: () => true,
      releasePointerCapture: vi.fn(() => {
        const lost = new Event('lostpointercapture', {
          bubbles: true,
          cancelable: false,
        })
        Object.defineProperties(lost, {
          pointerId: { value: 1 },
          pointerType: { value: 'touch' },
          isPrimary: { value: true },
          button: { value: 0 },
          clientX: { value: 50 },
          clientY: { value: 0 },
          timeStamp: { value: 20 },
        })
        content.dispatchEvent(lost)
      }),
    })

    dispatchPointer(content, 'pointerdown', 0, 1)
    dispatchPointer(content, 'pointermove', 50, 10)
    dispatchPointer(content, 'pointerup', 50, 20)

    expect(rendered.getByTestId('root')).toHaveStyle({
      '--swipe-actions-offset': '50px',
    })
    expect(rendered.getByTestId('root')).toHaveAttribute(
      'data-state',
      'settling',
    )
  })

  it('invokes browser frame methods with their Window receiver', async () => {
    // Catches extracting browser frame methods that require a Window receiver.
    const request = vi.fn(function (this: Window) {
      return 1
    })
    vi.stubGlobal('requestAnimationFrame', request)
    const rendered = render(row(null))
    measure(rendered.container)
    await act(() => Promise.resolve())
    const content = rendered.getByTestId('content')
    patchCapture(content)

    dispatchPointer(content, 'pointerdown', 0, 1)
    dispatchPointer(content, 'pointermove', 40, 10)

    expect(request.mock.contexts[0]).toBe(window)
  })

  it('cancels a pending session when Root becomes disabled', async () => {
    // Catches a pending pointer retaining authority after disabled changes.
    const onChange = vi.fn()
    const rendered = render(row(null, onChange))
    measure(rendered.container)
    await act(() => Promise.resolve())
    const content = rendered.getByTestId('content')
    const capture = patchCapture(content)

    dispatchPointer(content, 'pointerdown', 0, 1)
    rendered.rerender(row(null, onChange, true))
    await act(() => Promise.resolve())
    dispatchPointer(content, 'pointermove', 40, 10)

    expect(capture.setPointerCapture).not.toHaveBeenCalled()
    expect(frames.pending()).toBe(0)
    expect(rendered.getByTestId('root')).toHaveStyle({
      '--swipe-actions-offset': '0px',
    })
  })

  it('cancels an owned drag when Root becomes disabled', async () => {
    // Catches disabled changes leaving capture or a queued drag write alive.
    const onChange = vi.fn()
    const rendered = render(row(null, onChange))
    measure(rendered.container)
    await act(() => Promise.resolve())
    const content = rendered.getByTestId('content')
    const capture = patchCapture(content)
    dispatchPointer(content, 'pointerdown', 0, 1)
    dispatchPointer(content, 'pointermove', 40, 10)

    rendered.rerender(row(null, onChange, true))
    await act(() => Promise.resolve())

    expect(capture.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(1)
    expect(frames.pending()).toBe(0)
    expect(rendered.getByTestId('root')).toHaveStyle({
      '--swipe-actions-offset': '0px',
    })
    expect(rendered.getByTestId('root')).toHaveAttribute('data-disabled', '')
  })

  it('cancels settling when Root becomes disabled', async () => {
    // Catches a disabled change allowing a stale settle to request semantic state.
    const onChange = vi.fn()
    const rendered = render(row(null, onChange))
    measure(rendered.container)
    await act(() => Promise.resolve())
    const content = rendered.getByTestId('content')
    patchCapture(content)
    dispatchPointer(content, 'pointerdown', 0, 1)
    dispatchPointer(content, 'pointermove', 50, 10)
    dispatchPointer(content, 'pointerup', 50, 20)
    const staleFrame = frames.first()

    rendered.rerender(row(null, onChange, true))
    await act(() => Promise.resolve())
    staleFrame(400)
    await act(() => Promise.resolve())

    expect(frames.pending()).toBe(0)
    expect(rendered.getByTestId('root')).toHaveStyle({
      '--swipe-actions-offset': '0px',
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('cancels a drag frame through the scheduling Window', async () => {
    // Catches session cleanup falling back to the ambient Window after nulling session.
    const frame = document.createElement('iframe')
    document.body.append(frame)
    const frameWindow = frame.contentWindow!
    const requestFrame = vi.fn(() => 41)
    const cancelFrame = vi.fn()
    Object.defineProperties(frameWindow, {
      requestAnimationFrame: { configurable: true, value: requestFrame },
      cancelAnimationFrame: { configurable: true, value: cancelFrame },
    })
    const rendered = render(row(null), {
      container: frame.contentDocument!.body,
    })
    measure(rendered.container)
    await act(() => Promise.resolve())
    const content = rendered.getByTestId('content')
    patchCapture(content)

    dispatchPointer(content, 'pointerdown', 0, 1)
    dispatchPointer(content, 'pointermove', 40, 10)
    dispatchPointer(content, 'pointercancel', 40, 20)

    expect(requestFrame).toHaveBeenCalledOnce()
    expect(cancelFrame).toHaveBeenCalledExactlyOnceWith(41)
    rendered.unmount()
    frame.remove()
  })

  it('invalidates activation completion when the root unmounts', async () => {
    // Catches an animation generation invoking an action again after teardown.
    const onAction = vi.fn()
    const rendered = render(activationRow(onAction))
    await prepareActivationRow(rendered.container)
    const content = rendered.getByTestId('content')
    patchCapture(content)

    startActivation(content)
    const staleFrame = frames.first()
    expect(onAction).toHaveBeenCalledOnce()

    rendered.unmount()
    staleFrame(400)
    await act(() => Promise.resolve())

    expect(onAction).toHaveBeenCalledOnce()
    expect(frames.pending()).toBe(0)
  })

  it('invalidates activation completion when controlled state changes', async () => {
    // Catches a stale activation overriding the newer controlled side or reinvoking its claimant.
    const onAction = vi.fn()
    const onChange = vi.fn()
    const rendered = render(activationRow(onAction, onChange, null))
    await prepareActivationRow(rendered.container)
    const content = rendered.getByTestId('content')
    patchCapture(content)

    startActivation(content)
    const staleFrame = frames.first()
    expect(onAction).toHaveBeenCalledOnce()

    rendered.rerender(activationRow(onAction, onChange, 'trailing'))
    await act(() => Promise.resolve())
    staleFrame(400)
    await act(() => Promise.resolve())

    expect(onAction).toHaveBeenCalledOnce()
    expect(onChange).not.toHaveBeenCalled()
    expect(rendered.getByTestId('root')).toHaveStyle({
      '--swipe-actions-offset': '-96px',
    })
  })

  it('invalidates activation completion when its claimant is removed', async () => {
    // Catches a detached claimant remaining owned by an in-flight generation.
    const onAction = vi.fn()
    const rendered = render(activationRow(onAction))
    await prepareActivationRow(rendered.container)
    const content = rendered.getByTestId('content')
    patchCapture(content)

    startActivation(content)
    const staleFrame = frames.first()
    expect(onAction).toHaveBeenCalledOnce()

    rendered.rerender(activationRow(onAction, vi.fn(), undefined, false))
    await act(() => Promise.resolve())
    staleFrame(400)
    await act(() => Promise.resolve())

    expect(onAction).toHaveBeenCalledOnce()
    expect(rendered.queryByTestId('claimant')).not.toBeInTheDocument()
    expect(rendered.getByTestId('root')).toHaveStyle({
      '--swipe-actions-offset': '0px',
    })
  })

  it('invalidates activation completion when a new pointer starts', async () => {
    // Catches a prior generation surviving interruption by a secondary pointer.
    const onAction = vi.fn()
    const rendered = render(activationRow(onAction))
    await prepareActivationRow(rendered.container)
    const content = rendered.getByTestId('content')
    patchCapture(content)

    startActivation(content)
    const staleFrame = frames.first()
    expect(onAction).toHaveBeenCalledOnce()

    dispatchPointer(content, 'pointerdown', 227.2, 210, 2, false)
    dispatchPointer(content, 'pointercancel', 227.2, 220, 2, false)
    staleFrame(400)
    await act(() => Promise.resolve())

    expect(onAction).toHaveBeenCalledOnce()
    expect(rendered.getByTestId('root')).toHaveStyle({
      '--swipe-actions-offset': '0px',
    })
  })
})
