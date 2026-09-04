import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

export interface GestureSnapshot {
  offset: number
  progress: number
  velocity: number
  owner: 'none' | 'pending' | 'scroll' | 'swipe'
  openState: string
}

const idleSnapshot: GestureSnapshot = {
  offset: 0,
  progress: 0,
  velocity: 0,
  owner: 'none',
  openState: 'closed',
}

export function useGestureDiagnostics(hostRef: RefObject<HTMLElement | null>) {
  const [snapshot, setSnapshot] = useState(idleSnapshot)

  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    const root = host.querySelector<HTMLElement>('[data-swipe-actions-root]')
    if (root === null) return

    let pointerId: number | null = null
    let startX = 0
    let startY = 0
    let previousX = 0
    let previousTime = 0
    let velocity = 0
    let owner: GestureSnapshot['owner'] = 'none'

    const read = () => {
      const style = getComputedStyle(root)
      setSnapshot({
        offset: readNumber(style.getPropertyValue('--swipe-actions-offset')),
        progress: readNumber(
          style.getPropertyValue('--swipe-actions-progress'),
        ),
        velocity,
        owner,
        openState: root.dataset.state ?? 'closed',
      })
    }

    const onPointerDown = (event: PointerEvent) => {
      pointerId = event.pointerId
      startX = event.clientX
      startY = event.clientY
      previousX = event.clientX
      previousTime = event.timeStamp
      velocity = 0
      owner = 'pending'
      read()
    }
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      const elapsed = event.timeStamp - previousTime
      if (elapsed > 0) velocity = (event.clientX - previousX) / elapsed
      const deltaX = Math.abs(event.clientX - startX)
      const deltaY = Math.abs(event.clientY - startY)
      if (Math.max(deltaX, deltaY) > 6)
        owner = deltaX > deltaY ? 'swipe' : 'scroll'
      previousX = event.clientX
      previousTime = event.timeStamp
      read()
    }
    const onPointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      pointerId = null
      read()
    }

    const observer = new MutationObserver(read)
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['style', 'data-state'],
    })
    host.addEventListener('pointerdown', onPointerDown, true)
    host.addEventListener('pointermove', onPointerMove, true)
    host.addEventListener('pointerup', onPointerEnd, true)
    host.addEventListener('pointercancel', onPointerEnd, true)
    read()

    return () => {
      observer.disconnect()
      host.removeEventListener('pointerdown', onPointerDown, true)
      host.removeEventListener('pointermove', onPointerMove, true)
      host.removeEventListener('pointerup', onPointerEnd, true)
      host.removeEventListener('pointercancel', onPointerEnd, true)
    }
  }, [hostRef])

  return snapshot
}

function readNumber(value: string) {
  const number = Number.parseFloat(value)
  return Number.isFinite(number) ? number : 0
}
