import type { SwipeActionsDirection, SwipeActionsSide } from '../public-types'
import { sideFromOffset } from '../state/direction'

export interface ResistanceInput {
  offset: number
  direction: SwipeActionsDirection
  rowWidth: number
  widths: Partial<Record<SwipeActionsSide, number>>
  fullSwipeSides?: Partial<Record<SwipeActionsSide, boolean>>
}

export function resistedDistance(excess: number, dimension: number): number {
  if (
    !Number.isFinite(excess) ||
    !Number.isFinite(dimension) ||
    dimension <= 0
  ) {
    return 0
  }

  const magnitude = Math.abs(excess)
  return dimension * (1 - 1 / (magnitude / dimension + 1))
}

export function applyResistance(input: ResistanceInput): number {
  const { offset, direction, rowWidth, widths, fullSwipeSides } = input
  if (!Number.isFinite(offset) || !Number.isFinite(rowWidth) || rowWidth <= 0) {
    return 0
  }

  const side = sideFromOffset(offset, direction)
  if (side === null) {
    return 0
  }

  const width = positiveFinite(widths[side])
  const hasFullSwipe = fullSwipeSides?.[side] === true && width > 0
  const unrestrictedDistance = hasFullSwipe ? rowWidth : width
  const magnitude = Math.abs(offset)
  const resisted =
    magnitude <= unrestrictedDistance
      ? magnitude
      : unrestrictedDistance +
        resistedDistance(magnitude - unrestrictedDistance, rowWidth)

  return Math.sign(offset) * resisted
}

function positiveFinite(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : 0
}
