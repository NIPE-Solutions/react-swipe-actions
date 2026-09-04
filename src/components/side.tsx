import {
  forwardRef,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import type { SwipeActionsSide, SwipeActionsSideProps } from '../public-types'
import { RootContext, SideContext } from './context'
import { useElementMeasurement, useForwardedElementRef } from './measurement'

function createSide(side: SwipeActionsSide) {
  return forwardRef<HTMLDivElement, SwipeActionsSideProps>(
    function Side(props, forwardedRef) {
      const root = useContext(RootContext)
      const idRef = useRef(Symbol(`${side}-side`))
      const [elementRef, setElement] = useForwardedElementRef(forwardedRef)
      const registerSide = root?.registerSide
      const updateSideWidth = root?.updateSideWidth
      const context = useMemo(() => ({ side, containerId: idRef.current }), [])
      const active = root?.openSide === side
      const reportWidth = useCallback(
        (width: number) => updateSideWidth?.(side, idRef.current, width),
        [updateSideWidth],
      )

      useLayoutEffect(() => registerSide?.(side, idRef.current), [registerSide])
      useElementMeasurement(elementRef, reportWidth)

      return (
        <SideContext.Provider value={context}>
          <div
            {...props}
            ref={setElement}
            data-swipe-actions-side=""
            data-side={side}
            data-active={active ? '' : undefined}
          />
        </SideContext.Provider>
      )
    },
  )
}

export const Leading = createSide('leading')
export const Trailing = createSide('trailing')
