import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

interface MockResizeObserverInstance {
  callback: ResizeObserverCallback
  targets: Set<Element>
  disconnected: boolean
}

const resizeObserverInstances = new Set<MockResizeObserverInstance>()
let disconnects = 0

class MockResizeObserver implements ResizeObserver {
  private readonly instance: MockResizeObserverInstance

  constructor(callback: ResizeObserverCallback) {
    this.instance = {
      callback,
      targets: new Set(),
      disconnected: false,
    }
    resizeObserverInstances.add(this.instance)
  }

  observe(target: Element) {
    this.instance.targets.add(target)
  }

  unobserve(target: Element) {
    this.instance.targets.delete(target)
  }

  disconnect() {
    if (!this.instance.disconnected) {
      disconnects += 1
      this.instance.disconnected = true
    }
    this.instance.targets.clear()
  }
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  writable: true,
  value: MockResizeObserver,
})

export const resizeObserverMock = {
  emit(target: Element, width: number, height = 0) {
    const contentRect = DOMRect.fromRect({ width, height })

    for (const instance of resizeObserverInstances) {
      if (!instance.targets.has(target)) {
        continue
      }

      instance.callback(
        [
          {
            target,
            contentRect,
          } as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      )
    }
  },
  activeTargets() {
    let count = 0
    for (const instance of resizeObserverInstances) {
      count += instance.targets.size
    }
    return count
  },
  disconnects() {
    return disconnects
  },
  reset() {
    resizeObserverInstances.clear()
    disconnects = 0
  },
}

afterEach(() => {
  cleanup()
  resizeObserverMock.reset()
})
