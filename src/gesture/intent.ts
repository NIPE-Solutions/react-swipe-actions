import type {
  SwipeActionsDirection,
  SwipeActionsOpenSide,
  SwipeActionsSide,
} from '../public-types'
import { physicalSign, sideFromOffset } from '../state/direction'
import { MAX_RELEASE_VELOCITY } from './velocity'

export type GestureIntent = 'pending' | 'horizontal' | 'vertical'

export interface ReleaseInput {
  offset: number
  velocity: number
  direction: SwipeActionsDirection
  rowWidth: number
  widths: Partial<Record<SwipeActionsSide, number>>
  fullSwipeSides?: Partial<Record<SwipeActionsSide, boolean>>
  openSide?: SwipeActionsOpenSide
  deadZone?: number
  openThreshold?: number
  fullSwipeThreshold?: number
}

export interface ReleaseTarget {
  kind: 'closed' | 'open' | 'activate'
  side: SwipeActionsSide | null
  offset: number
}

const DEFAULT_DEAD_ZONE = 6
const DEFAULT_DOMINANCE = 1.2
const DEFAULT_OPEN_THRESHOLD = 0.35
const DEFAULT_FULL_SWIPE_THRESHOLD = 0.7
const VELOCITY_PROJECTION_MS = 120
const FULL_SWIPE_MINIMUM_TRAVEL_RATIO = 0.15

export function classifyIntent(
  dx: number,
  dy: number,
  deadZone = DEFAULT_DEAD_ZONE,
  dominance = DEFAULT_DOMINANCE,
): GestureIntent {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
    return 'pending'
  }

  const safeDeadZone =
    Number.isFinite(deadZone) && deadZone >= 0 ? deadZone : DEFAULT_DEAD_ZONE
  const safeDominance =
    Number.isFinite(dominance) && dominance > 0 ? dominance : DEFAULT_DOMINANCE
  const horizontal = Math.abs(dx)
  const vertical = Math.abs(dy)

  if (Math.hypot(dx, dy) <= safeDeadZone) {
    return 'pending'
  }

  if (horizontal > vertical * safeDominance) {
    return 'horizontal'
  }

  return 'vertical'
}

export function resolveRelease(input: ReleaseInput): ReleaseTarget {
  const rowWidth = positiveFinite(input.rowWidth)
  const offset = Number.isFinite(input.offset) ? input.offset : 0
  if (rowWidth === 0 || offset === 0) {
    return closedTarget()
  }

  const side = sideFromOffset(offset, input.direction)
  if (side === null) {
    return closedTarget()
  }

  const actionWidth = positiveFinite(input.widths[side])
  if (actionWidth === 0) {
    return closedTarget()
  }

  const deadZone = validNonNegative(input.deadZone, DEFAULT_DEAD_ZONE)
  const openThreshold = validRatio(input.openThreshold, DEFAULT_OPEN_THRESHOLD)
  const fullSwipeThreshold = validRatio(
    input.fullSwipeThreshold,
    DEFAULT_FULL_SWIPE_THRESHOLD,
  )
  const sign = physicalSign(side, input.direction)
  const travel = Math.max(0, sign * offset)
  const velocity = clampFinite(
    input.velocity,
    -MAX_RELEASE_VELOCITY,
    MAX_RELEASE_VELOCITY,
  )
  const normalizedVelocity = sign * velocity
  const projectedTravel = travel + normalizedVelocity * VELOCITY_PROJECTION_MS
  const openDistance = actionWidth * openThreshold
  const fullSwipeDistance = rowWidth * fullSwipeThreshold
  const hasFullSwipe = input.fullSwipeSides?.[side] === true

  const canActivateFromVelocity =
    normalizedVelocity > 0 &&
    travel >= rowWidth * FULL_SWIPE_MINIMUM_TRAVEL_RATIO &&
    projectedTravel >= fullSwipeDistance
  if (
    hasFullSwipe &&
    (travel >= fullSwipeDistance || canActivateFromVelocity)
  ) {
    return { kind: 'activate', side, offset: sign * rowWidth }
  }

  const opensByDistance = travel >= openDistance
  const opensByVelocity =
    normalizedVelocity > 0 &&
    travel >= deadZone * 2 &&
    projectedTravel >= openDistance
  if ((opensByDistance && projectedTravel >= openDistance) || opensByVelocity) {
    return { kind: 'open', side, offset: sign * actionWidth }
  }

  return closedTarget()
}

function closedTarget(): ReleaseTarget {
  return { kind: 'closed', side: null, offset: 0 }
}

function validNonNegative(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value >= 0
    ? value
    : fallback
}

function validRatio(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 && value < 1
    ? value
    : fallback
}

function positiveFinite(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : 0
}

function clampFinite(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(maximum, Math.max(minimum, value))
}
