export interface VelocitySample {
  x: number
  t: number
}

export const MAX_RELEASE_VELOCITY = 2

export function estimateVelocity(
  samples: readonly VelocitySample[],
  now: number,
  windowMs: number,
): number {
  if (!Number.isFinite(now) || !Number.isFinite(windowMs) || windowMs <= 0) {
    return 0
  }

  const firstTime = now - windowMs
  const recent = samples
    .filter(
      (sample) =>
        Number.isFinite(sample.x) &&
        Number.isFinite(sample.t) &&
        sample.t >= firstTime &&
        sample.t <= now,
    )
    .sort((a, b) => a.t - b.t)

  const coalesced: VelocitySample[] = []
  for (const sample of recent) {
    const last = coalesced.at(-1)
    if (last?.t === sample.t) {
      last.x = sample.x
    } else {
      coalesced.push({ ...sample })
    }
  }

  if (coalesced.length < 2) {
    return 0
  }

  const firstSample = coalesced[0]
  if (!firstSample) {
    return 0
  }

  let weightedVelocity = 0
  let totalWeight = 0
  for (let index = 1; index < coalesced.length; index += 1) {
    const previous = coalesced[index - 1]
    const current = coalesced[index]
    if (!previous || !current) {
      continue
    }

    const duration = current.t - previous.t
    if (duration <= 0) {
      continue
    }

    const weight = current.t - firstSample.t
    weightedVelocity += ((current.x - previous.x) / duration) * weight
    totalWeight += weight
  }

  if (totalWeight === 0) {
    return 0
  }

  return clamp(
    weightedVelocity / totalWeight,
    -MAX_RELEASE_VELOCITY,
    MAX_RELEASE_VELOCITY,
  )
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
