import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'

import { Action, Content, Group, Leading, Root, Trailing } from '../../src'
import type {
  SwipeActionsDirection,
  SwipeActionsOpenSide,
  SwipeActionsRootProps,
} from '../../src'
import '../../src/styles/core.css'
import './styles.css'

declare global {
  interface Window {
    deliverObservedBoxes(): void
  }
}

const search = new URLSearchParams(window.location.search)
const scenario = search.get('scenario') ?? 'inbox'
const rtlMode = search.get('mode') ?? 'document'
const fixtureStartedAt = performance.now()

const performanceMetrics = {
  observers: 0,
  globalPointerListeners: 0,
  pendingFrames: 0,
}

if (scenario === 'performance') {
  const NativeResizeObserver = window.ResizeObserver
  class CountingResizeObserver {
    private readonly native: ResizeObserver
    private connected = true

    constructor(callback: ResizeObserverCallback) {
      performanceMetrics.observers += 1
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
        performanceMetrics.observers -= 1
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
      performanceMetrics.pendingFrames = pendingFrames.size
      callback(time)
    })
    pendingFrames.add(frame)
    performanceMetrics.pendingFrames = pendingFrames.size
    return frame
  }
  window.cancelAnimationFrame = (frame: number) => {
    pendingFrames.delete(frame)
    performanceMetrics.pendingFrames = pendingFrames.size
    nativeCancelAnimationFrame(frame)
  }

  const nativeAddEventListener = window.addEventListener.bind(window)
  const nativeRemoveEventListener = window.removeEventListener.bind(window)
  const pointerListenerTypes = new Set([
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointercancel',
  ])
  window.addEventListener = ((
    ...args: Parameters<Window['addEventListener']>
  ) => {
    if (pointerListenerTypes.has(args[0])) {
      performanceMetrics.globalPointerListeners += 1
    }
    return nativeAddEventListener(...args)
  }) as Window['addEventListener']
  window.removeEventListener = ((
    ...args: Parameters<Window['removeEventListener']>
  ) => {
    if (pointerListenerTypes.has(args[0])) {
      performanceMetrics.globalPointerListeners = Math.max(
        0,
        performanceMetrics.globalPointerListeners - 1,
      )
    }
    return nativeRemoveEventListener(...args)
  }) as Window['removeEventListener']
}

document.documentElement.dir =
  scenario === 'rtl' && rtlMode === 'document' ? 'rtl' : 'ltr'

if (scenario === 'geometry') {
  type ObservedCallback = ResizeObserverCallback
  const NativeResizeObserver = window.ResizeObserver
  const trackedObservers = new Set<TrackingResizeObserver>()

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

  window.ResizeObserver =
    TrackingResizeObserver as unknown as typeof ResizeObserver
  window.deliverObservedBoxes = () => {
    for (const observer of trackedObservers) {
      const entries = [...observer.targets].flatMap((target) => {
        const contentRect = observer.contentRects.get(target)
        return contentRect === undefined
          ? []
          : ([{ target, contentRect }] as ResizeObserverEntry[])
      })
      observer.callback(entries, observer as unknown as ResizeObserver)
    }
  }
}

function Counter({ id, value }: { id: string; value: number }) {
  return <output data-testid={id}>{value}</output>
}

function FixtureHeader({ title }: { title: string }) {
  return (
    <header className="fixture-header">
      <p className="eyebrow">Browser interaction fixture</p>
      <h1>{title}</h1>
    </header>
  )
}

interface TestRowProps {
  id: string
  title: string
  leadingWidths?: number[]
  trailingWidths?: number[]
  fullSwipeTrailing?: boolean
  direction?: SwipeActionsDirection
  defaultOpenSide?: SwipeActionsOpenSide
  rootProps?: Omit<SwipeActionsRootProps, 'children'>
  children?: ReactNode
  onContentClick?: () => void
  onContentPointerDown?: (pointerType: string, isTrusted: boolean) => void
  onLeadingAction?: () => void
  onTrailingAction?: () => void
}

function TestRow({
  id,
  title,
  leadingWidths = [88],
  trailingWidths = [88],
  fullSwipeTrailing = false,
  direction,
  defaultOpenSide,
  rootProps,
  children,
  onContentClick,
  onContentPointerDown,
  onLeadingAction,
  onTrailingAction,
}: TestRowProps) {
  return (
    <Root
      aria-label={`${title} actions`}
      data-testid={id}
      direction={direction}
      defaultOpenSide={defaultOpenSide}
      {...rootProps}
    >
      {leadingWidths.length > 0 ? (
        <Leading data-testid={`${id}-leading`}>
          {leadingWidths.map((width, index) => (
            <Action
              key={`${id}-leading-${index}`}
              data-testid={`${id}-leading-${index}`}
              onAction={onLeadingAction ?? (() => undefined)}
              style={{ inlineSize: width }}
            >
              {index === 0 ? 'Archive' : 'Pin'}
            </Action>
          ))}
        </Leading>
      ) : null}
      <Content
        data-testid={`${id}-content`}
        className="row-content"
        onClick={onContentClick}
        onPointerDown={(event) =>
          onContentPointerDown?.(event.pointerType, event.nativeEvent.isTrusted)
        }
      >
        <span className="avatar" aria-hidden="true">
          {title.slice(0, 1)}
        </span>
        <span className="row-copy">
          <strong>{title}</strong>
          <span data-testid={`${id}-drag-surface`} className="drag-surface">
            Swipe this message
          </span>
        </span>
        {children}
      </Content>
      {trailingWidths.length > 0 ? (
        <Trailing data-testid={`${id}-trailing`}>
          {trailingWidths.map((width, index) => {
            const isLast = index === trailingWidths.length - 1
            return (
              <Action
                key={`${id}-trailing-${index}`}
                data-testid={`${id}-trailing-${index}`}
                destructive={isLast}
                fullSwipe={fullSwipeTrailing && isLast}
                onAction={onTrailingAction ?? (() => undefined)}
                style={{ inlineSize: width }}
              >
                {isLast ? 'Delete' : 'More'}
              </Action>
            )
          })}
        </Trailing>
      ) : null}
    </Root>
  )
}

function InboxFixture() {
  const [archiveCount, setArchiveCount] = useState(0)
  const [deleteCount, setDeleteCount] = useState(0)
  const [childCount, setChildCount] = useState(0)
  const [contentCount, setContentCount] = useState(0)
  const [lastPointer, setLastPointer] = useState({
    type: 'none',
    trusted: false,
  })

  return (
    <main className="fixture fixture--inbox">
      <FixtureHeader title="Inbox" />
      <section className="status-panel" aria-label="Interaction counters">
        <span>
          Archive <Counter id="archive-count" value={archiveCount} />
        </span>
        <span>
          Delete <Counter id="delete-count" value={deleteCount} />
        </span>
        <span>
          Children <Counter id="child-count" value={childCount} />
        </span>
        <span>
          Content <Counter id="content-count" value={contentCount} />
        </span>
        <span>
          Pointer{' '}
          <output data-testid="last-pointer-type">{lastPointer.type}</output>
        </span>
        <span>
          Trusted{' '}
          <output data-testid="last-pointer-trusted">
            {String(lastPointer.trusted)}
          </output>
        </span>
      </section>
      <Group>
        <div className="row-stack">
          <TestRow
            id="row-1"
            title="Ada Lovelace"
            leadingWidths={[64, 96]}
            trailingWidths={[64, 96]}
            fullSwipeTrailing
            onContentClick={() => setContentCount((count) => count + 1)}
            onContentPointerDown={(type, trusted) =>
              setLastPointer({ type, trusted })
            }
            onLeadingAction={() => setArchiveCount((count) => count + 1)}
            onTrailingAction={() => setDeleteCount((count) => count + 1)}
          >
            <div className="row-controls">
              <button
                data-testid="row-button"
                type="button"
                onClick={() => setChildCount((count) => count + 1)}
              >
                Reply
              </button>
              <a
                data-testid="row-link"
                href="#message"
                onClick={(event) => {
                  event.preventDefault()
                  setChildCount((count) => count + 1)
                }}
              >
                Open
              </a>
              <label>
                <input
                  data-testid="row-checkbox"
                  type="checkbox"
                  onChange={() => setChildCount((count) => count + 1)}
                />
                Select
              </label>
            </div>
          </TestRow>
          <TestRow
            id="row-2"
            title="Grace Hopper"
            leadingWidths={[96]}
            trailingWidths={[144]}
          />
        </div>
      </Group>
      <div className="row-stack secondary-list">
        <TestRow
          id="no-action-row"
          title="Read-only announcement"
          leadingWidths={[]}
          trailingWidths={[]}
        />
      </div>
    </main>
  )
}

function OverflowFixture() {
  return (
    <main className="fixture">
      <FixtureHeader title="Overflow scroll" />
      <div className="overflow-scroll" data-testid="overflow-scroll">
        {Array.from({ length: 12 }, (_, index) => (
          <TestRow
            key={index}
            id={`overflow-row-${index}`}
            title={`Scrollable message ${index + 1}`}
            leadingWidths={[84]}
            trailingWidths={[84]}
          />
        ))}
      </div>
    </main>
  )
}

function BodyScrollFixture() {
  return (
    <main className="fixture">
      <FixtureHeader title="Body scroll" />
      <div className="row-stack">
        {Array.from({ length: 16 }, (_, index) => (
          <TestRow
            key={index}
            id={`body-row-${index}`}
            title={`Page message ${index + 1}`}
            leadingWidths={[84]}
            trailingWidths={[84]}
          />
        ))}
      </div>
    </main>
  )
}

function ContainmentFixture() {
  return (
    <main className="fixture containment">
      <FixtureHeader title="Nested surfaces" />
      <dialog className="dialog-shell" open aria-label="Message dialog">
        <h2>Dialog</h2>
        <TestRow
          id="dialog-row"
          title="Inside dialog"
          leadingWidths={[88]}
          trailingWidths={[88]}
        />
      </dialog>
      <section
        className="sheet-shell"
        role="dialog"
        aria-modal="false"
        aria-labelledby="sheet-title"
      >
        <div className="sheet-handle" aria-hidden="true" />
        <h2 id="sheet-title">Bottom sheet compatible</h2>
        <TestRow
          id="sheet-row"
          title="Inside bottom sheet"
          leadingWidths={[88]}
          trailingWidths={[88]}
        />
      </section>
    </main>
  )
}

function LifecycleFixture() {
  const [mounted, setMounted] = useState(true)
  const [leadingMounted, setLeadingMounted] = useState(true)
  const [leadingWidth, setLeadingWidth] = useState(88)
  const [controlledSide, setControlledSide] =
    useState<SwipeActionsOpenSide>(null)
  const [actionCount, setActionCount] = useState(0)
  const [lifecycleChangeCount, setLifecycleChangeCount] = useState(0)
  const recordLifecycleChange = () =>
    setLifecycleChangeCount((count) => count + 1)

  return (
    <main className="fixture">
      <FixtureHeader title="Lifecycle controls" />
      <section className="fixture-controls" aria-label="Lifecycle controls">
        <button
          data-testid="resize-action"
          type="button"
          onClick={() => {
            setLeadingWidth(132)
            recordLifecycleChange()
          }}
        >
          Resize action
        </button>
        <button
          data-testid="remove-leading"
          type="button"
          onClick={() => {
            setLeadingMounted(false)
            recordLifecycleChange()
          }}
        >
          Remove leading side
        </button>
        <button
          data-testid="unmount-row"
          type="button"
          onClick={() => {
            setMounted(false)
            recordLifecycleChange()
          }}
        >
          Unmount row
        </button>
        <button
          data-testid="set-controlled-leading"
          type="button"
          onClick={() => {
            setControlledSide('leading')
            recordLifecycleChange()
          }}
        >
          Control leading
        </button>
        <button
          data-testid="set-controlled-trailing"
          type="button"
          onClick={() => {
            setControlledSide('trailing')
            recordLifecycleChange()
          }}
        >
          Control trailing
        </button>
        <button
          data-testid="set-controlled-closed"
          type="button"
          onClick={() => {
            setControlledSide(null)
            recordLifecycleChange()
          }}
        >
          Control closed
        </button>
      </section>
      <section className="status-panel" aria-label="Lifecycle status">
        <span>
          Actions <Counter id="lifecycle-action-count" value={actionCount} />
        </span>
        <span>
          Controlled{' '}
          <output data-testid="controlled-state">
            {controlledSide ?? 'closed'}
          </output>
        </span>
        <span>
          Lifecycle changes{' '}
          <Counter id="lifecycle-change-count" value={lifecycleChangeCount} />
        </span>
      </section>
      <div className="row-stack">
        {mounted ? (
          <TestRow
            id="lifecycle-row"
            title="Interruptible message"
            leadingWidths={leadingMounted ? [leadingWidth] : []}
            trailingWidths={[88]}
            onLeadingAction={() => setActionCount((count) => count + 1)}
            onTrailingAction={() => setActionCount((count) => count + 1)}
          />
        ) : (
          <p className="unmounted-message">Row unmounted</p>
        )}
        <TestRow
          id="controlled-row"
          title="Controlled message"
          leadingWidths={[88]}
          trailingWidths={[88]}
          rootProps={{
            openSide: controlledSide,
            onOpenSideChange: setControlledSide,
          }}
        />
      </div>
    </main>
  )
}

function RtlFixture() {
  const [runtimeDirection, setRuntimeDirection] =
    useState<SwipeActionsDirection>('ltr')
  const requestedOpenSide = search.get('open')
  const defaultOpenSide =
    requestedOpenSide === 'leading' || requestedOpenSide === 'trailing'
      ? requestedOpenSide
      : undefined
  const ancestorDirection =
    rtlMode === 'nested' || rtlMode === 'explicit'
      ? 'rtl'
      : rtlMode === 'runtime'
        ? runtimeDirection
        : undefined
  const explicitDirection = rtlMode === 'explicit' ? 'ltr' : undefined
  const visibleDirection =
    explicitDirection ??
    ancestorDirection ??
    (document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr')

  return (
    <main className="fixture">
      <FixtureHeader title="Bidirectional layout" />
      {rtlMode === 'runtime' ? (
        <div className="fixture-controls">
          <button
            data-testid="toggle-direction"
            type="button"
            onClick={() =>
              setRuntimeDirection((direction) =>
                direction === 'ltr' ? 'rtl' : 'ltr',
              )
            }
          >
            Toggle direction
          </button>
        </div>
      ) : null}
      <section className="status-panel" aria-label="Direction status">
        <span>
          Direction{' '}
          <output data-testid="direction-state">{visibleDirection}</output>
        </span>
        <span>Mode {rtlMode}</span>
      </section>
      <div data-testid="direction-ancestor" dir={ancestorDirection}>
        <TestRow
          id="rtl-root"
          title="Logical sides"
          leadingWidths={[88]}
          trailingWidths={[88]}
          direction={explicitDirection}
          defaultOpenSide={defaultOpenSide}
        />
      </div>
    </main>
  )
}

function AccessibilityFixture() {
  const state = search.get('state') ?? 'closed'
  const openSide =
    state === 'leading' || state === 'trailing' ? state : undefined
  const row = (
    <TestRow
      id="accessibility-row"
      title="Accessible message"
      leadingWidths={[88]}
      trailingWidths={[88]}
      defaultOpenSide={openSide}
      rootProps={{ disabled: state === 'disabled' }}
    >
      <div className="row-controls">
        <button data-testid="open-message" type="button">
          Open message
        </button>
        <a data-testid="message-link" href="#message">
          Details
        </a>
      </div>
    </TestRow>
  )

  return (
    <main className="fixture">
      <FixtureHeader title="Accessibility states" />
      {state === 'group' ? (
        <Group>
          <div className="row-stack">
            {row}
            <TestRow
              id="accessibility-group-row"
              title="Grouped message"
              leadingWidths={[88]}
              trailingWidths={[88]}
            />
          </div>
        </Group>
      ) : (
        row
      )}
      <button data-testid="after-fixture" type="button">
        After fixture
      </button>
    </main>
  )
}

function PerformanceMetrics() {
  const [snapshot, setSnapshot] = useState({
    observers: -1,
    globalPointerListeners: -1,
    pendingFrames: -1,
    mountMs: '',
  })

  useEffect(() => {
    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        setSnapshot({
          observers: performanceMetrics.observers,
          globalPointerListeners: performanceMetrics.globalPointerListeners,
          pendingFrames: performanceMetrics.pendingFrames,
          mountMs: (performance.now() - fixtureStartedAt).toFixed(1),
        })
      })
    })
    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
    }
  }, [])

  return (
    <section
      className="status-panel performance-status"
      aria-label="Performance metrics"
    >
      <span>
        Rows{' '}
        <output data-testid="performance-row-count">
          {search.get('rows')}
        </output>
      </span>
      <span>
        Observers{' '}
        <output data-testid="observer-count">{snapshot.observers}</output>
      </span>
      <span>
        Global pointer listeners{' '}
        <output data-testid="global-pointer-listener-count">
          {snapshot.globalPointerListeners}
        </output>
      </span>
      <span>
        Pending frames{' '}
        <output data-testid="pending-frame-count">
          {snapshot.pendingFrames}
        </output>
      </span>
      <span>
        Mount ms <output data-testid="mount-ms">{snapshot.mountMs}</output>
      </span>
    </section>
  )
}

function PerformanceFixture() {
  const rowCount = search.get('rows') === '1000' ? 1000 : 100

  return (
    <main className="fixture fixture--performance">
      <FixtureHeader title={`${rowCount.toLocaleString('en-US')} rows`} />
      <PerformanceMetrics />
      <Group>
        <div className="performance-list">
          {Array.from({ length: rowCount }, (_, index) => (
            <TestRow
              key={index}
              id={`performance-row-${index}`}
              title={`Message ${String(index + 1).padStart(4, '0')}`}
              leadingWidths={[72]}
              trailingWidths={[72]}
              rootProps={{ 'data-testid': 'performance-row' }}
            />
          ))}
        </div>
      </Group>
    </main>
  )
}

function VisualFixture() {
  const state = search.get('state') ?? 'closed'
  const direction = state === 'rtl' ? 'rtl' : 'ltr'
  const defaultOpenSide =
    state === 'leading' || state === 'rtl'
      ? 'leading'
      : state === 'trailing'
        ? 'trailing'
        : undefined

  return (
    <main className="fixture fixture--visual">
      <div className="visual-stage" data-testid="visual-stage">
        <p className="visual-label">
          {state === 'rtl' ? 'RTL · leading' : state.replace('-', ' ')}
        </p>
        <TestRow
          id="visual-row"
          title="Quarterly planning"
          leadingWidths={[96]}
          trailingWidths={[96]}
          fullSwipeTrailing
          direction={direction}
          defaultOpenSide={defaultOpenSide}
        />
        <p className="visual-caption">Updated 09:41 · Design team</p>
      </div>
    </main>
  )
}

function GeometryFixture() {
  const [wideAction, setWideAction] = useState(false)

  return (
    <main className="fixture fixture--geometry">
      <button
        data-testid="widen-leading-action"
        type="button"
        onClick={() => setWideAction(true)}
      >
        Widen leading action
      </button>
      <Root className="geometry-root" data-testid="root">
        <Leading className="geometry-side" data-testid="leading">
          <Action
            data-testid="leading-action"
            fullSwipe
            onAction={() => undefined}
            style={wideAction ? { inlineSize: 120 } : undefined}
          >
            Archive
          </Action>
        </Leading>
        <Content className="geometry-content" data-testid="content">
          Message
        </Content>
      </Root>
    </main>
  )
}

function MissingFixture() {
  return (
    <main className="fixture">
      <FixtureHeader title="Unknown scenario" />
      <p>{scenario}</p>
    </main>
  )
}

const fixtures: Record<string, () => ReactNode> = {
  inbox: () => <InboxFixture />,
  overflow: () => <OverflowFixture />,
  'body-scroll': () => <BodyScrollFixture />,
  containment: () => <ContainmentFixture />,
  lifecycle: () => <LifecycleFixture />,
  rtl: () => <RtlFixture />,
  accessibility: () => <AccessibilityFixture />,
  performance: () => <PerformanceFixture />,
  visual: () => <VisualFixture />,
  geometry: () => <GeometryFixture />,
}

function App() {
  const renderFixture = fixtures[scenario] ?? (() => <MissingFixture />)
  return (
    <>
      {renderFixture()}
      <span hidden className="fixture-ready" data-testid="fixture-ready">
        ready
      </span>
    </>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
