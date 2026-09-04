import { createRoot } from 'react-dom/client'

import { Action, Content, Leading, Root } from '../../src'
import '../../src/styles/core.css'
import './geometry.css'

type ObservedCallback = ResizeObserverCallback

class TrackingResizeObserver {
  readonly targets = new Set<Element>()
  readonly native: ResizeObserver

  constructor(readonly callback: ObservedCallback) {
    this.native = new NativeResizeObserver((entries) => callback(entries, this))
    trackedObservers.add(this)
  }

  observe(target: Element, options?: ResizeObserverOptions) {
    this.targets.add(target)
    this.native.observe(target, options)
  }

  unobserve(target: Element) {
    this.targets.delete(target)
    this.native.unobserve(target)
  }

  disconnect() {
    this.targets.clear()
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
      const entries = [...observer.targets].map(
        (target) =>
          ({
            target,
            contentRect: target.getBoundingClientRect(),
          }) as ResizeObserverEntry,
      )
      observer.callback(entries, observer as unknown as ResizeObserver)
    }
  },
})

createRoot(document.getElementById('root')!).render(
  <Root data-testid="root">
    <Leading data-testid="leading">
      <Action data-testid="leading-action" fullSwipe onAction={() => undefined}>
        Archive
      </Action>
    </Leading>
    <Content data-testid="content">Message</Content>
  </Root>,
)
