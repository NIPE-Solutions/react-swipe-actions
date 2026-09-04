import { describe, expect, it } from 'vitest'

import { classifyIntent, resolveRelease } from '../../src/gesture/intent'

describe('axis intent arbitration', () => {
  it.each([
    { dx: 4, dy: 3, deadZone: 6, dominance: 1.2, want: 'pending' },
    { dx: 12, dy: 4, deadZone: 6, dominance: 1.2, want: 'horizontal' },
    { dx: 10, dy: 10, deadZone: 6, dominance: 1.2, want: 'vertical' },
  ] as const)(
    'classifies dx=$dx and dy=$dy as $want',
    ({ dx, dy, deadZone, dominance, want }) => {
      // Catches diagonal movement being granted horizontal ownership.
      expect(classifyIntent(dx, dy, deadZone, dominance)).toBe(want)
    },
  )
})

describe('release target resolution', () => {
  const rowWidth = 320
  const widths = { leading: 96, trailing: 96 }

  it('closes when the revealed logical side has no actions', () => {
    // Catches opening an action panel whose measured width is zero.
    expect(
      resolveRelease({
        offset: 40,
        velocity: 0,
        direction: 'ltr',
        rowWidth,
        widths: { leading: 0, trailing: 96 },
        openThreshold: 0.35,
        fullSwipeThreshold: 0.7,
      }),
    ).toEqual({ kind: 'closed', side: null, offset: 0 })
  })

  it('opens after traveling the ordinary action-width threshold', () => {
    // Catches measuring normal opening against row width instead of action width.
    expect(
      resolveRelease({
        offset: 40,
        velocity: 0,
        direction: 'ltr',
        rowWidth,
        widths,
        openThreshold: 0.35,
        fullSwipeThreshold: 0.7,
      }),
    ).toEqual({ kind: 'open', side: 'leading', offset: 96 })
  })

  it('opens from a decisive velocity only after real travel clears two dead zones', () => {
    // Catches a tiny high-speed sample opening a panel without a real gesture.
    expect(
      resolveRelease({
        offset: 15,
        velocity: 0.5,
        direction: 'ltr',
        rowWidth,
        widths,
        openThreshold: 0.35,
        fullSwipeThreshold: 0.7,
      }),
    ).toEqual({ kind: 'open', side: 'leading', offset: 96 })
  })

  it('closes an already-open panel when a reversing flick projects through its threshold', () => {
    // Catches distance-only resolution that ignores an intentional closing flick.
    expect(
      resolveRelease({
        offset: 96,
        velocity: -1,
        direction: 'ltr',
        rowWidth,
        widths,
        openThreshold: 0.35,
        fullSwipeThreshold: 0.7,
      }),
    ).toEqual({ kind: 'closed', side: null, offset: 0 })
  })

  it('does not activate a full swipe from tiny travel despite maximum velocity', () => {
    // Catches velocity projection bypassing the minimum real full-swipe travel.
    expect(
      resolveRelease({
        offset: 20,
        velocity: 2,
        direction: 'ltr',
        rowWidth,
        widths,
        fullSwipeSides: { leading: true },
        openThreshold: 0.35,
        fullSwipeThreshold: 0.7,
      }),
    ).toEqual({ kind: 'open', side: 'leading', offset: 96 })
  })

  it('activates an eligible full swipe after traveling 70% of the row', () => {
    // Catches comparing full-swipe distance against action width.
    expect(
      resolveRelease({
        offset: 224,
        velocity: 0,
        direction: 'ltr',
        rowWidth,
        widths,
        fullSwipeSides: { leading: true },
        openThreshold: 0.35,
        fullSwipeThreshold: 0.7,
      }),
    ).toEqual({ kind: 'activate', side: 'leading', offset: 320 })
  })

  it.each([
    { offset: 220.8, want: { kind: 'open', side: 'leading', offset: 96 } },
    {
      offset: 227.2,
      want: { kind: 'activate', side: 'leading', offset: 320 },
    },
  ] as const)(
    'resolves slow leading travel at offset $offset without rounding the 70% boundary',
    ({ offset, want }) => {
      // Catches integer rounding arming 69% or rejecting 71% of a 320px row.
      expect(
        resolveRelease({
          offset,
          velocity: 0,
          direction: 'ltr',
          rowWidth,
          widths,
          fullSwipeSides: { leading: true },
          openThreshold: 0.35,
          fullSwipeThreshold: 0.7,
        }),
      ).toEqual(want)
    },
  )

  it('does not activate an armed full swipe against a strong closing velocity', () => {
    // Catches distance arming overriding a release that projects past closed.
    expect(
      resolveRelease({
        offset: 225,
        velocity: -2,
        direction: 'ltr',
        rowWidth,
        widths,
        fullSwipeSides: { leading: true },
        openThreshold: 0.35,
        fullSwipeThreshold: 0.7,
      }),
    ).toEqual({ kind: 'closed', side: null, offset: 0 })
  })

  it('does not velocity-activate below 15% real full-swipe travel', () => {
    // Catches the velocity path treating 47px as the 48px minimum on a 320px row.
    expect(
      resolveRelease({
        offset: 47,
        velocity: 2,
        direction: 'ltr',
        rowWidth,
        widths,
        fullSwipeSides: { leading: true },
        openThreshold: 0.35,
        fullSwipeThreshold: 0.7,
      }),
    ).toEqual({ kind: 'open', side: 'leading', offset: 96 })
  })

  it('velocity-activates at exactly 15% real full-swipe travel', () => {
    // Catches an exclusive minimum-travel comparison rejecting the 48px boundary.
    expect(
      resolveRelease({
        offset: 48,
        velocity: 2,
        direction: 'ltr',
        rowWidth,
        widths,
        fullSwipeSides: { leading: true },
        openThreshold: 0.35,
        fullSwipeThreshold: 0.7,
      }),
    ).toEqual({ kind: 'activate', side: 'leading', offset: 320 })
  })

  it('normalizes a negative physical offset to logical leading in RTL', () => {
    // Catches exposing physical left/right signs as logical sides in RTL.
    expect(
      resolveRelease({
        offset: -40,
        velocity: 0,
        direction: 'rtl',
        rowWidth,
        widths,
        openThreshold: 0.35,
        fullSwipeThreshold: 0.7,
      }),
    ).toEqual({ kind: 'open', side: 'leading', offset: -96 })
  })

  it.each([
    {
      direction: 'ltr',
      offset: -227.2,
      side: 'trailing',
      target: -320,
    },
    {
      direction: 'rtl',
      offset: -227.2,
      side: 'leading',
      target: -320,
    },
    {
      direction: 'rtl',
      offset: 227.2,
      side: 'trailing',
      target: 320,
    },
  ] as const)(
    'activates logical $side at the signed row width in $direction',
    ({ direction, offset, side, target }) => {
      // Catches applying one physical sign to both logical sides or directions.
      expect(
        resolveRelease({
          offset,
          velocity: 0,
          direction,
          rowWidth,
          widths,
          fullSwipeSides: { leading: true, trailing: true },
          openThreshold: 0.35,
          fullSwipeThreshold: 0.7,
        }),
      ).toEqual({ kind: 'activate', side, offset: target })
    },
  )
})
