export interface AnimatorDependencies {
  read: () => number
  write: (value: number) => void
  now: () => number
  requestFrame: (callback: () => void) => number
  cancelFrame: (frame: number) => void
}

export interface AnimationOptions {
  velocity?: number
  reducedMotion?: boolean
}

export interface AnimationResult {
  status: 'completed' | 'canceled'
}

export interface SwipeAnimator {
  animateTo(
    target: number,
    options?: AnimationOptions,
  ): Promise<AnimationResult>
  cancel(): void
  isAnimating(): boolean
  current(): number
}

const MIN_DURATION = 120
const MAX_DURATION = 360
const MAX_VELOCITY = 2.5
const MIN_SETTLE_VELOCITY = 0.75

export function createAnimator({
  read,
  write,
  now,
  requestFrame,
  cancelFrame,
}: AnimatorDependencies): SwipeAnimator {
  let frame: number | null = null
  let generation = 0
  let resolveActive: ((result: AnimationResult) => void) | null = null

  const cancel = () => {
    generation += 1

    if (frame !== null) {
      cancelFrame(frame)
      frame = null
    }

    if (resolveActive !== null) {
      const resolve = resolveActive
      resolveActive = null
      resolve({ status: 'canceled' })
    }
  }

  return {
    animateTo(target, options = {}) {
      cancel()

      const start = finiteCoordinate(read())
      const destination = finiteCoordinate(target)

      if (options.reducedMotion === true || start === destination) {
        write(destination)
        return Promise.resolve({ status: 'completed' })
      }

      const duration = durationFor(start, destination, options.velocity)
      const startedAt = now()
      const activeGeneration = generation

      return new Promise<AnimationResult>((resolve) => {
        resolveActive = resolve

        const tick = () => {
          if (activeGeneration !== generation) {
            return
          }

          const elapsed = Math.max(0, now() - startedAt)
          const progress = Math.min(1, elapsed / duration)
          const value = start + (destination - start) * cubicEaseOut(progress)

          write(value)

          if (progress === 1) {
            frame = null
            resolveActive = null
            resolve({ status: 'completed' })
            return
          }

          frame = requestFrame(tick)
        }

        frame = requestFrame(tick)
      })
    },
    cancel,
    isAnimating: () => resolveActive !== null,
    current: () => finiteCoordinate(read()),
  }
}

function durationFor(
  start: number,
  target: number,
  velocity: number | undefined,
) {
  const direction = Math.sign(target - start)
  const releaseVelocity = Number.isFinite(velocity) ? (velocity ?? 0) : 0
  const towardTarget = Math.max(0, direction * releaseVelocity)
  const speed = Math.min(
    MAX_VELOCITY,
    Math.max(MIN_SETTLE_VELOCITY, towardTarget),
  )
  const unboundedDuration = Math.abs(target - start) / speed

  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, unboundedDuration))
}

function cubicEaseOut(progress: number) {
  return 1 - (1 - progress) ** 3
}

function finiteCoordinate(value: number) {
  return Number.isFinite(value) ? value : 0
}
