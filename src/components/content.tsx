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
  function Content(props, forwardedRef) {
    const root = useContext(RootContext)
    const idRef = useRef(Symbol('content'))
    const [elementRef, setElement] = useForwardedElementRef(forwardedRef)
    const registerContent = root?.registerContent
    const updateContentWidth = root?.updateContentWidth
    const reportWidth = useCallback(
      (width: number) => updateContentWidth?.(idRef.current, width),
      [updateContentWidth],
    )

    useLayoutEffect(() => registerContent?.(idRef.current), [registerContent])
    useElementMeasurement(elementRef, reportWidth)

    return <div {...props} ref={setElement} data-swipe-actions-content="" />
  },
)
