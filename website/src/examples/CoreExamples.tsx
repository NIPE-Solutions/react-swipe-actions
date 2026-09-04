import { useState } from 'react'
import {
  Action,
  Content,
  Leading,
  Root,
  Trailing,
} from '@nipe-solutions/react-swipe-actions'

export function CoreExamples() {
  const [activity, setActivity] = useState('No action yet')
  const [customActivity, setCustomActivity] = useState('Waiting for input')
  const report = (message: string) => () => setActivity(message)

  return (
    <>
      <Example
        title="One action"
        id="one-action"
        note="A single leading action keeps the choice direct."
      >
        <Root aria-label="Single action example">
          <Leading className="example-side example-side--archive">
            <Action onAction={report('Archived')}>Archive</Action>
          </Leading>
          <Content className="example-row">Swipe right to archive</Content>
        </Root>
      </Example>

      <Example
        title="Unequal actions"
        id="unequal-actions"
        note="Each button is measured independently; widths do not need to match."
      >
        <Root aria-label="Unequal action widths example">
          <Content className="example-row">
            Swipe left for three choices
          </Content>
          <Trailing className="example-side example-side--mixed">
            <Action className="action-narrow" onAction={report('Read')}>
              Read
            </Action>
            <Action className="action-medium" onAction={report('Snoozed')}>
              Snooze
            </Action>
            <Action className="action-wide" onAction={report('Moved')}>
              Move to folder
            </Action>
          </Trailing>
        </Root>
      </Example>

      <Example
        title="Both sides"
        id="both-sides"
        note="Leading and trailing stay logical when direction changes."
      >
        <Root aria-label="Actions on both sides example">
          <Leading className="example-side example-side--archive">
            <Action onAction={report('Pinned')}>Pin</Action>
          </Leading>
          <Content className="example-row">
            Pin from the start, delete from the end
          </Content>
          <Trailing className="example-side example-side--danger">
            <Action destructive onAction={report('Deleted')}>
              Delete
            </Action>
          </Trailing>
        </Root>
      </Example>

      <Example
        title="Full swipe"
        id="full-swipe-example"
        note="Only one enabled action per side should claim a full swipe."
      >
        <Root aria-label="Full swipe example">
          <Content className="example-row">
            Continue past the reveal to delete
          </Content>
          <Trailing className="example-side example-side--danger">
            <Action
              destructive
              fullSwipe
              onAction={report('Full swipe delete invoked')}
            >
              Delete
            </Action>
          </Trailing>
        </Root>
      </Example>

      <Example
        title="Custom styling"
        id="custom-styling"
        note="Core owns mechanics; the product owns surface, shape, type, and semantic color."
      >
        <div className="custom-style-example">
          <Root
            className="custom-style-row"
            aria-label="Custom styled priority action"
          >
            <Leading className="custom-style-side">
              <Action onAction={() => setCustomActivity('Priority raised')}>
                Raise
              </Action>
            </Leading>
            <Content className="custom-style-content">
              <span className="custom-style-content__mark" aria-hidden="true">
                7
              </span>
              <span>
                <strong>Review keyboard model</strong>
                <small>Interaction spec · today</small>
              </span>
            </Content>
          </Root>
          <output
            className="custom-style-output"
            data-testid="custom-styling-output"
            aria-live="polite"
          >
            {customActivity}
          </output>
        </div>
      </Example>

      <output className="example-activity" aria-live="polite">
        {activity}
      </output>
    </>
  )
}

function Example({
  title,
  id,
  note,
  children,
}: {
  title: string
  id: string
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
