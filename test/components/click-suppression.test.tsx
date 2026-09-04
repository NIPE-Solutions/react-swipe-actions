import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Content, Leading, Root } from '../../src'
import { resizeObserverMock } from '../setup'

function pointer(
  target: Element,
  type: string,
  x: number,
  y: number,
  timeStamp: number,
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'touch' },
    isPrimary: { value: true },
    button: { value: 0 },
    clientX: { value: x },
    clientY: { value: y },
    timeStamp: { value: timeStamp },
  })
  act(() => target.dispatchEvent(event))
  return event
}

function click(target: Element, timeStamp: number, pointerId = 1) {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    detail: 1,
  })
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    timeStamp: { value: timeStamp },
  })
  act(() => target.dispatchEvent(event))
  return event
}

async function renderTargets() {
  const firstClick = vi.fn()
  const secondClick = vi.fn()
  const linkClick = vi.fn((event: React.MouseEvent) => event.preventDefault())
  const rendered = render(
    <Root>
      <Leading data-testid="leading" />
      <Content data-testid="content">
        <button type="button" onClick={firstClick}>
          First
        </button>
        <button type="button" onClick={secondClick}>
          Second
        </button>
        <a href="#target" onClick={linkClick}>
          Link
        </a>
      </Content>
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

  return {
    content,
    first: rendered.getByRole('button', { name: 'First' }),
    second: rendered.getByRole('button', { name: 'Second' }),
    link: rendered.getByRole('link', { name: 'Link' }),
    firstClick,
    secondClick,
    linkClick,
  }
}

describe('SwipeActions click suppression', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => vi.unstubAllGlobals())

  it('preserves ordinary button and link clicks', async () => {
    // Catches root capture indiscriminately canceling descendant activation.
    const targets = await renderTargets()

    const buttonClick = click(targets.first, 10)
    const linkClick = click(targets.link, 20)

    expect(buttonClick.defaultPrevented).toBe(false)
    expect(linkClick.defaultPrevented).toBe(true)
    expect(targets.firstClick).toHaveBeenCalledOnce()
    expect(targets.linkClick).toHaveBeenCalledOnce()
  })

  it('preserves a click after movement that never leaves the dead zone', async () => {
    // Catches suppression being armed on pointer down or pending jitter.
    const targets = await renderTargets()

    pointer(targets.first, 'pointerdown', 10, 10, 1)
    pointer(targets.first, 'pointermove', 14, 12, 5)
    pointer(targets.first, 'pointerup', 14, 12, 10)
    const compatibilityClick = click(targets.first, 11)

    expect(compatibilityClick.defaultPrevented).toBe(false)
    expect(targets.firstClick).toHaveBeenCalledOnce()
  })

  it('cancels exactly one compatibility click after a horizontal drag', async () => {
    // Catches a real swipe activating content or suppressing an unrelated later click.
    const targets = await renderTargets()

    pointer(targets.first, 'pointerdown', 0, 0, 1)
    pointer(targets.first, 'pointermove', 40, 0, 10)
    pointer(targets.first, 'pointerup', 40, 0, 20)
    const compatibilityClick = click(targets.first, 21)
    const laterClick = click(targets.first, 22)

    expect(compatibilityClick.defaultPrevented).toBe(true)
    expect(laterClick.defaultPrevented).toBe(false)
    expect(targets.firstClick).toHaveBeenCalledOnce()
  })

  it('suppresses release over a different descendant without consuming later clicks', async () => {
    // Catches drag release activating a child other than the pointer-down target.
    const targets = await renderTargets()

    pointer(targets.first, 'pointerdown', 0, 0, 1)
    pointer(targets.content, 'pointermove', 40, 0, 10)
    pointer(targets.second, 'pointerup', 40, 0, 20)
    const compatibilityClick = click(targets.second, 21)
    const unrelatedClick = click(targets.link, 22)

    expect(compatibilityClick.defaultPrevented).toBe(true)
    expect(targets.secondClick).not.toHaveBeenCalled()
    expect(unrelatedClick.defaultPrevented).toBe(true)
    expect(targets.linkClick).toHaveBeenCalledOnce()
  })

  it('clears suppression when an owned session is canceled', async () => {
    // Catches cancellation leaving a stale marker that eats the next user click.
    const targets = await renderTargets()

    pointer(targets.first, 'pointerdown', 0, 0, 1)
    pointer(targets.first, 'pointermove', 40, 0, 10)
    pointer(targets.first, 'pointercancel', 40, 0, 20)
    const laterClick = click(targets.first, 21)

    expect(laterClick.defaultPrevented).toBe(false)
    expect(targets.firstClick).toHaveBeenCalledOnce()
  })

  it('expires suppression when no compatibility click arrives', async () => {
    // Catches an absent compatibility click poisoning a future interaction.
    vi.useFakeTimers()
    const targets = await renderTargets()

    pointer(targets.first, 'pointerdown', 0, 0, 1)
    pointer(targets.first, 'pointermove', 40, 0, 10)
    pointer(targets.first, 'pointerup', 40, 0, 20)
    act(() => vi.advanceTimersByTime(401))
    const laterClick = click(targets.first, 421)

    expect(laterClick.defaultPrevented).toBe(false)
    expect(targets.firstClick).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
})
