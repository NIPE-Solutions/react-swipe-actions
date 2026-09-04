import type { SwipeActionsDirection, SwipeActionsSide } from '../public-types'

export function physicalSign(
  side: SwipeActionsSide,
  direction: SwipeActionsDirection,
): 1 | -1 {
  return (side === 'leading') === (direction === 'ltr') ? 1 : -1
}

export function sideFromOffset(
  offset: number,
  direction: SwipeActionsDirection,
): SwipeActionsSide | null {
  if (!Number.isFinite(offset) || offset === 0) {
    return null
  }

  const physicalSide: SwipeActionsSide = offset > 0 ? 'leading' : 'trailing'
  return direction === 'ltr'
    ? physicalSide
    : physicalSide === 'leading'
      ? 'trailing'
      : 'leading'
}
