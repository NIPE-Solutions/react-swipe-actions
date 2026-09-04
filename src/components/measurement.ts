import { useCallback, useLayoutEffect, useRef } from 'react'
import type { ForwardedRef, MutableRefObject } from 'react'

export function useForwardedElementRef<T extends HTMLElement>(
  forwardedRef: ForwardedRef<T>,
): [MutableRefObject<T | null>, (element: T | null) => void] {
  const elementRef = useRef<T | null>(null)

  const setElement = useCallback(
    (element: T | null) => {
      elementRef.current = element

      if (typeof forwardedRef === 'function') {
        forwardedRef(element)
      } else if (forwardedRef !== null) {
        forwardedRef.current = element
      }
    },
    [forwardedRef],
  )

  return [elementRef, setElement]
}

export function useElementMeasurement<T extends HTMLElement>(
  elementRef: MutableRefObject<T | null>,
  onWidth: (width: number) => void,
) {
  useLayoutEffect(() => {
    const element = elementRef.current

    if (element === null || typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target !== element) {
          continue
        }

        const width = entry.contentRect.width
        if (Number.isFinite(width) && width >= 0) {
          onWidth(width)
        }
      }
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [elementRef, onWidth])
}
