import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Action, Content, Leading, Root } from '../../src'
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
  }
}

function createMediaQuery(initialMatches: boolean) {
  let matches = initialMatches
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const mediaQuery = {
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    get matches() {
      return matches
    },
    addEventListener: vi.fn(
      (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener)
      },
    ),
    removeEventListener: vi.fn(
      (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener)
      },
    ),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  } as unknown as MediaQueryList

  return {
    mediaQuery,
    setMatches(nextMatches: boolean) {
      matches = nextMatches
      const event = { matches, media: mediaQuery.media } as MediaQueryListEvent
      for (const listener of listeners) listener(event)
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

async function renderRow(onOpenSideChange = vi.fn()) {
  const rendered = render(
    <Root data-testid="root" onOpenSideChange={onOpenSideChange}>
      <Leading data-testid="leading">
        <Action onAction={() => undefined}>Archive</Action>
      </Leading>
      <Content data-testid="content">Message</Content>
    </Root>,
  )
  const content = rendered.getByTestId('content')
  Object.assign(content, {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: () => true,
  })
  act(() => {
    resizeObserverMock.emit(content, 320)
    resizeObserverMock.emit(rendered.getByTestId('leading'), 80)
  })
  await act(() => Promise.resolve())
  return rendered
}

function beginLeadingSettle(content: Element) {
  dispatchPointer(content, 'pointerdown', 0, 1)
  dispatchPointer(content, 'pointermove', 50, 10)
  dispatchPointer(content, 'pointerup', 50, 200)
}

describe('SwipeActions reduced motion', () => {
  const frames = createFrames()

  beforeEach(() => frames.install())

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('finishes an in-flight settle immediately when reduced motion becomes preferred', async () => {
    // Catches a preference change leaving an animation frame or abandoning its semantic target.
    const media = createMediaQuery(false)
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media.mediaQuery),
    )
    const onOpenSideChange = vi.fn()
    const rendered = await renderRow(onOpenSideChange)
    const root = rendered.getByTestId('root')

    beginLeadingSettle(rendered.getByTestId('content'))
    expect(root).toHaveAttribute('data-state', 'settling')
    expect(frames.pending()).toBe(1)

    act(() => media.setMatches(true))
    await act(() => Promise.resolve())

    expect(frames.pending()).toBe(0)
    expect(onOpenSideChange).toHaveBeenCalledExactlyOnceWith('leading')
    expect(root).toHaveAttribute('data-state', 'open')
    expect(root).toHaveStyle({ '--swipe-actions-offset': '80px' })
  })

  it('keeps direct dragging interactive but settles without a frame when already reduced', async () => {
    // Catches reduced motion disabling direct manipulation or entering asynchronous settling.
    const media = createMediaQuery(true)
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media.mediaQuery),
    )
    const onOpenSideChange = vi.fn()
    const rendered = await renderRow(onOpenSideChange)
    const content = rendered.getByTestId('content')

    dispatchPointer(content, 'pointerdown', 0, 1)
    dispatchPointer(content, 'pointermove', 50, 10)
    expect(frames.pending()).toBe(1)
    dispatchPointer(content, 'pointerup', 50, 200)
    await act(() => Promise.resolve())

    expect(frames.pending()).toBe(0)
    expect(onOpenSideChange).toHaveBeenCalledExactlyOnceWith('leading')
    expect(rendered.getByTestId('root')).toHaveStyle({
      '--swipe-actions-offset': '80px',
    })
  })

  it('subscribes after mount and removes its media listener on unmount', async () => {
    // Catches a global listener leak across row unmounts or Strict Mode remounts.
    const media = createMediaQuery(false)
    const matchMedia = vi.fn(() => media.mediaQuery)
    vi.stubGlobal('matchMedia', matchMedia)
    const rendered = await renderRow()

    expect(matchMedia).toHaveBeenCalledExactlyOnceWith(
      '(prefers-reduced-motion: reduce)',
    )
    expect(media.mediaQuery.addEventListener).toHaveBeenCalledOnce()

    rendered.unmount()

    expect(media.mediaQuery.removeEventListener).toHaveBeenCalledOnce()
  })
})
