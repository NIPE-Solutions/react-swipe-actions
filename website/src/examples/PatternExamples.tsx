import { useState } from 'react'
import {
  Action,
  Content,
  Leading,
  Root,
  Trailing,
} from '@nipe-solutions/react-swipe-actions'

export function PatternExamples() {
  const [activity, setActivity] = useState('Patterns are application-owned.')

  return (
    <>
      <Pattern
        id="notification"
        title="Notification"
        note="Mark read from the start edge or clear from the end."
      >
        <Root aria-label="Notification actions">
          <Leading className="example-side example-side--signal">
            <Action onAction={() => setActivity('Notification marked read')}>
              Read
            </Action>
          </Leading>
          <Content className="example-row pattern-row">
            <span className="pattern-icon" aria-hidden="true">
              N
            </span>
            <span>
              <strong>Build finished</strong>
              <small>Chromium · 2 minutes ago</small>
            </span>
          </Content>
          <Trailing className="example-side example-side--danger">
            <Action
              destructive
              onAction={() => setActivity('Notification cleared')}
            >
              Clear
            </Action>
          </Trailing>
        </Root>
      </Pattern>

      <Pattern
        id="todo"
        title="Todo"
        note="Completion is an application event, not built-in list behavior."
      >
        <Root aria-label="Todo actions">
          <Leading className="example-side example-side--archive">
            <Action fullSwipe onAction={() => setActivity('Task completed')}>
              Done
            </Action>
          </Leading>
          <Content className="example-row pattern-row">
            <span className="todo-ring" aria-hidden="true" />
            <span>
              <strong>Review gesture trace</strong>
              <small>Today · Documentation</small>
            </span>
          </Content>
          <Trailing className="example-side example-side--mixed">
            <Action onAction={() => setActivity('Task deferred')}>Later</Action>
          </Trailing>
        </Root>
      </Pattern>

      <Pattern
        id="file-manager"
        title="File manager"
        note="Compose rename, move, and delete at widths that fit their labels."
      >
        <Root aria-label="File actions">
          <Content className="example-row pattern-row">
            <span className="file-icon" aria-hidden="true">
              MD
            </span>
            <span>
              <strong>interaction-notes.md</strong>
              <small>12 KB · Updated today</small>
            </span>
          </Content>
          <Trailing className="example-side example-side--mixed">
            <Action onAction={() => setActivity('Rename requested')}>
              Rename
            </Action>
            <Action onAction={() => setActivity('Move requested')}>Move</Action>
            <Action
              destructive
              onAction={() => setActivity('Delete requested')}
            >
              Delete
            </Action>
          </Trailing>
        </Root>
      </Pattern>

      <output className="example-activity" aria-live="polite">
        {activity}
      </output>
    </>
  )
}

function Pattern({
  id,
  title,
  note,
  children,
}: {
  id: string
  title: string
  note: string
  children: React.ReactNode
}) {
  return (
    <article className="example" data-example-id={id}>
      <div className="example__copy">
        <h3>{title}</h3>
        <p>{note}</p>
      </div>
      <div className="example__stage">{children}</div>
    </article>
  )
}
