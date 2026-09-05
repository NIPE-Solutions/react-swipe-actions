import { useEffect, useLayoutEffect, useState } from 'react'
import {
  Action,
  Content,
  Group,
  Leading,
  Root,
  Trailing,
} from '@nipe-solutions/react-swipe-actions'

import { siteLinks, siteMetadata } from './content'
import { ProjectMark } from './components/ProjectMark'

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
  const metrics = window.__swipePerformance__

  return (
    <main className="performance-fixture">
      <nav className="performance-fixture__nav" aria-label="Fixture navigation">
        <a href="./">
          <ProjectMark />
          <span>Back to documentation</span>
        </a>
      </nav>
      <header>
        <h1>{rows.toLocaleString('en-US')} swipe rows</h1>
        <p>
          Public-package performance fixture. Values are available on
          window.__swipePerformance__.
        </p>
      </header>
      <PerformanceMetricsPanel rows={rows} />
      <Group>
        <div className="performance-fixture__list">
          {Array.from({ length: rows }, (_, index) => (
            <PerformanceRow key={index} index={index} metrics={metrics} />
          ))}
        </div>
      </Group>
      <footer className="performance-fixture__footer">
        <span>React Swipe Actions · {siteMetadata.statusLabel}</span>
        <nav aria-label="Fixture footer">
          <a href="./">Documentation</a>
          <a href={siteLinks.github}>GitHub</a>
          <a href={siteLinks.nipeOpenSource}>NIPE Open Source</a>
        </nav>
      </footer>
    </main>
  )
}

function PerformanceMetricsPanel({ rows }: { rows: 100 | 1000 }) {
  const [snapshot, setSnapshot] = useState(() => ({
    ...window.__swipePerformance__,
  }))

  useEffect(() => {
    let secondFrame = 0
    const updateSnapshot = () => setSnapshot({ ...window.__swipePerformance__ })
    window.addEventListener('swipe-performance-update', updateSnapshot)
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        window.__swipePerformance__.mountMs =
          performance.now() - window.__swipePerformance__.mountStarted
        updateSnapshot()
      })
    })
    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
      window.removeEventListener('swipe-performance-update', updateSnapshot)
    }
  }, [])

  useEffect(() => {
    if (snapshot.mountMs <= 0) return
    document.body.setAttribute('data-performance-ready', '')
    return () => document.body.removeAttribute('data-performance-ready')
  }, [snapshot.mountMs])

  return (
    <dl className="performance-fixture__metrics">
      <div>
        <dt>Rows</dt>
        <dd data-testid="performance-row-count">{rows}</dd>
      </div>
      <div>
        <dt>Mount</dt>
        <dd data-testid="performance-mount-ms">
          {snapshot.mountMs.toFixed(1)} ms
        </dd>
      </div>
      <div>
        <dt>Resize observers</dt>
        <dd data-testid="performance-resize-observers">
          {snapshot.resizeObservers}
        </dd>
      </div>
      <div>
        <dt>Global pointer listeners</dt>
        <dd data-testid="performance-global-pointer-listeners">
          {snapshot.globalPointerListeners}
        </dd>
      </div>
      <div>
        <dt>Pending frames</dt>
        <dd data-testid="performance-pending-frames">
          {snapshot.pendingFrames}
        </dd>
      </div>
      <div>
        <dt>Row renders</dt>
        <dd data-testid="performance-row-renders">{snapshot.rowRenders}</dd>
      </div>
    </dl>
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
  useLayoutEffect(() => {
    metrics.rowRenders += 1
    window.dispatchEvent(new Event('swipe-performance-update'))
  })

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
