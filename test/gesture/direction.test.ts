import { describe, expect, it } from 'vitest'

import { physicalSign, sideFromOffset } from '../../src/state/direction'

describe('logical-side direction mapping', () => {
  it.each([
    { side: 'leading' as const, direction: 'ltr' as const, want: 1 },
    { side: 'trailing' as const, direction: 'ltr' as const, want: -1 },
    { side: 'leading' as const, direction: 'rtl' as const, want: -1 },
    { side: 'trailing' as const, direction: 'rtl' as const, want: 1 },
  ])(
    'maps $side in $direction to the physical sign $want',
    ({ side, direction, want }) => {
      // Catches swapping logical leading and trailing when normalizing RTL.
      expect(physicalSign(side, direction)).toBe(want)
    },
  )

  it.each([
    { offset: 40, direction: 'ltr' as const, want: 'leading' },
    { offset: -40, direction: 'ltr' as const, want: 'trailing' },
    { offset: 40, direction: 'rtl' as const, want: 'trailing' },
    { offset: -40, direction: 'rtl' as const, want: 'leading' },
    { offset: 0, direction: 'ltr' as const, want: null },
  ])(
    'maps physical offset $offset in $direction to $want',
    ({ offset, direction, want }) => {
      // Catches treating physical signs as public logical-side values.
      expect(sideFromOffset(offset, direction)).toBe(want)
    },
  )
})
