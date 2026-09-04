import {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import type { CSSProperties } from 'react'
import type { SwipeActionsHandle, SwipeActionsRootProps } from '../public-types'
import type { SwipeActionsDirection, SwipeActionsSide } from '../public-types'
import { useControllableOpenSide } from '../state/controllable'
import { physicalSign } from '../state/direction'
import { warnOnce } from '../utils/warn'
import { GroupContext, RootContext } from './context'
import type {
  MeasurementSnapshot,
  RegisteredAction,
  RegisteredActionEntry,
} from './context'

interface SideContainerRegistration {
  width: number
}

interface RootMotionAdapter {
  readOffset(): number
  writeOffset(offset: number): void
  cancel(): void
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
    const resolvedDirection =
      direction ?? (htmlDirection === 'rtl' ? 'rtl' : 'ltr')
    const group = useContext(GroupContext)
    const groupId = useId()
    const elementRef = useRef<HTMLDivElement>(null)
    const disabledRef = useRef(disabled)
    const openSideRef = useRef(controlledOpenSide ?? defaultOpenSide ?? null)
    const directionRef = useRef<SwipeActionsDirection>(resolvedDirection)
    const requestOpenSideRef = useRef<(side: SwipeActionsSide | null) => void>(
      () => undefined,
    )
    const contentRegistrationsRef = useRef(new Map<symbol, number>())
    const sideRegistrationsRef = useRef({
      leading: new Map<symbol, SideContainerRegistration>(),
      trailing: new Map<symbol, SideContainerRegistration>(),
    })
    const actionRegistrationsRef = useRef({
      leading: new Map<symbol, RegisteredActionEntry>(),
      trailing: new Map<symbol, RegisteredActionEntry>(),
    })
    const reconcileScheduledRef = useRef(false)
    const mountedRef = useRef(false)
    const motionRef = useRef<RootMotionAdapter | null>(null)
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

    disabledRef.current = disabled
    openSideRef.current = openSide
    directionRef.current = resolvedDirection
    requestOpenSideRef.current = requestOpenSide

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
        contentWidth: firstValue(contentRegistrationsRef.current) ?? 0,
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

        motion.cancel()
        const side = openSideRef.current
        if (side === null) {
          motion.writeOffset(0)
          return
        }

        if (sideRegistrationsRef.current[side].size === 0) {
          motion.writeOffset(0)
          requestOpenSideRef.current(null)
          return
        }

        const snapshot = measurements()
        const width = snapshot[side].width
        const sign = physicalSign(side, directionRef.current)
        motion.writeOffset(sign * width)
      })
    }, [measurements])

    const registerContent = useCallback(
      (id: symbol) => {
        contentRegistrationsRef.current.set(id, 0)
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
        contentRegistrationsRef.current.set(id, width)
        reconcileMeasurements()
      },
      [reconcileMeasurements],
    )

    const registerSide = useCallback(
      (side: SwipeActionsSide, id: symbol) => {
        if (sideRegistrationsRef.current[side].size > 0) {
          const componentName = side === 'leading' ? 'Leading' : 'Trailing'
          warnOnce(
            `duplicate-${side}-side`,
            `SwipeActions.Root received more than one SwipeActions.${componentName} container. Keep one SwipeActions.${componentName}; the first mounted container is used.`,
          )
        }
        sideRegistrationsRef.current[side].set(id, { width: 0 })
        reconcileMeasurements()

        return () => {
          sideRegistrationsRef.current[side].delete(id)
          reconcileMeasurements()
        }
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

    const updateSideWidth = useCallback(
      (side: SwipeActionsSide, id: symbol, width: number) => {
        const registration = sideRegistrationsRef.current[side].get(id)
        if (registration === undefined) {
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
        configurationChanged()

        return () => {
          actionRegistrationsRef.current[side].delete(id)
          configurationChanged()
        }
      },
      [configurationChanged],
    )

    const updateActionWidth = useCallback(
      (side: SwipeActionsSide, id: symbol, width: number) => {
        const entry = actionRegistrationsRef.current[side].get(id)
        if (entry === undefined) {
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
      return group?.register(groupId, () => requestOpenSide(null))
    }, [group, groupId, requestOpenSide])

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

    useLayoutEffect(() => {
      mountedRef.current = true
      reconcileMeasurements()

      return () => {
        mountedRef.current = false
        motionRef.current?.cancel()
      }
    }, [reconcileMeasurements])

    useLayoutEffect(() => {
      reconcileMeasurements()
    }, [openSide, reconcileMeasurements, resolvedDirection])

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

  return {
    readOffset: () => offset,
    writeOffset(nextOffset) {
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
    },
    cancel() {
      offset = Number.isFinite(offset) ? offset : 0
    },
  }
}
