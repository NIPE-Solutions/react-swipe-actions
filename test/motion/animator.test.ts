import { describe, expect, it } from 'vitest'

import { createAnimator } from '../../src/motion/animator'

type FrameCallback = () => void

function createFrameLoop() {
  let time = 0
  let identifier = 0
  const callbacks = new Map<number, FrameCallback>()

  return {
    now: () => time,
    requestFrame: (callback: FrameCallback) => {
      identifier += 1
      callbacks.set(identifier, callback)
      return identifier
    },
    cancelFrame: (frame: number) => {
      callbacks.delete(frame)
    },
    advance: (milliseconds: number) => {
      time += milliseconds
      const current = [...callbacks.values()]
      callbacks.clear()
      current.forEach((callback) => callback())
    },
    pending: () => callbacks.size,
    takePending: () => {
      const frame = callbacks.entries().next().value
      if (frame === undefined) {
        throw new Error('Expected a pending animation frame')
      }

      callbacks.delete(frame[0])
      return frame[1]
    },
  }
}

describe('createAnimator', () => {
  it('returns a short paused drag without an abrupt first-frame jump', () => {
    const frames = createFrameLoop()
    let visual = 36
    const animator = createAnimator({
      read: () => visual,
      write: (value) => {
        visual = value
      },
      now: frames.now,
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
    })

    void animator.animateTo(0, { velocity: 0 })
    frames.advance(16)

    expect(visual).toBeGreaterThan(30)
    expect(visual).toBeLessThan(36)
  })

  it('settles monotonically at its target and completes exactly once', async () => {
    // Catches a non-monotonic easing curve or an animation that settles twice.
    const frames = createFrameLoop()
    let visual = 0
    const writes: number[] = []
    const animator = createAnimator({
      read: () => visual,
      write: (value) => {
        visual = value
        writes.push(value)
      },
      now: frames.now,
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
    })
    let completions = 0

    const result = animator.animateTo(100).then((outcome) => {
      completions += 1
      return outcome
    })

    for (let index = 0; index < 6; index += 1) {
      frames.advance(80)
    }

    expect(writes).toHaveLength(2)
    expect(writes[0]).toBeGreaterThan(0)
    expect(writes[0]).toBeLessThan(100)
    expect(writes[1]).toBe(100)
    expect(animator.current()).toBe(100)
    expect(animator.isAnimating()).toBe(false)
    await expect(result).resolves.toEqual({ status: 'completed' })
    expect(completions).toBe(1)
  })

  it('cancels the active promise and ignores a stale frame callback', async () => {
    // Catches an invalidated frame completing or writing after cancellation.
    const frames = createFrameLoop()
    let visual = 0
    const animator = createAnimator({
      read: () => visual,
      write: (value) => {
        visual = value
      },
      now: frames.now,
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
    })

    const result = animator.animateTo(100)
    const staleFrame = frames.takePending()

    animator.cancel()
    staleFrame()

    await expect(result).resolves.toEqual({ status: 'canceled' })
    expect(visual).toBe(0)
    expect(animator.isAnimating()).toBe(false)
  })

  it('writes the target and completes without a frame for reduced motion', async () => {
    // Catches reduced motion entering the asynchronous settle path.
    const frames = createFrameLoop()
    let visual = 12
    const animator = createAnimator({
      read: () => visual,
      write: (value) => {
        visual = value
      },
      now: frames.now,
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
    })

    const result = animator.animateTo(100, { reducedMotion: true })

    await expect(result).resolves.toEqual({ status: 'completed' })
    expect(visual).toBe(100)
    expect(frames.pending()).toBe(0)
    expect(animator.isAnimating()).toBe(false)
  })

  it('begins an interrupted animation from the captured visible coordinate and resolves both promises', async () => {
    // Catches restarting from stale logical state instead of the visible position.
    const frames = createFrameLoop()
    let visual = 60
    const writes: number[] = []
    const animator = createAnimator({
      read: () => visual,
      write: (value) => {
        visual = value
        writes.push(value)
      },
      now: frames.now,
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
    })

    const first = animator.animateTo(0)
    frames.advance(40)
    const visibleDuringFirstSettle = animator.current()
    const second = animator.animateTo(100)

    expect(animator.current()).toBe(visibleDuringFirstSettle)
    await expect(first).resolves.toEqual({ status: 'canceled' })

    frames.advance(10)

    expect(visibleDuringFirstSettle).toBeGreaterThan(0)
    expect(writes.at(-1)).toBeGreaterThan(visibleDuringFirstSettle)
    expect(writes.at(-1)).toBeLessThan(100)

    frames.advance(400)
    await expect(second).resolves.toEqual({ status: 'completed' })
    expect(animator.current()).toBe(100)
  })
})
