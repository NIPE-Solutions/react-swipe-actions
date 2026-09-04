import type {
  SwipeActionsDirection,
  SwipeActionsOpenSide,
  SwipeActionsSide,
} from '../public-types'
import { sideFromOffset } from '../state/direction'

export interface ResistanceInput {
  offset: number
  startOffset?: number
  restingSide?: SwipeActionsOpenSide
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
  const {
    direction,
    rowWidth,
    widths,
    fullSwipeSides,
    startOffset,
    restingSide,
  } = input
  let { offset } = input
  if (!Number.isFinite(offset) || !Number.isFinite(rowWidth) || rowWidth <= 0) {
    return 0
  }

  const startSide = sideFromOffset(startOffset ?? 0, direction)
  const nextSide = sideFromOffset(offset, direction)
  if (
    restingSide !== null &&
    restingSide !== undefined &&
    startSide === restingSide &&
    nextSide !== null &&
    nextSide !== restingSide
  ) {
    const crossingDistance = Math.min(
      positiveFinite(widths[restingSide]) * 0.25,
      rowWidth * 0.15,
    )
    offset =
      Math.sign(offset) * Math.max(0, Math.abs(offset) - crossingDistance)
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
