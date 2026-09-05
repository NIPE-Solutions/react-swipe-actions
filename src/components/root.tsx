import {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CSSProperties } from 'react'
import { createGestureController } from '../gesture/controller'
import type {
  GestureController,
  GesturePointerEvent,
} from '../gesture/controller'
import { createAnimator } from '../motion/animator'
import type { AnimationResult } from '../motion/animator'
import type { SwipeActionsHandle, SwipeActionsRootProps } from '../public-types'
import type { SwipeActionsDirection, SwipeActionsSide } from '../public-types'
import { useControllableOpenSide } from '../state/controllable'
import { physicalSign, sideFromArrowKey } from '../state/direction'
import {
  focusFirstEnabled,
  isEditableTarget,
  isKeyboardInteractiveTarget,
} from '../utils/dom'
import { warnOnce } from '../utils/warn'
import { useIsomorphicLayoutEffect } from '../utils/use-isomorphic-layout-effect'
import { GroupContext, RootContext } from './context'
import type {
  MeasurementSnapshot,
  RegisteredAction,
  RegisteredActionEntry,
} from './context'

interface SideContainerRegistration {
  element: HTMLDivElement
  width: number
}

interface ContentRegistration {
  element: HTMLDivElement
  width: number
}

interface RootMotionAdapter {
  readOffset(): number
  writeOffset(offset: number): void
  settle(offset: number, velocity: number): Promise<AnimationResult>
  cancel(): boolean
  setReducedMotion(reducedMotion: boolean): void
  measurements(): MeasurementSnapshot
  direction(): SwipeActionsDirection
  setArmedSide(side: SwipeActionsSide | null): void
  clearFullSwipeExpansion(): void
}

const DEFAULT_OPEN_THRESHOLD = 0.35
const DEFAULT_FULL_SWIPE_THRESHOLD = 0.7

type SwipeRootStyle = CSSProperties & {
  '--swipe-actions-offset': string
  '--swipe-actions-progress': string
  '--swipe-actions-leading-progress': string
  '--swipe-actions-trailing-progress': string
}

function firstValue<T>(values: Map<symbol, T>): T | undefined {
  return values.values().next().value
}

export const Root = forwardRef<SwipeActionsHandle, SwipeActionsRootProps>(
  function Root(
    {
      children,
      openSide: controlledOpenSide,
      defaultOpenSide,
      onOpenSideChange,
      disabled = false,
      direction,
      dir: htmlDirection,
      openThreshold: requestedOpenThreshold = DEFAULT_OPEN_THRESHOLD,
      fullSwipeThreshold:
        requestedFullSwipeThreshold = DEFAULT_FULL_SWIPE_THRESHOLD,
      style,
      ...rootProps
    },
    forwardedRef,
  ) {
    const [computedDirection, setComputedDirection] =
      useState<SwipeActionsDirection>(htmlDirection === 'rtl' ? 'rtl' : 'ltr')
    const resolvedDirection = direction ?? computedDirection
    const group = useContext(GroupContext)
    const groupRef = useRef(group)
    const groupId = useId()
    const elementRef = useRef<HTMLDivElement>(null)
    const disabledRef = useRef(disabled)
    const controlledRef = useRef(controlledOpenSide !== undefined)
    const openSideRef = useRef(controlledOpenSide ?? defaultOpenSide ?? null)
    const directionRef = useRef<SwipeActionsDirection>(resolvedDirection)
    const requestOpenSideRef = useRef<(side: SwipeActionsSide | null) => void>(
      () => undefined,
    )
    const contentRegistrationsRef = useRef(
      new Map<symbol, ContentRegistration>(),
    )
    const sideRegistrationsRef = useRef({
      leading: new Map<symbol, SideContainerRegistration>(),
      trailing: new Map<symbol, SideContainerRegistration>(),
    })
    const actionRegistrationsRef = useRef({
      leading: new Map<symbol, RegisteredActionEntry>(),
      trailing: new Map<symbol, RegisteredActionEntry>(),
    })
    const [hasActions, setHasActions] = useState(false)
    const reconcileScheduledRef = useRef(false)
    const mountedRef = useRef(false)
    const previousOpenSideRef = useRef(openSideRef.current)
    const pendingKeyboardFocusRef = useRef<SwipeActionsSide | null>(null)
    const motionRef = useRef<RootMotionAdapter | null>(null)
    const gestureRef = useRef<GestureController | null>(null)
    const [openSide, requestOpenSide] = useControllableOpenSide({
      value: controlledOpenSide,
      defaultValue: defaultOpenSide,
      onChange: onOpenSideChange,
    })
    const thresholdsAreValid = validThresholds(
      requestedOpenThreshold,
      requestedFullSwipeThreshold,
    )
    const openThreshold = thresholdsAreValid
      ? requestedOpenThreshold
      : DEFAULT_OPEN_THRESHOLD
    const fullSwipeThreshold = thresholdsAreValid
      ? requestedFullSwipeThreshold
      : DEFAULT_FULL_SWIPE_THRESHOLD
    const openThresholdRef = useRef(openThreshold)
    const fullSwipeThresholdRef = useRef(fullSwipeThreshold)

    disabledRef.current = disabled
    groupRef.current = group
    controlledRef.current = controlledOpenSide !== undefined
    openSideRef.current = openSide
    directionRef.current = resolvedDirection
    requestOpenSideRef.current = requestOpenSide
    openThresholdRef.current = openThreshold
    fullSwipeThresholdRef.current = fullSwipeThreshold

    const measurements = useCallback((): MeasurementSnapshot => {
      const leadingContainer = firstValue(sideRegistrationsRef.current.leading)
      const trailingContainer = firstValue(
        sideRegistrationsRef.current.trailing,
      )
      const leadingContainerId = sideRegistrationsRef.current.leading
        .keys()
        .next().value
      const trailingContainerId = sideRegistrationsRef.current.trailing
        .keys()
        .next().value

      return {
        contentWidth: firstValue(contentRegistrationsRef.current)?.width ?? 0,
        leading: {
          width: leadingContainer?.width ?? 0,
          fullSwipeAction:
            findEligibleAction(
              actionRegistrationsRef.current.leading,
              leadingContainerId,
            ) ?? null,
        },
        trailing: {
          width: trailingContainer?.width ?? 0,
          fullSwipeAction:
            findEligibleAction(
              actionRegistrationsRef.current.trailing,
              trailingContainerId,
            ) ?? null,
        },
      }
    }, [])

    if (motionRef.current === null) {
      motionRef.current = createRootMotionAdapter(
        elementRef,
        measurements,
        directionRef,
      )
    }

    if (gestureRef.current === null) {
      gestureRef.current = createGestureController({
        motion: motionRef.current,
        isDisabled: () => disabledRef.current,
        getOpenSide: () => openSideRef.current,
        getOpenThreshold: () => openThresholdRef.current,
        getFullSwipeThreshold: () => fullSwipeThresholdRef.current,
        beginOpening: () => groupRef.current?.notifyOpen(groupId),
        requestOpenSide: (side) => {
          requestOpenSideRef.current(side)
          return controlledRef.current ? openSideRef.current : side
        },
        setPhase: (phase) => {
          elementRef.current?.setAttribute('data-state', phase)
          if (phase === 'closed' || phase === 'open') {
            motionRef.current?.clearFullSwipeExpansion()
          }
        },
        setArmedSide: (side) => motionRef.current?.setArmedSide(side),
      })
    }

    const reconcileMeasurements = useCallback(() => {
      if (reconcileScheduledRef.current) {
        return
      }

      reconcileScheduledRef.current = true
      queueMicrotask(() => {
        reconcileScheduledRef.current = false
        if (!mountedRef.current) {
          return
        }

        const motion = motionRef.current
        if (motion === null) {
          return
        }

        gestureRef.current?.cancel('configuration')
        const side = openSideRef.current
        if (side !== null && sideRegistrationsRef.current[side].size === 0) {
          requestOpenSideRef.current(null)
        }
      })
    }, [measurements])

    const registerContent = useCallback(
      (id: symbol, element: HTMLDivElement) => {
        contentRegistrationsRef.current.set(id, { element, width: 0 })
        reconcileMeasurements()

        return () => {
          contentRegistrationsRef.current.delete(id)
          reconcileMeasurements()
        }
      },
      [reconcileMeasurements],
    )

    const updateContentWidth = useCallback(
      (id: symbol, width: number) => {
        if (!contentRegistrationsRef.current.has(id)) {
          return
        }
        const registration = contentRegistrationsRef.current.get(id)
        if (registration === undefined || registration.width === width) {
          return
        }
        registration.width = width
        reconcileMeasurements()
      },
      [reconcileMeasurements],
    )

    const validateFullSwipeClaimants = useCallback(() => {
      for (const side of ['leading', 'trailing'] as const) {
        const containerId = sideRegistrationsRef.current[side]
          .keys()
          .next().value
        if (containerId === undefined) {
          continue
        }

        let eligibleCount = 0
        for (const entry of actionRegistrationsRef.current[side].values()) {
          if (
            entry.containerId === containerId &&
            entry.action.fullSwipe &&
            !entry.action.disabled
          ) {
            eligibleCount += 1
          }
        }

        if (eligibleCount > 1) {
          const componentName = side === 'leading' ? 'Leading' : 'Trailing'
          warnOnce(
            `multiple-${side}-full-swipe-actions`,
            `SwipeActions.${componentName} has more than one enabled fullSwipe action. Disable fullSwipe on all but one action; the first enabled action is used.`,
          )
        }
      }
    }, [])

    const configurationChanged = useCallback(() => {
      validateFullSwipeClaimants()
      reconcileMeasurements()
    }, [reconcileMeasurements, validateFullSwipeClaimants])

    const updateHasActions = useCallback(() => {
      setHasActions(
        actionRegistrationsRef.current.leading.size > 0 ||
          actionRegistrationsRef.current.trailing.size > 0,
      )
    }, [])

    const registerSide = useCallback(
      (side: SwipeActionsSide, id: symbol, element: HTMLDivElement) => {
        if (sideRegistrationsRef.current[side].size > 0) {
          const componentName = side === 'leading' ? 'Leading' : 'Trailing'
          warnOnce(
            `duplicate-${side}-side`,
            `SwipeActions.Root received more than one SwipeActions.${componentName} container. Keep one SwipeActions.${componentName}; the first mounted container is used.`,
          )
        }
        sideRegistrationsRef.current[side].set(id, { element, width: 0 })
        configurationChanged()

        return () => {
          sideRegistrationsRef.current[side].delete(id)
          configurationChanged()
        }
      },
      [configurationChanged],
    )

    const updateSideWidth = useCallback(
      (side: SwipeActionsSide, id: symbol, width: number) => {
        const registration = sideRegistrationsRef.current[side].get(id)
        if (registration === undefined || registration.width === width) {
          return
        }
        registration.width = width
        reconcileMeasurements()
      },
      [reconcileMeasurements],
    )

    const registerAction = useCallback(
      (
        side: SwipeActionsSide,
        containerId: symbol,
        id: symbol,
        action: RegisteredAction,
      ) => {
        actionRegistrationsRef.current[side].set(id, {
          containerId,
          action,
        })
        updateHasActions()
        configurationChanged()

        return () => {
          actionRegistrationsRef.current[side].delete(id)
          updateHasActions()
          configurationChanged()
        }
      },
      [configurationChanged, updateHasActions],
    )

    const updateActionWidth = useCallback(
      (side: SwipeActionsSide, id: symbol, width: number) => {
        const entry = actionRegistrationsRef.current[side].get(id)
        if (entry === undefined || entry.action.width === width) {
          return
        }
        entry.action.width = width
        reconcileMeasurements()
      },
      [reconcileMeasurements],
    )

    useImperativeHandle(
      forwardedRef,
      () => ({
        open(side) {
          if (!disabledRef.current) {
            requestOpenSide(side)
          }
        },
        close() {
          if (!disabledRef.current) {
            requestOpenSide(null)
          }
        },
      }),
      [requestOpenSide],
    )

    useEffect(() => {
      return group?.register(groupId, () =>
        gestureRef.current?.closeFromGroup(),
      )
    }, [group, groupId])

    useEffect(() => {
      if (openSide !== null) {
        group?.notifyOpen(groupId)
      }
    }, [group, groupId, openSide])

    useEffect(() => {
      if (!thresholdsAreValid) {
        warnOnce(
          'invalid-threshold-ratios',
          'SwipeActions.Root thresholds must satisfy 0 < openThreshold < fullSwipeThreshold < 1. Using the defaults 0.35 and 0.7; provide two ordered ratios to correct this configuration.',
        )
      }
    }, [thresholdsAreValid])

    useIsomorphicLayoutEffect(() => {
      mountedRef.current = true
      reconcileMeasurements()

      return () => {
        mountedRef.current = false
        gestureRef.current?.cancel('unmount')
      }
    }, [reconcileMeasurements])

    useIsomorphicLayoutEffect(() => {
      const element = elementRef.current
      if (element === null || direction !== undefined) {
        return
      }

      const view = element.ownerDocument.defaultView
      const reconcileDirection = () => {
        const nextDirection = readComputedDirection(element, view)
        if (nextDirection === directionRef.current) {
          return
        }

        directionRef.current = nextDirection
        gestureRef.current?.cancel('configuration')
        setComputedDirection(nextDirection)
      }

      reconcileDirection()

      const MutationObserverConstructor =
        view?.MutationObserver ??
        (typeof MutationObserver === 'undefined' ? null : MutationObserver)
      if (MutationObserverConstructor === null) {
        return
      }

      const observer = new MutationObserverConstructor(reconcileDirection)
      let ancestor: HTMLElement | null = element
      while (ancestor !== null) {
        observer.observe(ancestor, {
          attributes: true,
          attributeFilter: ['dir'],
        })
        ancestor = ancestor.parentElement
      }

      return () => observer.disconnect()
    }, [direction])

    useIsomorphicLayoutEffect(() => {
      const view = elementRef.current?.ownerDocument.defaultView
      if (
        view === null ||
        view === undefined ||
        typeof view.matchMedia !== 'function'
      ) {
        return
      }

      const mediaQuery = view.matchMedia('(prefers-reduced-motion: reduce)')
      const reconcileMotionPreference = () => {
        motionRef.current?.setReducedMotion(mediaQuery.matches)
      }
      reconcileMotionPreference()

      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', reconcileMotionPreference)
        return () => {
          mediaQuery.removeEventListener('change', reconcileMotionPreference)
        }
      }

      mediaQuery.addListener(reconcileMotionPreference)
      return () => mediaQuery.removeListener(reconcileMotionPreference)
    }, [])

    useIsomorphicLayoutEffect(() => {
      reconcileMeasurements()
    }, [disabled, openSide, reconcileMeasurements, resolvedDirection])

    useIsomorphicLayoutEffect(() => {
      const element = elementRef.current
      if (element === null) {
        return
      }

      const activeElement = element.ownerDocument.activeElement
      const previousSide = previousOpenSideRef.current
      const previousContainer =
        previousSide === null
          ? undefined
          : firstValue(sideRegistrationsRef.current[previousSide])?.element
      const restoreRootFocus =
        previousSide !== null &&
        previousSide !== openSide &&
        activeElement !== null &&
        previousContainer?.contains(activeElement) === true

      const pendingSide = pendingKeyboardFocusRef.current
      if (pendingSide !== null && pendingSide === openSide) {
        pendingKeyboardFocusRef.current = null
        const container = firstValue(
          sideRegistrationsRef.current[pendingSide],
        )?.element
        if (container !== undefined) {
          focusFirstEnabled(container)
        }
      } else if (restoreRootFocus) {
        element.focus()
      }

      previousOpenSideRef.current = openSide
    })

    const context = useMemo(
      () => ({
        direction: resolvedDirection,
        openSide,
        openThreshold,
        fullSwipeThreshold,
        registerContent,
        updateContentWidth,
        registerSide,
        updateSideWidth,
        registerAction,
        updateActionWidth,
        configurationChanged,
        measurements,
        gesture: {
          onPointerDown: (event: GesturePointerEvent) =>
            gestureRef.current?.onPointerDown(event),
          onPointerMove: (event: GesturePointerEvent) =>
            gestureRef.current?.onPointerMove(event),
          onPointerUp: (event: GesturePointerEvent) =>
            gestureRef.current?.onPointerUp(event),
          onPointerCancel: (event: GesturePointerEvent) =>
            gestureRef.current?.onPointerCancel(event),
          onLostPointerCapture: (event: GesturePointerEvent) =>
            gestureRef.current?.onLostPointerCapture(event),
        },
      }),
      [
        resolvedDirection,
        fullSwipeThreshold,
        configurationChanged,
        measurements,
        openThreshold,
        openSide,
        registerAction,
        registerContent,
        registerSide,
        updateActionWidth,
        updateContentWidth,
        updateSideWidth,
      ],
    )

    const rootStyle: SwipeRootStyle = {
      ...style,
      '--swipe-actions-offset': '0px',
      '--swipe-actions-progress': '0',
      '--swipe-actions-leading-progress': '0',
      '--swipe-actions-trailing-progress': '0',
    }

    return (
      <RootContext.Provider value={context}>
        <div
          {...rootProps}
          ref={elementRef}
          dir={direction ?? htmlDirection}
          style={rootStyle}
          data-swipe-actions-root=""
          data-state={openSide === null ? 'closed' : 'open'}
          data-disabled={disabled ? '' : undefined}
          tabIndex={
            rootProps.tabIndex ?? (hasActions && !disabled ? 0 : undefined)
          }
          onKeyDown={(event) => {
            rootProps.onKeyDown?.(event)
            if (
              event.defaultPrevented ||
              disabledRef.current ||
              event.altKey ||
              event.ctrlKey ||
              event.metaKey ||
              event.shiftKey ||
              isEditableTarget(event.target)
            ) {
              return
            }

            if (event.key === 'Escape') {
              if (openSideRef.current !== null) {
                event.preventDefault()
                requestOpenSideRef.current(null)
              }
              return
            }

            if (
              event.target !== event.currentTarget &&
              isKeyboardInteractiveTarget(event.target, event.currentTarget)
            ) {
              return
            }

            const side = sideFromArrowKey(event.key, directionRef.current)
            if (
              side === null ||
              actionRegistrationsRef.current[side].size === 0
            ) {
              return
            }

            event.preventDefault()
            if (openSideRef.current === side) {
              const container = firstValue(
                sideRegistrationsRef.current[side],
              )?.element
              if (container !== undefined) {
                focusFirstEnabled(container)
              }
              return
            }

            pendingKeyboardFocusRef.current = side
            requestOpenSideRef.current(side)
          }}
          onClickCapture={(event) => {
            const suppressed = gestureRef.current?.onClickCapture(event)
            if (!suppressed) {
              rootProps.onClickCapture?.(event)
            }
          }}
        >
          {children}
        </div>
      </RootContext.Provider>
    )
  },
)

function findEligibleAction(
  actions: Map<symbol, RegisteredActionEntry>,
  containerId: symbol | undefined,
) {
  if (containerId === undefined) {
    return undefined
  }

  for (const entry of actions.values()) {
    if (
      entry.containerId === containerId &&
      entry.action.fullSwipe &&
      !entry.action.disabled
    ) {
      return entry.action
    }
  }

  return undefined
}

function validThresholds(openThreshold: number, fullSwipeThreshold: number) {
  return (
    Number.isFinite(openThreshold) &&
    Number.isFinite(fullSwipeThreshold) &&
    openThreshold > 0 &&
    openThreshold < fullSwipeThreshold &&
    fullSwipeThreshold < 1
  )
}

function createRootMotionAdapter(
  elementRef: { current: HTMLDivElement | null },
  measurements: () => MeasurementSnapshot,
  directionRef: { current: SwipeActionsDirection },
): RootMotionAdapter {
  let offset = 0
  let armedSide: SwipeActionsSide | null = null
  let armedAction: HTMLButtonElement | null = null
  let expandingAction: HTMLButtonElement | null = null
  let reducedMotion = false
  let activeSettle: ActiveSettle | null = null

  const clearArmedAction = () => {
    if (armedAction === null) {
      return
    }

    armedAction.removeAttribute('data-active')
    armedAction.style.removeProperty('--swipe-actions-full-swipe-width')
    armedAction.style.removeProperty('--swipe-actions-full-swipe-progress')
    armedAction = null
  }

  const writeArmedAction = () => {
    const snapshot = measurements()
    const nextAction =
      armedSide === null ? null : snapshot[armedSide].fullSwipeAction?.element

    if (nextAction !== armedAction) {
      clearArmedAction()
      armedAction = nextAction ?? null
    }

    if (armedAction === null) {
      return
    }

    const width = Math.min(snapshot.contentWidth, Math.abs(offset))
    const progress =
      snapshot.contentWidth > 0 ? width / snapshot.contentWidth : 0
    armedAction.setAttribute('data-active', '')
    armedAction.style.setProperty(
      '--swipe-actions-full-swipe-width',
      `${width}px`,
    )
    armedAction.style.setProperty(
      '--swipe-actions-full-swipe-progress',
      String(progress),
    )
  }

  const clearFullSwipeExpansion = () => {
    if (expandingAction === null) {
      return
    }

    expandingAction.removeAttribute('data-full-swipe-expanding')
    expandingAction.style.removeProperty(
      '--swipe-actions-full-swipe-expansion-width',
    )
    expandingAction.style.removeProperty(
      '--swipe-actions-full-swipe-expansion-progress',
    )
    expandingAction = null
  }

  const writeFullSwipeExpansion = (
    snapshot: MeasurementSnapshot,
    side: SwipeActionsSide | null,
  ) => {
    const nextAction =
      side === null ? null : (snapshot[side].fullSwipeAction?.element ?? null)

    if (nextAction !== expandingAction) {
      clearFullSwipeExpansion()
      expandingAction = nextAction
    }

    if (expandingAction === null || snapshot.contentWidth <= 0) {
      return
    }

    const width = Math.min(snapshot.contentWidth, Math.abs(offset))
    const progress = width / snapshot.contentWidth
    expandingAction.setAttribute('data-full-swipe-expanding', '')
    expandingAction.style.setProperty(
      '--swipe-actions-full-swipe-expansion-width',
      `${width}px`,
    )
    expandingAction.style.setProperty(
      '--swipe-actions-full-swipe-expansion-progress',
      String(progress),
    )
  }

  const readOffset = () => {
    const content = firstContentElement(elementRef.current)
    if (content === null || typeof getComputedStyle === 'undefined') {
      return offset
    }

    return readTranslateX(getComputedStyle(content).transform, offset)
  }

  const animator = createAnimator({
    read: readOffset,
    write: writeOffset,
    now: () => performance.now(),
    requestFrame: (callback) => {
      const view = elementRef.current?.ownerDocument.defaultView
      return (
        view?.requestAnimationFrame(callback) ?? requestAnimationFrame(callback)
      )
    },
    cancelFrame: (frame) => {
      const view = elementRef.current?.ownerDocument.defaultView
      if (view !== null && view !== undefined) {
        view.cancelAnimationFrame(frame)
      } else {
        cancelAnimationFrame(frame)
      }
    },
  })

  function writeOffset(nextOffset: number) {
    offset = Number.isFinite(nextOffset) ? nextOffset : 0
    const element = elementRef.current
    if (element === null) {
      return
    }

    const snapshot = measurements()
    const leadingSign = physicalSign('leading', directionRef.current)
    const logicalOffset = offset * leadingSign
    const activeSide =
      logicalOffset > 0 ? 'leading' : logicalOffset < 0 ? 'trailing' : null
    const activeWidth = activeSide === null ? 0 : snapshot[activeSide].width
    const progress =
      activeWidth > 0 ? Math.min(1, Math.abs(offset) / activeWidth) : 0

    element.style.setProperty('--swipe-actions-offset', `${offset}px`)
    element.style.setProperty('--swipe-actions-progress', String(progress))
    element.style.setProperty(
      '--swipe-actions-leading-progress',
      activeSide === 'leading' ? String(progress) : '0',
    )
    element.style.setProperty(
      '--swipe-actions-trailing-progress',
      activeSide === 'trailing' ? String(progress) : '0',
    )
    if (activeSide === null) {
      element.removeAttribute('data-revealing-side')
    } else {
      element.setAttribute('data-revealing-side', activeSide)
    }
    const content = firstContentElement(element)
    if (content !== null) {
      content.style.transform = `translate3d(${offset}px, 0, 0)`
    }
    writeFullSwipeExpansion(snapshot, activeSide)
    writeArmedAction()
  }

  return {
    readOffset,
    writeOffset,
    settle(target, velocity) {
      return new Promise<AnimationResult>((resolve) => {
        const settle: ActiveSettle = {
          target,
          settled: false,
          resolve,
        }
        activeSettle = settle
        void animator
          .animateTo(target, { velocity, reducedMotion })
          .then((result) => finishSettle(settle, result))
      })
    },
    cancel() {
      const wasAnimating = animator.isAnimating()
      animator.cancel()
      offset = readOffset()
      return wasAnimating
    },
    setReducedMotion(nextReducedMotion) {
      reducedMotion = nextReducedMotion
      const settle = activeSettle
      if (
        !nextReducedMotion ||
        settle === null ||
        settle.settled ||
        !animator.isAnimating()
      ) {
        return
      }

      animator.cancel()
      writeOffset(settle.target)
      finishSettle(settle, { status: 'completed' })
    },
    measurements,
    direction: () => directionRef.current,
    setArmedSide(side) {
      armedSide = side
      if (side === null) {
        clearArmedAction()
      } else {
        writeArmedAction()
      }
    },
    clearFullSwipeExpansion,
  }

  function finishSettle(settle: ActiveSettle, result: AnimationResult) {
    if (settle.settled) {
      return
    }

    settle.settled = true
    if (activeSettle === settle) {
      activeSettle = null
    }
    settle.resolve(result)
  }
}

interface ActiveSettle {
  target: number
  settled: boolean
  resolve(result: AnimationResult): void
}

function readComputedDirection(
  element: HTMLElement,
  view: Window | null,
): SwipeActionsDirection {
  if (view === null || typeof view.getComputedStyle !== 'function') {
    return 'ltr'
  }

  return view.getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr'
}

function firstContentElement(root: HTMLDivElement | null) {
  return (
    root?.querySelector<HTMLDivElement>('[data-swipe-actions-content]') ?? null
  )
}

function readTranslateX(transform: string, fallback: number) {
  if (transform === '' || transform === 'none') {
    return fallback
  }

  const matrix3d = transform.match(/^matrix3d\((.+)\)$/)
  if (matrix3d?.[1] !== undefined) {
    const value = Number(matrix3d[1].split(',')[12])
    return Number.isFinite(value) ? value : fallback
  }

  const matrix = transform.match(/^matrix\((.+)\)$/)
  if (matrix?.[1] !== undefined) {
    const value = Number(matrix[1].split(',')[4])
    return Number.isFinite(value) ? value : fallback
  }

  const translate = transform.match(
    /^translate(?:3d|X)?\(\s*(-?\d+(?:\.\d+)?)px/,
  )
  const value = Number(translate?.[1])
  return Number.isFinite(value) ? value : fallback
}
