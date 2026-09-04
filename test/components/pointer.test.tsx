import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Action, Content, Leading, Root, Trailing } from '../../src'
import { resizeObserverMock } from '../setup'

interface PointerInit {
  pointerId?: number
  pointerType?: string
  isPrimary?: boolean
  clientX: number
  clientY: number
  timeStamp: number
  button?: number
}

function dispatchPointer(
  target: Element,
  type: string,
  {
    pointerId = 1,
    pointerType = 'touch',
    isPrimary = true,
    clientX,
    clientY,
    timeStamp,
    button = 0,
  }: PointerInit,
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: pointerType },
    isPrimary: { value: isPrimary },
    clientX: { value: clientX },
    clientY: { value: clientY },
    timeStamp: { value: timeStamp },
    button: { value: button },
  })

  act(() => target.dispatchEvent(event))
  return event
}

function createFrameLoop() {
  let time = 0
  let identifier = 0
  const callbacks = new Map<number, FrameRequestCallback>()

  return {
    install() {
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
    pending: () => callbacks.size,
  }
}

async function renderRow(
  rootProps: Partial<React.ComponentProps<typeof Root>> = {},
) {
  const onOpenSideChange = vi.fn()
  const rendered = render(
    <Root {...rootProps} onOpenSideChange={onOpenSideChange} data-testid="root">
      <Leading data-testid="leading">
        <Action onAction={() => undefined}>Archive</Action>
      </Leading>
      <Content data-testid="content">
        <span data-testid="first-child">Message</span>
        <span data-testid="second-child">Metadata</span>
      </Content>
      <Trailing data-testid="trailing">
        <Action onAction={() => undefined}>Delete</Action>
      </Trailing>
    </Root>,
  )

  const root = rendered.container.querySelector<HTMLElement>(
    '[data-testid="root"]',
  )!
  const content = rendered.container.querySelector<HTMLElement>(
    '[data-testid="content"]',
  )!
  const captures = new Set<number>()
  const setPointerCapture = vi.fn((pointerId: number) =>
    captures.add(pointerId),
  )
  const releasePointerCapture = vi.fn((pointerId: number) =>
    captures.delete(pointerId),
  )
  Object.assign(content, {
    setPointerCapture,
    releasePointerCapture,
    hasPointerCapture: (pointerId: number) => captures.has(pointerId),
  })

  act(() => {
    resizeObserverMock.emit(content, 320)
    resizeObserverMock.emit(
      rendered.container.querySelector('[data-testid="leading"]')!,
      80,
    )
    resizeObserverMock.emit(
      rendered.container.querySelector('[data-testid="trailing"]')!,
      96,
    )
  })
  await act(() => Promise.resolve())

  return {
    rendered,
    root,
    content,
    onOpenSideChange,
    setPointerCapture,
    releasePointerCapture,
  }
}

describe('SwipeActions pointer gestures', () => {
  const frames = createFrameLoop()

  beforeEach(() => frames.install())

  afterEach(() => vi.unstubAllGlobals())

  it('keeps pointer down pending, then locks horizontal motion to direct frames', async () => {
    // Catches eager capture/default prevention, per-move React state, and axis unlocking.
    const row = await renderRow()

    const down = dispatchPointer(row.content, 'pointerdown', {
      clientX: 0,
      clientY: 0,
      timeStamp: 0,
    })
    const jitter = dispatchPointer(row.content, 'pointermove', {
      clientX: 3,
      clientY: 2,
      timeStamp: 5,
    })
    const ownership = dispatchPointer(row.content, 'pointermove', {
      clientX: 30,
      clientY: 2,
      timeStamp: 10,
    })

    expect(down.defaultPrevented).toBe(false)
    expect(jitter.defaultPrevented).toBe(false)
    expect(ownership.defaultPrevented).toBe(true)
    expect(row.setPointerCapture).toHaveBeenCalledExactlyOnceWith(1)
    expect(row.root).toHaveStyle({ '--swipe-actions-offset': '0px' })
    expect(frames.pending()).toBe(1)

    dispatchPointer(row.content, 'pointermove', {
      clientX: 45,
      clientY: 4,
      timeStamp: 20,
    })
    expect(frames.pending()).toBe(1)
    frames.advance(16)
    expect(row.root).toHaveStyle({ '--swipe-actions-offset': '45px' })
    expect(row.content.style.transform).toBe('translate3d(45px, 0, 0)')
    expect(row.root).toHaveAttribute('data-state', 'dragging')
    expect(row.onOpenSideChange).not.toHaveBeenCalled()

    const locked = dispatchPointer(row.content, 'pointermove', {
      clientX: 60,
      clientY: 140,
      timeStamp: 200,
    })
    expect(locked.defaultPrevented).toBe(true)
    frames.advance(16)
    expect(row.root).toHaveStyle({ '--swipe-actions-offset': '60px' })

    dispatchPointer(row.content, 'pointerup', {
      clientX: 60,
      clientY: 140,
      timeStamp: 240,
    })
    expect(row.root).toHaveAttribute('data-state', 'settling')
    frames.advance(400)
    await act(() => Promise.resolve())

    expect(row.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(1)
    expect(row.onOpenSideChange).toHaveBeenCalledExactlyOnceWith('leading')
    expect(row.root).toHaveStyle({ '--swipe-actions-offset': '80px' })
  })

  it('permanently yields exact diagonal and vertical sessions to native scrolling', async () => {
    // Catches diagonal ties favoring swipe or a rejected vertical session reactivating.
    const row = await renderRow()

    dispatchPointer(row.content, 'pointerdown', {
      clientX: 0,
      clientY: 0,
      timeStamp: 0,
    })
    const diagonal = dispatchPointer(row.content, 'pointermove', {
      clientX: 10,
      clientY: 10,
      timeStamp: 10,
    })
    const laterHorizontal = dispatchPointer(row.content, 'pointermove', {
      clientX: 80,
      clientY: 11,
      timeStamp: 20,
    })
    dispatchPointer(row.content, 'pointerup', {
      clientX: 80,
      clientY: 11,
      timeStamp: 30,
    })

    expect(diagonal.defaultPrevented).toBe(false)
    expect(laterHorizontal.defaultPrevented).toBe(false)
    expect(row.setPointerCapture).not.toHaveBeenCalled()
    expect(frames.pending()).toBe(0)
    expect(row.root).toHaveStyle({ '--swipe-actions-offset': '0px' })
    expect(row.onOpenSideChange).not.toHaveBeenCalled()

    dispatchPointer(row.content, 'pointerdown', {
      pointerId: 2,
      clientX: 0,
      clientY: 0,
      timeStamp: 40,
    })
    const vertical = dispatchPointer(row.content, 'pointermove', {
      pointerId: 2,
      clientX: 4,
      clientY: 30,
      timeStamp: 50,
    })
    expect(vertical.defaultPrevented).toBe(false)
    expect(row.setPointerCapture).not.toHaveBeenCalled()
  })

  it('leaves jitter inside the dead zone click-compatible', async () => {
    // Catches tiny pointer noise acquiring horizontal ownership.
    const row = await renderRow()

    dispatchPointer(row.content, 'pointerdown', {
      clientX: 20,
      clientY: 20,
      timeStamp: 0,
    })
    const move = dispatchPointer(row.content, 'pointermove', {
      clientX: 24,
      clientY: 22,
      timeStamp: 10,
    })
    dispatchPointer(row.content, 'pointerup', {
      clientX: 24,
      clientY: 22,
      timeStamp: 20,
    })

    expect(move.defaultPrevented).toBe(false)
    expect(row.setPointerCapture).not.toHaveBeenCalled()
    expect(frames.pending()).toBe(0)
    expect(row.root).toHaveStyle({ '--swipe-actions-offset': '0px' })
  })

  it('uses recent release velocity for flicks, pauses, and reversals', async () => {
    // Catches resolving from total distance or the last delta without pause decay.
    const flick = await renderRow()
    dispatchPointer(flick.content, 'pointerdown', {
      clientX: 0,
      clientY: 0,
      timeStamp: 1,
    })
    dispatchPointer(flick.content, 'pointermove', {
      clientX: 20,
      clientY: 0,
      timeStamp: 10,
    })
    dispatchPointer(flick.content, 'pointerup', {
      clientX: 20,
      clientY: 0,
      timeStamp: 11,
    })
    expect(flick.root).toHaveAttribute('data-state', 'settling')
    frames.advance(400)
    await act(() => Promise.resolve())
    expect(flick.root).toHaveStyle({ '--swipe-actions-offset': '80px' })
    expect(flick.onOpenSideChange).toHaveBeenCalledWith('leading')

    const paused = await renderRow()
    dispatchPointer(paused.content, 'pointerdown', {
      clientX: 0,
      clientY: 0,
      timeStamp: 100,
    })
    dispatchPointer(paused.content, 'pointermove', {
      clientX: 20,
      clientY: 0,
      timeStamp: 110,
    })
    dispatchPointer(paused.content, 'pointerup', {
      clientX: 20,
      clientY: 0,
      timeStamp: 240,
    })
    frames.advance(400)
    await act(() => Promise.resolve())
    expect(paused.onOpenSideChange).not.toHaveBeenCalled()
    expect(paused.root).toHaveStyle({ '--swipe-actions-offset': '0px' })

    const reversal = await renderRow()
    dispatchPointer(reversal.content, 'pointerdown', {
      clientX: 0,
      clientY: 0,
      timeStamp: 1,
    })
    dispatchPointer(reversal.content, 'pointermove', {
      clientX: 50,
      clientY: 0,
      timeStamp: 10,
    })
    dispatchPointer(reversal.content, 'pointermove', {
      clientX: 40,
      clientY: 0,
      timeStamp: 20,
    })
    dispatchPointer(reversal.content, 'pointermove', {
      clientX: 35,
      clientY: 0,
      timeStamp: 30,
    })
    dispatchPointer(reversal.content, 'pointermove', {
      clientX: 30,
      clientY: 0,
      timeStamp: 40,
    })
    dispatchPointer(reversal.content, 'pointerup', {
      clientX: 30,
      clientY: 0,
      timeStamp: 41,
    })
    frames.advance(400)
    await act(() => Promise.resolve())
    expect(reversal.onOpenSideChange).not.toHaveBeenCalled()
    expect(reversal.root).toHaveStyle({ '--swipe-actions-offset': '0px' })
  })

  it.each(['pointercancel', 'lostpointercapture'])(
    'reconciles an owned drag after %s',
    async (eventType) => {
      // Catches canceled sessions leaving capture, a queued frame, or partial motion.
      const row = await renderRow()
      dispatchPointer(row.content, 'pointerdown', {
        clientX: 0,
        clientY: 0,
        timeStamp: 0,
      })
      dispatchPointer(row.content, 'pointermove', {
        clientX: 40,
        clientY: 0,
        timeStamp: 10,
      })

      dispatchPointer(row.content, eventType, {
        clientX: 40,
        clientY: 0,
        timeStamp: 20,
      })

      expect(row.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(1)
      expect(frames.pending()).toBe(0)
      expect(row.root).toHaveStyle({ '--swipe-actions-offset': '0px' })
      expect(row.root).toHaveAttribute('data-state', 'closed')
      expect(row.onOpenSideChange).not.toHaveBeenCalled()
    },
  )

  it('cancels an owned drag on window blur and on a second pointer', async () => {
    // Catches global interruption leaving the original pointer in control.
    const blurred = await renderRow()
    dispatchPointer(blurred.content, 'pointerdown', {
      clientX: 0,
      clientY: 0,
      timeStamp: 0,
    })
    dispatchPointer(blurred.content, 'pointermove', {
      clientX: 40,
      clientY: 0,
      timeStamp: 10,
    })
    act(() => window.dispatchEvent(new Event('blur')))

    expect(blurred.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(1)
    expect(blurred.root).toHaveStyle({ '--swipe-actions-offset': '0px' })

    const multi = await renderRow()
    dispatchPointer(multi.content, 'pointerdown', {
      clientX: 0,
      clientY: 0,
      timeStamp: 0,
    })
    dispatchPointer(multi.content, 'pointermove', {
      clientX: 40,
      clientY: 0,
      timeStamp: 10,
    })
    dispatchPointer(multi.content, 'pointerdown', {
      pointerId: 2,
      isPrimary: false,
      clientX: 20,
      clientY: 0,
      timeStamp: 15,
    })
    dispatchPointer(multi.content, 'pointermove', {
      pointerId: 1,
      clientX: 90,
      clientY: 0,
      timeStamp: 20,
    })

    expect(multi.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(1)
    expect(multi.setPointerCapture).toHaveBeenCalledOnce()
    expect(frames.pending()).toBe(0)
    expect(multi.root).toHaveStyle({ '--swipe-actions-offset': '0px' })
  })

  it('does not start a mouse drag from interactive or editable descendants', async () => {
    // Catches mouse gestures stealing native button, link, and editing interaction.
    const row = await renderRow()
    row.content.insertAdjacentHTML(
      'beforeend',
      '<button type="button">Native</button><div contenteditable="true">Edit</div>',
    )
    row.content.insertAdjacentHTML('beforeend', '<a href="#native">Link</a>')

    for (const target of [
      screen.getByRole('button', { name: 'Native' }),
      screen.getByText('Edit'),
      screen.getByRole('link', { name: 'Link' }),
    ]) {
      dispatchPointer(target, 'pointerdown', {
        pointerId: 7,
        pointerType: 'mouse',
        clientX: 0,
        clientY: 0,
        timeStamp: 0,
      })
      const move = dispatchPointer(target, 'pointermove', {
        pointerId: 7,
        pointerType: 'mouse',
        clientX: 60,
        clientY: 0,
        timeStamp: 10,
      })
      dispatchPointer(target, 'pointerup', {
        pointerId: 7,
        pointerType: 'mouse',
        clientX: 60,
        clientY: 0,
        timeStamp: 20,
      })
      expect(move.defaultPrevented).toBe(false)
    }

    expect(row.setPointerCapture).not.toHaveBeenCalled()
    expect(row.root).toHaveStyle({ '--swipe-actions-offset': '0px' })
  })

  it('starts an interrupted drag from the computed visual transform', async () => {
    // Catches an interrupted settle restarting from logical or cached motion state.
    const row = await renderRow()
    dispatchPointer(row.content, 'pointerdown', {
      clientX: 0,
      clientY: 0,
      timeStamp: 1,
    })
    dispatchPointer(row.content, 'pointermove', {
      clientX: 50,
      clientY: 0,
      timeStamp: 10,
    })
    dispatchPointer(row.content, 'pointerup', {
      clientX: 50,
      clientY: 0,
      timeStamp: 20,
    })

    const originalGetComputedStyle = getComputedStyle
    vi.stubGlobal('getComputedStyle', (element: Element) => {
      if (element === row.content) {
        return { transform: 'matrix(1, 0, 0, 1, 37, 0)' } as CSSStyleDeclaration
      }
      return originalGetComputedStyle(element)
    })
    dispatchPointer(row.content, 'pointerdown', {
      clientX: 100,
      clientY: 0,
      timeStamp: 30,
    })
    dispatchPointer(row.content, 'pointermove', {
      clientX: 120,
      clientY: 0,
      timeStamp: 40,
    })
    frames.advance(16)

    expect(row.root).toHaveStyle({ '--swipe-actions-offset': '57px' })
  })

  it('uses updated thresholds for a later pointer release', async () => {
    // Catches the stable controller closing over the first-render thresholds.
    const row = await renderRow({ openThreshold: 0.35 })
    row.rendered.rerender(
      <Root
        openThreshold={0.1}
        onOpenSideChange={row.onOpenSideChange}
        data-testid="root"
      >
        <Leading data-testid="leading">
          <Action onAction={() => undefined}>Archive</Action>
        </Leading>
        <Content data-testid="content">
          <span>Message</span>
        </Content>
        <Trailing data-testid="trailing">
          <Action onAction={() => undefined}>Delete</Action>
        </Trailing>
      </Root>,
    )
    await act(() => Promise.resolve())
    const content = row.rendered.getByTestId('content')
    Object.assign(content, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: () => true,
    })

    dispatchPointer(content, 'pointerdown', {
      clientX: 0,
      clientY: 0,
      timeStamp: 100,
    })
    dispatchPointer(content, 'pointermove', {
      clientX: 20,
      clientY: 0,
      timeStamp: 110,
    })
    dispatchPointer(content, 'pointerup', {
      clientX: 20,
      clientY: 0,
      timeStamp: 240,
    })
    frames.advance(400)
    await act(() => Promise.resolve())

    expect(row.onOpenSideChange).toHaveBeenCalledExactlyOnceWith('leading')
  })

  it('restores a controlled closed offset when an open request is rejected', async () => {
    // Catches a completed gesture target remaining visual after controlled state rejects it.
    const row = await renderRow({ openSide: null })

    dispatchPointer(row.content, 'pointerdown', {
      clientX: 0,
      clientY: 0,
      timeStamp: 1,
    })
    dispatchPointer(row.content, 'pointermove', {
      clientX: 60,
      clientY: 0,
      timeStamp: 100,
    })
    dispatchPointer(row.content, 'pointerup', {
      clientX: 60,
      clientY: 0,
      timeStamp: 200,
    })
    frames.advance(400)
    await act(() => Promise.resolve())

    expect(row.onOpenSideChange).toHaveBeenCalledExactlyOnceWith('leading')
    expect(row.root).toHaveAttribute('data-state', 'closed')
    expect(row.root).toHaveStyle({ '--swipe-actions-offset': '0px' })
  })

  it('restores a controlled open offset when a close request is rejected', async () => {
    // Catches a completed close target overriding an unchanged controlled open side.
    const row = await renderRow({ openSide: 'leading' })

    dispatchPointer(row.content, 'pointerdown', {
      clientX: 0,
      clientY: 0,
      timeStamp: 1,
    })
    dispatchPointer(row.content, 'pointermove', {
      clientX: -60,
      clientY: 0,
      timeStamp: 100,
    })
    dispatchPointer(row.content, 'pointerup', {
      clientX: -60,
      clientY: 0,
      timeStamp: 200,
    })
    frames.advance(400)
    await act(() => Promise.resolve())

    expect(row.onOpenSideChange).toHaveBeenCalledExactlyOnceWith(null)
    expect(row.root).toHaveAttribute('data-state', 'open')
    expect(row.root).toHaveStyle({ '--swipe-actions-offset': '80px' })
  })
})
