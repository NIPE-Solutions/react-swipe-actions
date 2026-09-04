import { useEffect, useState } from 'react'
import {
  Action,
  Content,
  Group,
  Leading,
  Root,
  Trailing,
} from '@nipe-solutions/react-swipe-actions'

interface PerformanceMetrics {
  mountStarted: number
  mountMs: number
  resizeObservers: number
  globalPointerListeners: number
  pendingFrames: number
  rowRenders: number
}

declare global {
  interface Window {
    __swipePerformance__: PerformanceMetrics
  }
}

export function installPerformanceInstrumentation() {
  const metrics: PerformanceMetrics = {
    mountStarted: performance.now(),
    mountMs: 0,
    resizeObservers: 0,
    globalPointerListeners: 0,
    pendingFrames: 0,
    rowRenders: 0,
  }
  window.__swipePerformance__ = metrics

  const NativeResizeObserver = window.ResizeObserver
  class CountingResizeObserver {
    private readonly native: ResizeObserver
    private connected = true

    constructor(callback: ResizeObserverCallback) {
      metrics.resizeObservers += 1
      this.native = new NativeResizeObserver(callback)
    }

    observe(target: Element, options?: ResizeObserverOptions) {
      this.native.observe(target, options)
    }

    unobserve(target: Element) {
      this.native.unobserve(target)
    }

    disconnect() {
      if (this.connected) {
        this.connected = false
        metrics.resizeObservers -= 1
      }
      this.native.disconnect()
    }
  }
  window.ResizeObserver =
    CountingResizeObserver as unknown as typeof ResizeObserver

  const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window)
  const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window)
  const pendingFrames = new Set<number>()
  window.requestAnimationFrame = (callback: FrameRequestCallback) => {
    const frame = nativeRequestAnimationFrame((time) => {
      pendingFrames.delete(frame)
      metrics.pendingFrames = pendingFrames.size
      callback(time)
    })
    pendingFrames.add(frame)
    metrics.pendingFrames = pendingFrames.size
    return frame
  }
  window.cancelAnimationFrame = (frame: number) => {
    pendingFrames.delete(frame)
    metrics.pendingFrames = pendingFrames.size
    nativeCancelAnimationFrame(frame)
  }

  const pointerTypes = new Set([
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointercancel',
  ])
  const nativeAddEventListener = window.addEventListener.bind(window)
  const nativeRemoveEventListener = window.removeEventListener.bind(window)
  window.addEventListener = ((
    ...args: Parameters<Window['addEventListener']>
  ) => {
    if (pointerTypes.has(args[0])) metrics.globalPointerListeners += 1
    return nativeAddEventListener(...args)
  }) as Window['addEventListener']
  window.removeEventListener = ((
    ...args: Parameters<Window['removeEventListener']>
  ) => {
    if (pointerTypes.has(args[0])) {
      metrics.globalPointerListeners = Math.max(
        0,
        metrics.globalPointerListeners - 1,
      )
    }
    return nativeRemoveEventListener(...args)
  }) as Window['removeEventListener']
}

export function PerformanceFixture({ rows }: { rows: 100 | 1000 }) {
  useEffect(() => {
    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        window.__swipePerformance__.mountMs =
          performance.now() - window.__swipePerformance__.mountStarted
        document.body.setAttribute('data-performance-ready', '')
      })
    })
    return () => {
      document.body.removeAttribute('data-performance-ready')
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
    }
  }, [])

  const metrics = window.__swipePerformance__

  return (
    <main className="performance-fixture">
      <header>
        <h1>{rows.toLocaleString('en-US')} swipe rows</h1>
        <p>
          Public-package performance fixture. Values are available on
          window.__swipePerformance__.
        </p>
      </header>
      <dl className="performance-fixture__metrics">
        <div>
          <dt>Rows</dt>
          <dd data-testid="performance-row-count">{rows}</dd>
        </div>
        <div>
          <dt>Mount</dt>
          <dd>{metrics.mountMs.toFixed(1)} ms</dd>
        </div>
        <div>
          <dt>Resize observers</dt>
          <dd>{metrics.resizeObservers}</dd>
        </div>
        <div>
          <dt>Global pointer listeners</dt>
          <dd>{metrics.globalPointerListeners}</dd>
        </div>
        <div>
          <dt>Pending frames</dt>
          <dd>{metrics.pendingFrames}</dd>
        </div>
        <div>
          <dt>Row renders</dt>
          <dd>{metrics.rowRenders}</dd>
        </div>
      </dl>
      <Group>
        <div className="performance-fixture__list">
          {Array.from({ length: rows }, (_, index) => (
            <PerformanceRow key={index} index={index} metrics={metrics} />
          ))}
        </div>
      </Group>
    </main>
  )
}

function PerformanceRow({
  index,
  metrics,
}: {
  index: number
  metrics: PerformanceMetrics
}) {
  const [openSide, setOpenSide] = useState<'leading' | 'trailing' | null>(null)
  metrics.rowRenders += 1

  return (
    <Root
      openSide={openSide}
      onOpenSideChange={setOpenSide}
      data-performance-row=""
      aria-label={`Performance row ${index + 1}`}
    >
      <Leading className="example-side example-side--archive">
        <Action onAction={() => undefined}>Archive</Action>
      </Leading>
      <Content className="example-row">
        Message {String(index + 1).padStart(4, '0')}
      </Content>
      <Trailing className="example-side example-side--danger">
        <Action destructive onAction={() => undefined}>
          Delete
        </Action>
      </Trailing>
    </Root>
  )
}
