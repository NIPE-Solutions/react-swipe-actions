import type {
  SwipeActionsDirection,
  SwipeActionsOpenSide,
  SwipeActionsSide,
} from '../public-types'
import type { MeasurementSnapshot } from '../components/context'
import type { AnimationResult } from '../motion/animator'
import { applyResistance } from '../motion/resistance'
import { physicalSign } from '../state/direction'
import { isInteractiveTarget } from '../utils/dom'
import { classifyIntent, resolveRelease } from './intent'
import { estimateVelocity } from './velocity'
import type { VelocitySample } from './velocity'

export type GesturePhase =
  'closed' | 'open' | 'dragging' | 'settling' | 'activating'

export interface GesturePointerEvent {
  pointerId: number
  pointerType: string
  isTrusted?: boolean
  isPrimary: boolean
  button: number
  clientX: number
  clientY: number
  timeStamp: number
  target: EventTarget | null
  currentTarget: HTMLElement
  preventDefault(): void
}

export interface GestureClickEvent {
  detail: number
  pointerId?: number
  timeStamp: number
  target: EventTarget | null
  preventDefault(): void
  stopPropagation(): void
}

export interface GestureMotion {
  readOffset(): number
  writeOffset(offset: number): void
  settle(offset: number, velocity: number): Promise<AnimationResult>
  cancel(): boolean
  measurements(): MeasurementSnapshot
  direction(): SwipeActionsDirection
}

export interface GestureControllerOptions {
  motion: GestureMotion
  isDisabled(): boolean
  getOpenSide(): SwipeActionsOpenSide
  getOpenThreshold(): number
  getFullSwipeThreshold(): number
  beginOpening(side: SwipeActionsSide): void
  requestOpenSide(side: SwipeActionsOpenSide): SwipeActionsOpenSide
  setPhase(phase: GesturePhase): void
  setArmedSide(side: SwipeActionsSide | null): void
}

export interface GestureController {
  onPointerDown(event: GesturePointerEvent): void
  onPointerMove(event: GesturePointerEvent): void
  onPointerUp(event: GesturePointerEvent): void
  onPointerCancel(event: GesturePointerEvent): void
  onLostPointerCapture(event: GesturePointerEvent): void
  onClickCapture(event: GestureClickEvent): boolean
  cancel(reason: string): void
}

interface PointerSession {
  pointerId: number
  pointerType: string
  pointerIsTrusted: boolean
  surface: HTMLElement
  startX: number
  startY: number
  startTime: number
  startOffset: number
  startOpenSide: SwipeActionsOpenSide
  pendingOffset: number
  owner: 'pending' | 'horizontal' | 'vertical'
  captured: boolean
  interruptedSettle: boolean
  samples: VelocitySample[]
}

interface ClickSuppression {
  pointerId: number
  target: EventTarget | null
  completedAt: number | null
  timer: ReturnType<typeof setTimeout> | null
}

const VELOCITY_WINDOW_MS = 100
const CLICK_SUPPRESSION_MS = 400

export function createGestureController(
  options: GestureControllerOptions,
): GestureController {
  let session: PointerSession | null = null
  let dragFrame: number | null = null
  let settleGeneration = 0
  let suppression: ClickSuppression | null = null
  let blurWindow: Window | null = null

  const offsetForSide = (side: SwipeActionsOpenSide) => {
    if (side === null) {
      return 0
    }

    return (
      physicalSign(side, options.motion.direction()) *
      options.motion.measurements()[side].width
    )
  }

  const restingOffset = () => offsetForSide(options.getOpenSide())

  const restingPhase = (): GesturePhase =>
    options.getOpenSide() === null ? 'closed' : 'open'

  const armedSideForOffset = (offset: number): SwipeActionsSide | null => {
    const snapshot = options.motion.measurements()
    if (snapshot.contentWidth <= 0 || offset === 0) {
      return null
    }

    const leadingSign = physicalSign('leading', options.motion.direction())
    const logicalOffset = offset * leadingSign
    const side = logicalOffset > 0 ? 'leading' : 'trailing'
    const threshold = snapshot.contentWidth * options.getFullSwipeThreshold()
    return snapshot[side].fullSwipeAction !== null &&
      Math.abs(offset) >= threshold
      ? side
      : null
  }

  const removeBlurListener = () => {
    blurWindow?.removeEventListener('blur', onBlur)
    blurWindow = null
  }

  const clearDragFrame = () => {
    if (dragFrame === null) {
      return
    }

    cancelFrame(session?.surface ?? null, dragFrame)
    dragFrame = null
  }

  const clearSuppression = () => {
    if (suppression?.timer !== null && suppression?.timer !== undefined) {
      clearTimeout(suppression.timer)
    }
    suppression = null
  }

  const releaseCapture = (active: PointerSession) => {
    if (!active.captured) {
      return
    }

    active.captured = false
    try {
      active.surface.releasePointerCapture?.(active.pointerId)
    } catch {
      // Capture can already be gone when the browser reports capture loss.
    }
  }

  const abandonSession = (restore: boolean) => {
    const active = session
    clearDragFrame()
    session = null
    removeBlurListener()

    if (active !== null) {
      releaseCapture(active)
    }

    if (restore) {
      options.setArmedSide(null)
      options.motion.writeOffset(restingOffset())
      options.setPhase(restingPhase())
    }
  }

  const cancel = (reason: string) => {
    const motionWasActive = options.motion.cancel()
    const hadWork = session !== null || dragFrame !== null || motionWasActive
    settleGeneration += 1
    clearSuppression()
    options.setArmedSide(null)
    abandonSession(
      reason !== 'unmount' && (hadWork || reason === 'configuration'),
    )
  }

  const onBlur = () => cancel('blur')

  const listenForBlur = (surface: HTMLElement) => {
    const nextWindow = surface.ownerDocument.defaultView
    if (nextWindow === null || nextWindow === blurWindow) {
      return
    }

    removeBlurListener()
    blurWindow = nextWindow
    blurWindow.addEventListener('blur', onBlur)
  }

  const scheduleDragWrite = () => {
    const active = session
    if (active === null || dragFrame !== null) {
      return
    }

    dragFrame = requestFrame(active.surface, () => {
      dragFrame = null
      if (session !== active || active.owner !== 'horizontal') {
        return
      }
      options.motion.writeOffset(active.pendingOffset)
      options.setArmedSide(armedSideForOffset(active.pendingOffset))
    })
  }

  const finishWithoutOwnership = (active: PointerSession) => {
    const restore = active.interruptedSettle
    session = null
    removeBlurListener()
    if (restore) {
      options.motion.writeOffset(restingOffset())
      options.setPhase(restingPhase())
    }
  }

  const finishHorizontal = (event: GesturePointerEvent) => {
    const active = session
    if (active === null) {
      return
    }

    active.samples.push({ x: event.clientX, t: event.timeStamp })
    clearDragFrame()
    options.motion.writeOffset(active.pendingOffset)
    options.setArmedSide(armedSideForOffset(active.pendingOffset))
    session = null
    releaseCapture(active)
    removeBlurListener()

    if (suppression?.pointerId === active.pointerId) {
      suppression.target = event.target
      suppression.completedAt = event.timeStamp
      suppression.timer = setTimeout(clearSuppression, CLICK_SUPPRESSION_MS)
    }

    const snapshot = options.motion.measurements()
    const velocity = estimateVelocity(
      active.samples,
      event.timeStamp,
      VELOCITY_WINDOW_MS,
    )
    const target = resolveRelease({
      offset: active.pendingOffset,
      pointerDisplacement: event.clientX - active.startX,
      velocity,
      direction: options.motion.direction(),
      rowWidth: snapshot.contentWidth,
      widths: {
        leading: snapshot.leading.width,
        trailing: snapshot.trailing.width,
      },
      fullSwipeSides: {
        leading: snapshot.leading.fullSwipeAction !== null,
        trailing: snapshot.trailing.fullSwipeAction !== null,
      },
      openThreshold: options.getOpenThreshold(),
      fullSwipeThreshold: options.getFullSwipeThreshold(),
    })
    const generation = ++settleGeneration
    if (target.kind === 'open' && target.side !== null) {
      options.beginOpening(target.side)
    }
    options.setPhase(target.kind === 'activate' ? 'activating' : 'settling')
    if (target.kind === 'activate' && target.side !== null) {
      options.setArmedSide(target.side)
    } else {
      options.setArmedSide(null)
    }

    const activation =
      target.kind === 'activate' && target.side !== null
        ? snapshot[target.side].fullSwipeAction
        : null
    const completion = options.motion
      .settle(target.offset, velocity)
      .then((result) => {
        if (result.status !== 'completed' || generation !== settleGeneration) {
          return
        }

        if (target.kind === 'activate') {
          options.setArmedSide(null)
          const authoritativeSide = options.getOpenSide()
          options.motion.writeOffset(offsetForSide(authoritativeSide))
          options.setPhase(authoritativeSide === null ? 'closed' : 'open')
          return
        }

        const authoritativeSide = options.requestOpenSide(target.side)
        options.motion.writeOffset(offsetForSide(authoritativeSide))
        options.setPhase(authoritativeSide === null ? 'closed' : 'open')
      })
    void completion

    activation?.invoke()
  }

  return {
    onPointerDown(event) {
      if (session !== null) {
        if (event.pointerId !== session.pointerId) {
          cancel('second-pointer')
        }
        return
      }

      if (!event.isPrimary) {
        cancel('second-pointer')
        return
      }

      if (
        options.isDisabled() ||
        event.button !== 0 ||
        (event.pointerType === 'mouse' && isInteractiveTarget(event.target))
      ) {
        return
      }

      clearSuppression()
      const startOffset = options.motion.readOffset()
      const interruptedSettle = options.motion.cancel()
      settleGeneration += 1
      options.setArmedSide(null)
      session = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        pointerIsTrusted: event.isTrusted === true,
        surface: event.currentTarget,
        startX: event.clientX,
        startY: event.clientY,
        startTime: event.timeStamp,
        startOffset,
        startOpenSide: options.getOpenSide(),
        pendingOffset: startOffset,
        owner: 'pending',
        captured: false,
        interruptedSettle,
        samples: [],
      }
      listenForBlur(event.currentTarget)
    },

    onPointerMove(event) {
      const active = session
      if (active === null || event.pointerId !== active.pointerId) {
        return
      }

      if (active.owner === 'vertical') {
        return
      }

      const dx = event.clientX - active.startX
      if (active.owner === 'pending') {
        const intent = classifyIntent(dx, event.clientY - active.startY)
        if (intent === 'pending') {
          return
        }
        if (intent === 'vertical') {
          active.owner = 'vertical'
          if (active.interruptedSettle) {
            options.motion.writeOffset(restingOffset())
            options.setPhase(restingPhase())
            active.interruptedSettle = false
          }
          return
        }

        active.owner = 'horizontal'
        clearSuppression()
        suppression = {
          pointerId: active.pointerId,
          target: null,
          completedAt: null,
          timer: null,
        }
        active.samples = [
          { x: active.startX, t: active.startTime },
          { x: event.clientX, t: event.timeStamp },
        ]
        // Direct-touch pointers already have implicit capture. Recapturing a
        // trusted touch can emit a spurious lostpointercapture mid-gesture.
        if (active.pointerType !== 'touch' || !active.pointerIsTrusted) {
          try {
            active.surface.setPointerCapture?.(active.pointerId)
            active.captured = true
          } catch {
            active.captured = false
          }
        }
        options.setPhase('dragging')
      } else {
        active.samples.push({ x: event.clientX, t: event.timeStamp })
      }

      event.preventDefault()
      const snapshot = options.motion.measurements()
      active.pendingOffset = applyResistance({
        offset: active.startOffset + dx,
        startOffset: active.startOffset,
        restingSide: active.startOpenSide,
        direction: options.motion.direction(),
        rowWidth: snapshot.contentWidth,
        widths: {
          leading: snapshot.leading.width,
          trailing: snapshot.trailing.width,
        },
        fullSwipeSides: {
          leading: snapshot.leading.fullSwipeAction !== null,
          trailing: snapshot.trailing.fullSwipeAction !== null,
        },
      })
      scheduleDragWrite()
    },

    onPointerUp(event) {
      const active = session
      if (active === null || event.pointerId !== active.pointerId) {
        return
      }

      if (active.owner === 'horizontal') {
        finishHorizontal(event)
      } else {
        finishWithoutOwnership(active)
      }
    },

    onPointerCancel(event) {
      if (session?.pointerId === event.pointerId) {
        cancel('pointer-cancel')
      }
    },

    onLostPointerCapture(event) {
      if (session?.pointerId === event.pointerId) {
        cancel('lost-pointer-capture')
      }
    },

    onClickCapture(event) {
      const activeSuppression = suppression
      if (
        activeSuppression === null ||
        activeSuppression.completedAt === null ||
        event.detail === 0
      ) {
        return false
      }

      const pointerMatches =
        event.pointerId === undefined ||
        event.pointerId === activeSuppression.pointerId
      const targetMatches =
        activeSuppression.target === null ||
        event.target === activeSuppression.target ||
        (activeSuppression.target instanceof Node &&
          event.target instanceof Node &&
          activeSuppression.target.contains(event.target))
      const elapsed = event.timeStamp - activeSuppression.completedAt
      const timeMatches = elapsed >= 0 && elapsed <= CLICK_SUPPRESSION_MS

      if (!pointerMatches || !targetMatches || !timeMatches) {
        return false
      }

      clearSuppression()
      event.preventDefault()
      event.stopPropagation()
      return true
    },

    cancel,
  }
}

function requestFrame(surface: HTMLElement, callback: FrameRequestCallback) {
  const view = surface.ownerDocument.defaultView
  if (view !== null && typeof view.requestAnimationFrame === 'function') {
    return view.requestAnimationFrame(callback)
  }
  return requestAnimationFrame(callback)
}

function cancelFrame(surface: HTMLElement | null, frame: number) {
  const view = surface?.ownerDocument.defaultView
  if (view !== null && view !== undefined) {
    view.cancelAnimationFrame(frame)
    return
  }
  cancelAnimationFrame(frame)
}
