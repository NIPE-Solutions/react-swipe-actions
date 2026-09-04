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
          <dt>Offset</dt>
          <dd>{snapshot.offset.toFixed(0)} px</dd>
        </div>
        <div>
          <dt>Progress</dt>
          <dd>{snapshot.progress.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Velocity</dt>
          <dd>{snapshot.velocity.toFixed(2)} px/ms</dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>{snapshot.owner}</dd>
        </div>
        <div>
          <dt>Open</dt>
          <dd>{snapshot.openState}</dd>
        </div>
      </dl>
    </section>
  )
}
