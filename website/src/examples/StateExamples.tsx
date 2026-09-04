import { useState } from 'react'
import {
  Action,
  Content,
  Group,
  Leading,
  Root,
  Trailing,
} from '@nipe-solutions/react-swipe-actions'
import type { SwipeActionsOpenSide } from '@nipe-solutions/react-swipe-actions'

export function StateExamples() {
  const [openSide, setOpenSide] = useState<SwipeActionsOpenSide>(null)

  return (
    <>
      <article className="example" data-example-id="controlled-state-example">
        <div className="example__copy">
          <h3>Controlled state</h3>
          <p>
            The application owns the logical open side and can close it at any
            time.
          </p>
          <div className="example-controls" aria-label="Control open side">
            <button type="button" onClick={() => setOpenSide('leading')}>
              Open leading
            </button>
            <button type="button" onClick={() => setOpenSide('trailing')}>
              Open trailing
            </button>
            <button type="button" onClick={() => setOpenSide(null)}>
              Close
            </button>
          </div>
        </div>
        <div className="example__stage">
          <Root
            openSide={openSide}
            onOpenSideChange={setOpenSide}
            aria-label="Controlled row"
          >
            <Leading className="example-side example-side--archive">
              <Action onAction={() => undefined}>Archive</Action>
            </Leading>
            <Content className="example-row">
              Current value: {openSide ?? 'closed'}
            </Content>
            <Trailing className="example-side example-side--danger">
              <Action destructive onAction={() => undefined}>
                Delete
              </Action>
            </Trailing>
          </Root>
        </div>
      </article>

      <article className="example" data-example-id="group-example">
        <div className="example__copy">
          <h3>Group coordination</h3>
          <p>
            Open either row, then open the other. The first closes without
            list-wide state.
          </p>
        </div>
        <div className="example__stage example-stack">
          <Group>
            {['Flight receipt', 'Workshop notes'].map((label) => (
              <Root key={label} aria-label={`${label} actions`}>
                <Content className="example-row">{label}</Content>
                <Trailing className="example-side example-side--danger">
                  <Action destructive onAction={() => undefined}>
                    Delete
                  </Action>
                </Trailing>
              </Root>
            ))}
          </Group>
        </div>
      </article>

      <article className="example" data-example-id="rtl-example">
        <div className="example__copy">
          <h3>Right-to-left</h3>
          <p>
            Leading remains the inline start edge; public state never becomes
            left or right.
          </p>
        </div>
        <div className="example__stage" dir="rtl">
          <Root direction="rtl" aria-label="RTL row">
            <Leading className="example-side example-side--archive">
              <Action onAction={() => undefined}>أرشفة</Action>
            </Leading>
            <Content className="example-row">ملاحظات اجتماع الفريق</Content>
            <Trailing className="example-side example-side--danger">
              <Action destructive onAction={() => undefined}>
                حذف
              </Action>
            </Trailing>
          </Root>
        </div>
      </article>

      <article className="example" data-example-id="keyboard-example">
        <div className="example__copy">
          <h3>Keyboard</h3>
          <p>
            Focus the row. Arrow keys open the physical edge; Escape closes it.
          </p>
        </div>
        <div className="example__stage">
          <Root aria-label="Keyboard actions example">
            <Leading className="example-side example-side--archive">
              <Action onAction={() => undefined}>Archive</Action>
            </Leading>
            <Content className="example-row">
              Use ArrowRight or ArrowLeft
            </Content>
            <Trailing className="example-side example-side--danger">
              <Action destructive onAction={() => undefined}>
                Delete
              </Action>
            </Trailing>
          </Root>
        </div>
      </article>
    </>
  )
}
