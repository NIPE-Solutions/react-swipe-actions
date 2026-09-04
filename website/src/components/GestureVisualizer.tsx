import type { RefObject } from 'react'

import { useGestureDiagnostics } from '../diagnostics'

export function GestureVisualizer({
  hostRef,
}: {
  hostRef: RefObject<HTMLElement | null>
}) {
  const snapshot = useGestureDiagnostics(hostRef)

  return (
    <section className="gesture-visualizer" aria-label="Gesture diagnostics">
      <header>
        <strong>Gesture trace</strong>
        <span>Site fixture only</span>
      </header>
      <dl>
        <div>
          <dt>Active</dt>
          <dd data-testid="diagnostic-active-root">{snapshot.activeRoot}</dd>
        </div>
        <div>
          <dt>Offset</dt>
          <dd data-testid="diagnostic-offset">
            {snapshot.offset.toFixed(0)} px
          </dd>
        </div>
        <div>
          <dt>Progress</dt>
          <dd data-testid="diagnostic-progress">
            {snapshot.progress.toFixed(2)}
          </dd>
        </div>
        <div>
          <dt>Velocity</dt>
          <dd data-testid="diagnostic-velocity">
            {snapshot.velocity.toFixed(2)} px/ms
          </dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd data-testid="diagnostic-owner">{snapshot.owner}</dd>
        </div>
        <div>
          <dt>Open</dt>
          <dd data-testid="diagnostic-open-state">{snapshot.openState}</dd>
        </div>
      </dl>
    </section>
  )
}
