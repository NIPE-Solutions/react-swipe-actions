import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

export interface GestureSnapshot {
  activeRoot: string
  offset: number
  progress: number
  velocity: number
  owner: 'none' | 'pending' | 'scroll' | 'swipe'
  openState: string
}

const idleSnapshot: GestureSnapshot = {
  activeRoot: 'Row 1',
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
    const initialRoot = host.querySelector<HTMLElement>(
      '[data-swipe-actions-root]',
    )
    if (initialRoot === null) return
    let activeRoot: HTMLElement = initialRoot

    let pointerId: number | null = null
    let startX = 0
    let startY = 0
    let previousX = 0
    let previousTime = 0
    let velocity = 0
    let owner: GestureSnapshot['owner'] = 'none'

    const rootForTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return null
      const root = target.closest<HTMLElement>('[data-swipe-actions-root]')
      return root !== null && host.contains(root) ? root : null
    }

    const read = () => {
      const style = getComputedStyle(activeRoot)
      setSnapshot({
        activeRoot:
          activeRoot.getAttribute('data-diagnostic-label') ?? 'Swipe row',
        offset: readNumber(style.getPropertyValue('--swipe-actions-offset')),
        progress: readNumber(
          style.getPropertyValue('--swipe-actions-progress'),
        ),
        velocity,
        owner,
        openState: activeRoot.dataset.state ?? 'closed',
      })
    }

    const selectRoot = (root: HTMLElement) => {
      if (root !== activeRoot) {
        activeRoot = root
        velocity = 0
        owner = 'none'
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      const root = rootForTarget(event.target)
      if (root === null) return
      selectRoot(root)
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

    const onFocusIn = (event: FocusEvent) => {
      const root = rootForTarget(event.target)
      if (root === null) return
      selectRoot(root)
      read()
    }

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const root = rootForTarget(record.target)
        if (root === null) continue
        if (root === activeRoot || root.dataset.state !== 'closed') {
          selectRoot(root)
        }
      }
      read()
    })
    observer.observe(host, {
      attributes: true,
      subtree: true,
      attributeFilter: ['style', 'data-state', 'data-revealing-side'],
    })
    host.addEventListener('pointerdown', onPointerDown, true)
    host.addEventListener('pointermove', onPointerMove, true)
    host.addEventListener('pointerup', onPointerEnd, true)
    host.addEventListener('pointercancel', onPointerEnd, true)
    host.addEventListener('focusin', onFocusIn, true)
    read()

    return () => {
      observer.disconnect()
      host.removeEventListener('pointerdown', onPointerDown, true)
      host.removeEventListener('pointermove', onPointerMove, true)
      host.removeEventListener('pointerup', onPointerEnd, true)
      host.removeEventListener('pointercancel', onPointerEnd, true)
      host.removeEventListener('focusin', onFocusIn, true)
    }
  }, [hostRef])

  return snapshot
}

function readNumber(value: string) {
  const number = Number.parseFloat(value)
  return Number.isFinite(number) ? number : 0
}
