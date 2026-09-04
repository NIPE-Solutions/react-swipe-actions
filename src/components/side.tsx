import {
  forwardRef,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import type { SwipeActionsSide, SwipeActionsSideProps } from '../public-types'
import { setSubtreeInert } from '../utils/dom'
import { RootContext, SideContext } from './context'
import { useElementMeasurement, useForwardedElementRef } from './measurement'

function createSide(side: SwipeActionsSide) {
  return forwardRef<HTMLDivElement, SwipeActionsSideProps>(function Side(
    {
      'aria-hidden': consumerAriaHidden,
      inert: consumerInert,
      tabIndex: consumerTabIndex,
      ...props
    },
    forwardedRef,
  ) {
    const root = useContext(RootContext)
    const idRef = useRef(Symbol(`${side}-side`))
    const [elementRef, setElement] = useForwardedElementRef(forwardedRef)
    const registerSide = root?.registerSide
    const updateSideWidth = root?.updateSideWidth
    const context = useMemo(() => ({ side, containerId: idRef.current }), [])
    const active = root?.openSide === side
    const inactive = root !== null && !active
    const reportWidth = useCallback(
      (width: number) => updateSideWidth?.(side, idRef.current, width),
      [updateSideWidth],
    )

    useLayoutEffect(() => {
      const element = elementRef.current
      if (element !== null) {
        const unregister = registerSide?.(side, idRef.current, element)
        return () => {
          unregister?.()
          setSubtreeInert(element, false)
        }
      }
    }, [elementRef, registerSide])
    useLayoutEffect(() => {
      const element = elementRef.current
      if (element !== null) {
        setSubtreeInert(element, inactive, {
          ariaHidden:
            consumerAriaHidden === undefined
              ? null
              : String(consumerAriaHidden),
          inert: consumerInert ?? false,
        })
      }
    })
    useElementMeasurement(elementRef, reportWidth)

    return (
      <SideContext.Provider value={context}>
        <div
          {...props}
          ref={setElement}
          aria-hidden={inactive ? true : consumerAriaHidden}
          inert={inactive ? true : consumerInert}
          tabIndex={inactive ? -1 : consumerTabIndex}
          data-swipe-actions-side=""
          data-side={side}
          data-active={active ? '' : undefined}
        />
      </SideContext.Provider>
    )
  })
}

export const Leading = createSide('leading')
export const Trailing = createSide('trailing')
