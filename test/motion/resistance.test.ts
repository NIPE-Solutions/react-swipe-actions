import { describe, expect, it } from 'vitest'

import { applyResistance, resistedDistance } from '../../src/motion/resistance'

const rowWidth = 320
const widths = { leading: 96, trailing: 96 }

describe('non-linear overswipe resistance', () => {
  it('uses the bounded asymptotic curve for excess distance', () => {
    // Catches substituting a linear overswipe distance.
    expect(resistedDistance(320, 320)).toBe(160)
  })

  it('resists immediately toward a side with no actions', () => {
    // Catches allowing unrestricted movement toward an unavailable side.
    expect(
      applyResistance({
        offset: 96,
        direction: 'ltr',
        rowWidth,
        widths: { leading: 0, trailing: 96 },
      }),
    ).toBeCloseTo(73.846154)
  })

  it('resists after revealing the ordinary action width', () => {
    // Catches treating a normal action side like a full-swipe side.
    expect(
      applyResistance({
        offset: 192,
        direction: 'ltr',
        rowWidth,
        widths,
      }),
    ).toBeCloseTo(169.846154)
  })

  it('allows an eligible full-swipe side to expand through the row width', () => {
    // Catches applying ordinary-width resistance before a full swipe can arm.
    expect(
      applyResistance({
        offset: 192,
        direction: 'ltr',
        rowWidth,
        widths,
        fullSwipeSides: { leading: true },
      }),
    ).toBe(192)
  })

  it('resists expansion beyond the row width even for a full-swipe side', () => {
    // Catches an eligible full swipe producing unbounded translation.
    expect(
      applyResistance({
        offset: 640,
        direction: 'ltr',
        rowWidth,
        widths,
        fullSwipeSides: { leading: true },
      }),
    ).toBe(480)
  })
})
