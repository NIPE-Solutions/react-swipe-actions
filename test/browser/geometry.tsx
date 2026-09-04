import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { Action, Content, Leading, Root } from '../../src'
import '../../src/styles/core.css'
import './geometry.css'

type ObservedCallback = ResizeObserverCallback

class TrackingResizeObserver {
  readonly targets = new Set<Element>()
  readonly contentRects = new Map<Element, DOMRectReadOnly>()
  readonly native: ResizeObserver

  constructor(readonly callback: ObservedCallback) {
    this.native = new NativeResizeObserver((entries) => {
      for (const entry of entries) {
        this.contentRects.set(entry.target, entry.contentRect)
      }
      callback(entries, this)
    })
    trackedObservers.add(this)
  }

  observe(target: Element, options?: ResizeObserverOptions) {
    this.targets.add(target)
    this.native.observe(target, options)
  }

  unobserve(target: Element) {
    this.targets.delete(target)
    this.contentRects.delete(target)
    this.native.unobserve(target)
  }

  disconnect() {
    this.targets.clear()
    this.contentRects.clear()
    this.native.disconnect()
    trackedObservers.delete(this)
  }
}

const NativeResizeObserver = window.ResizeObserver
const trackedObservers = new Set<TrackingResizeObserver>()

window.ResizeObserver =
  TrackingResizeObserver as unknown as typeof ResizeObserver

Object.assign(window, {
  deliverObservedBoxes() {
    for (const observer of trackedObservers) {
      const entries = [...observer.targets].flatMap((target) => {
        const contentRect = observer.contentRects.get(target)
        return contentRect === undefined
          ? []
          : ([{ target, contentRect }] as ResizeObserverEntry[])
      })
      observer.callback(entries, observer as unknown as ResizeObserver)
    }
  },
})

function GeometryFixture() {
  const [wideAction, setWideAction] = useState(false)

  useEffect(() => {
    Object.assign(window, {
      widenLeadingAction() {
        setWideAction(true)
      },
    })
  }, [])

  return (
    <Root data-testid="root">
      <Leading data-testid="leading">
        <Action
          data-testid="leading-action"
          fullSwipe
          onAction={() => undefined}
          style={wideAction ? { inlineSize: '120px' } : undefined}
        >
          Archive
        </Action>
      </Leading>
      <Content data-testid="content">Message</Content>
    </Root>
  )
}

createRoot(document.getElementById('root')!).render(<GeometryFixture />)
