import {
  forwardRef,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
} from 'react'
import type { SwipeActionsContentProps } from '../public-types'
import { RootContext } from './context'
import { useElementMeasurement, useForwardedElementRef } from './measurement'

export const Content = forwardRef<HTMLDivElement, SwipeActionsContentProps>(
  function Content(
    {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture,
      ...props
    },
    forwardedRef,
  ) {
    const root = useContext(RootContext)
    const idRef = useRef(Symbol('content'))
    const [elementRef, setElement] = useForwardedElementRef(forwardedRef)
    const registerContent = root?.registerContent
    const updateContentWidth = root?.updateContentWidth
    const reportWidth = useCallback(
      (width: number) => updateContentWidth?.(idRef.current, width),
      [updateContentWidth],
    )

    useLayoutEffect(() => {
      const element = elementRef.current
      if (element !== null) {
        return registerContent?.(idRef.current, element)
      }
    }, [elementRef, registerContent])
    useElementMeasurement(elementRef, reportWidth)

    return (
      <div
        {...props}
        ref={setElement}
        onPointerDown={(event) => {
          onPointerDown?.(event)
          if (!event.defaultPrevented) root?.gesture.onPointerDown(event)
        }}
        onPointerMove={(event) => {
          onPointerMove?.(event)
          if (!event.defaultPrevented) root?.gesture.onPointerMove(event)
        }}
        onPointerUp={(event) => {
          onPointerUp?.(event)
          if (!event.defaultPrevented) root?.gesture.onPointerUp(event)
        }}
        onPointerCancel={(event) => {
          onPointerCancel?.(event)
          root?.gesture.onPointerCancel(event)
        }}
        onLostPointerCapture={(event) => {
          onLostPointerCapture?.(event)
          root?.gesture.onLostPointerCapture(event)
        }}
        data-swipe-actions-content=""
      />
    )
  },
)
