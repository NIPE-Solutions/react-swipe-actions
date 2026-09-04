import { useRef, useState } from 'react'
import {
  Action,
  Content,
  Group,
  Leading,
  Root,
  Trailing,
} from '@nipe-solutions/react-swipe-actions'

import { GestureVisualizer } from './GestureVisualizer'
import { ActionIcon } from './ActionIcon'

const messages = [
  {
    sender: 'Maya Chen',
    initials: 'MC',
    subject: 'Review notes are ready',
    preview: 'I marked the two gesture cases we discussed.',
    time: '09:41',
    unread: true,
  },
  {
    sender: 'Owen Brooks',
    initials: 'OB',
    subject: 'Friday release window',
    preview: 'The dry run passed on all three browser engines.',
    time: '08:16',
    unread: false,
  },
  {
    sender: 'Design systems',
    initials: 'DS',
    subject: 'Action colors approved',
    preview: 'Archive, flag, and delete now use semantic tokens.',
    time: 'Tue',
    unread: false,
  },
]

export function InboxDemo() {
  const diagnosticHost = useRef<HTMLDivElement>(null)
  const [deleteCount, setDeleteCount] = useState(0)
  const [status, setStatus] = useState('Swipe or use the arrow keys.')

  return (
    <aside
      className="demo-column"
      data-testid="inbox-demo"
      aria-label="Interactive inbox demo"
    >
      <div className="inbox-demo">
        <header className="inbox-demo__bar">
          <div>
            <strong>Inbox</strong>
            <span className="demo-count-wide">3 messages</span>
            <span className="demo-count-compact">Message 1 of 3</span>
          </div>
          <span className="inbox-demo__hint">Drag either edge</span>
        </header>
        <div ref={diagnosticHost} className="inbox-demo__rows">
          <Group>
            {messages.map((message, index) => (
              <Root
                key={message.subject}
                className={`demo-row demo-row--${index + 1}`}
                aria-label={`${message.subject} actions`}
                data-demo-row=""
                data-diagnostic-label={`Row ${index + 1}`}
                data-testid={`demo-row-${index + 1}`}
                onOpenSideChange={(side) =>
                  setStatus(
                    side === null
                      ? `${message.subject} closed.`
                      : `${message.subject} opened ${side} actions.`,
                  )
                }
              >
                <Leading className="swipe-side swipe-side--leading">
                  <Action
                    className="swipe-action swipe-action--flag"
                    onAction={() => setStatus(`${message.subject} flagged.`)}
                  >
                    <ActionIcon name="flag" />
                    <span>Flag</span>
                  </Action>
                  <Action
                    className="swipe-action swipe-action--archive"
                    onAction={() => setStatus(`${message.subject} archived.`)}
                  >
                    <ActionIcon name="archive" />
                    <span>Archive</span>
                  </Action>
                </Leading>
                <Content className="swipe-row__content">
                  <span
                    className={`avatar avatar--${index + 1}`}
                    aria-hidden="true"
                  >
                    {message.initials}
                  </span>
                  <span className="message-copy">
                    <span className="message-line">
                      <strong>{message.sender}</strong>
                      <time>{message.time}</time>
                    </span>
                    <span className="message-subject">
                      {message.unread ? (
                        <span className="unread-dot">
                          <span className="sr-only">Unread: </span>
                        </span>
                      ) : null}
                      {message.subject}
                    </span>
                    <span className="message-preview">{message.preview}</span>
                  </span>
                </Content>
                <Trailing className="swipe-side swipe-side--trailing">
                  <Action
                    className="swipe-action swipe-action--snooze"
                    onAction={() => setStatus(`${message.subject} snoozed.`)}
                  >
                    <ActionIcon name="snooze" />
                    <span>Snooze</span>
                  </Action>
                  <Action
                    className="swipe-action swipe-action--delete"
                    destructive
                    fullSwipe
                    onAction={() => {
                      setDeleteCount((count) => count + 1)
                      setStatus(`${message.subject} delete action invoked.`)
                    }}
                  >
                    <ActionIcon name="delete" />
                    <span>Delete</span>
                  </Action>
                </Trailing>
              </Root>
            ))}
          </Group>
        </div>
        <footer className="inbox-demo__status" aria-live="polite">
          <span>{status}</span>
          <span>
            Deletes{' '}
            <output data-testid="demo-delete-count">{deleteCount}</output>
          </span>
        </footer>
      </div>
      <GestureVisualizer hostRef={diagnosticHost} />
    </aside>
  )
}
