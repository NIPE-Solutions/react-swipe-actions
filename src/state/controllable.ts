import { useCallback, useRef, useState } from 'react'
import type { SwipeActionsOpenSide } from '../public-types'

interface ControllableOpenSideOptions {
  value?: SwipeActionsOpenSide | undefined
  defaultValue?: SwipeActionsOpenSide | undefined
  onChange?: ((side: SwipeActionsOpenSide) => void) | undefined
}

export function useControllableOpenSide({
  value,
  defaultValue,
  onChange,
}: ControllableOpenSideOptions): [
  SwipeActionsOpenSide,
  (side: SwipeActionsOpenSide) => void,
] {
  const isControlled = value !== undefined
  const [uncontrolledValue, setUncontrolledValue] = useState(
    defaultValue ?? null,
  )
  const side = isControlled ? value : uncontrolledValue
  const sideRef = useRef<SwipeActionsOpenSide>(side)
  const controlledRef = useRef(isControlled)
  const onChangeRef = useRef(onChange)

  sideRef.current = side
  controlledRef.current = isControlled
  onChangeRef.current = onChange

  const requestSide = useCallback((nextSide: SwipeActionsOpenSide) => {
    if (sideRef.current === nextSide) {
      return
    }

    sideRef.current = nextSide

    if (!controlledRef.current) {
      setUncontrolledValue(nextSide)
    }

    onChangeRef.current?.(nextSide)
  }, [])

  return [side, requestSide]
}
