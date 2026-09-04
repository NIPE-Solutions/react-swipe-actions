import {
  forwardRef,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { CSSProperties } from 'react'
import type { SwipeActionsActionProps } from '../public-types'
import { warnOnce } from '../utils/warn'
import { RootContext, SideContext } from './context'
import { useElementMeasurement, useForwardedElementRef } from './measurement'

type SwipeActionStyle = CSSProperties & {
  '--swipe-actions-action-width'?: string | undefined
}

export const Action = forwardRef<HTMLButtonElement, SwipeActionsActionProps>(
  function Action(
    {
      onAction,
      destructive = false,
      fullSwipe = false,
      disabled = false,
      style,
      ...buttonProps
    },
    forwardedRef,
  ) {
    const root = useContext(RootContext)
    const sideContext = useContext(SideContext)
    const side = sideContext?.side
    const idRef = useRef(Symbol('action'))
    const invokeRef = useRef(onAction)
    const actionRef = useRef({
      element: null as HTMLButtonElement | null,
      width: 0,
      fullSwipe,
      disabled,
      invoke: () => invokeRef.current(),
    })
    const [measuredWidth, setMeasuredWidth] = useState<number | null>(null)
    const [elementRef, setElement] = useForwardedElementRef(forwardedRef)
    const registerAction = root?.registerAction
    const updateActionWidth = root?.updateActionWidth
    const configurationChanged = root?.configurationChanged
    const inactive =
      root !== null && side !== undefined && root.openSide !== side

    invokeRef.current = onAction
    actionRef.current.fullSwipe = fullSwipe
    actionRef.current.disabled = disabled
    actionRef.current.element = elementRef.current

    const reportWidth = useCallback(
      (width: number) => {
        if (side === undefined) {
          return
        }
        setMeasuredWidth(width)
        updateActionWidth?.(side, idRef.current, width)
      },
      [side, updateActionWidth],
    )

    useLayoutEffect(() => {
      const element = elementRef.current
      if (
        side === undefined ||
        sideContext === null ||
        registerAction === undefined ||
        element === null
      ) {
        return
      }

      actionRef.current.element = element
      return registerAction(
        side,
        sideContext.containerId,
        idRef.current,
        actionRef.current,
      )
    }, [registerAction, side, sideContext])

    useLayoutEffect(() => {
      configurationChanged?.()
    }, [configurationChanged, disabled, fullSwipe])

    useElementMeasurement(elementRef, reportWidth)

    useLayoutEffect(() => {
      if (root === null && sideContext === null) {
        warnOnce(
          'action-outside-root-and-side',
          'SwipeActions.Action must be rendered inside SwipeActions.Root and SwipeActions.Leading or SwipeActions.Trailing. Move the action into one logical side inside a root.',
        )
      } else if (root === null) {
        warnOnce(
          'action-outside-root',
          'SwipeActions.Action must be rendered inside SwipeActions.Root. Move its SwipeActions.Leading or SwipeActions.Trailing parent into a root.',
        )
      } else if (sideContext === null) {
        warnOnce(
          'action-outside-side',
          'SwipeActions.Action must be rendered inside SwipeActions.Leading or SwipeActions.Trailing. Move the action into one logical side.',
        )
      }
    }, [root, sideContext])

    const actionStyle: SwipeActionStyle = {
      ...style,
      '--swipe-actions-action-width':
        measuredWidth === null ? undefined : `${measuredWidth}px`,
    }

    return (
      <button
        {...buttonProps}
        ref={setElement}
        type="button"
        disabled={disabled}
        onClick={() => invokeRef.current()}
        style={actionStyle}
        data-swipe-actions-action=""
        data-side={side}
        data-full-swipe={fullSwipe ? '' : undefined}
        data-destructive={destructive ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        tabIndex={inactive ? -1 : buttonProps.tabIndex}
      />
    )
  },
)
