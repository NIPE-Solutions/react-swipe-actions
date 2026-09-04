import { describe, expect, it } from 'vitest'

import { estimateVelocity } from '../../src/gesture/velocity'

describe('recent-sample release velocity', () => {
  it('returns the hand-derived slow drag velocity in pixels per millisecond', () => {
    // Catches dividing displacement by a mismatched time unit.
    expect(
      estimateVelocity(
        [
          { x: 0, t: 0 },
          { x: 40, t: 40 },
        ],
        40,
        100,
      ),
    ).toBeCloseTo(1)
  })

  it('clamps a tiny fast motion to the maximum release velocity', () => {
    // Catches a one-millisecond sample creating an unbounded projected release.
    expect(
      estimateVelocity(
        [
          { x: 0, t: 0 },
          { x: 10, t: 1 },
        ],
        1,
        100,
      ),
    ).toBe(2)
  })

  it('returns zero after a release pause longer than the rolling window', () => {
    // Catches stale drag movement being used after the user has stopped.
    expect(
      estimateVelocity(
        [
          { x: 0, t: 0 },
          { x: 40, t: 40 },
        ],
        200,
        100,
      ),
    ).toBe(0)
  })

  it('linearly decays velocity during a pause that remains inside the window', () => {
    // Catches using now only to discard samples, preserving a stopped drag's speed.
    expect(
      estimateVelocity(
        [
          { x: 0, t: 99 },
          { x: 1, t: 100 },
        ],
        199,
        100,
      ),
    ).toBeCloseTo(0.01)
  })

  it('favors recent reversed segments over earlier movement', () => {
    // Catches averaging only the session start and end positions.
    expect(
      estimateVelocity(
        [
          { x: 0, t: 0 },
          { x: 40, t: 40 },
          { x: 20, t: 60 },
        ],
        60,
        100,
      ),
    ).toBeLessThan(0)
  })

  it('coalesces same-timestamp samples before estimating segments', () => {
    // Catches a zero-duration segment turning a normal drag into infinity.
    expect(
      estimateVelocity(
        [
          { x: 0, t: 0 },
          { x: 10, t: 10 },
          { x: 20, t: 10 },
          { x: 60, t: 30 },
        ],
        30,
        100,
      ),
    ).toBeCloseTo(2)
  })
})
