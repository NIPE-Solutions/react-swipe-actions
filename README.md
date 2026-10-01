# React Swipe Actions

Reveal Archive, Delete, or other actions beside React inbox, task, or saved-item
rows, keeping secondary actions close to their content.

Measured buttons, scroll arbitration, and keyboard disclosure come with the
row. Your application owns data, requests, confirmation, undo, and removal.

[Live demos and docs](https://react-swipe-actions.nipesolutions.com) ·
[npm](https://www.npmjs.com/package/@nipe-solutions/react-swipe-actions) ·
[GitHub](https://github.com/NIPE-Solutions/react-swipe-actions)

## Install and build a row

```bash
npm install @nipe-solutions/react-swipe-actions
```

Supports React 18.3 and React 19 with matching `react-dom` peers and no additional
runtime dependencies.

Pass application callbacks and keep ordinary buttons available. `styles.css`
includes mechanics and a neutral theme.

```tsx
import {
  Action,
  Content,
  Leading,
  Root,
  Trailing,
} from '@nipe-solutions/react-swipe-actions'
import '@nipe-solutions/react-swipe-actions/styles.css'

interface MessageRowProps {
  subject: string
  onArchive: () => void
  onDelete: () => void
}

export function MessageRow({ subject, onArchive, onDelete }: MessageRowProps) {
  return (
    <Root aria-label={`${subject} actions`}>
      <Leading>
        <Action fullSwipe onAction={onArchive}>
          Archive
        </Action>
      </Leading>
      <Content style={{ padding: '1rem' }}>
        <p>{subject}</p>
        <button type="button" onClick={onArchive}>
          Archive
        </button>
        <button type="button" onClick={onDelete}>
          Delete
        </button>
      </Content>
      <Trailing>
        <Action destructive onAction={onDelete}>
          Delete
        </Action>
      </Trailing>
    </Root>
  )
}
```

`Action` renders a native button. Here `fullSwipe` lets a committed full swipe
invoke Archive; Delete requires button activation. `destructive` is a styling
marker, not confirmation. Handle failed requests, confirmation, or undo yourself.

## Disclosure and keyboard access

Root supports controlled or uncontrolled state. `leading` and `trailing` follow
LTR/RTL. `Group` closes the previously open sibling; see
[application patterns](docs/guides/application-patterns.md) for state and grouping.

Label each Root. ArrowLeft/ArrowRight reveal physical edges on the focused root;
Escape closes. Hidden actions leave the accessibility tree and tab order.

See [interaction and accessibility](docs/guides/interaction-accessibility.md)
for scrolling, focus, and reduced motion.

## Styling and boundaries

For custom presentation, import `core.css`; `theme.css` adds neutral defaults.
Keep core's `touch-action: pan-y`, avoid competing Content transform transitions,
and preserve hidden-action semantics.
See [styling and containers](docs/guides/styling-and-containers.md).

This primitive does not manage lists, virtualization, or removal. Generic swipe
hooks, nested roots, `asChild`, and React Native are outside its scope.

Server rendering reflects the supplied controlled or default open state.
Keep server and first-client state consistent.

Requires modern browser APIs, including Pointer Events and `ResizeObserver`.

Automated Chromium, Firefox, and WebKit checks cover gestures, keyboard, RTL,
reduced motion, and axe scans. No physical-device or human screen-reader run was
performed for 1.0.0. Phone touch and OS back-edge behavior need separate checks:
see [real-device QA](docs/REAL_DEVICE_QA.md).

## Development

Requires Node 24 and npm 11.

```bash
npm install
npm run check
npm run test:e2e
```

[Getting started](docs/guides/getting-started.md) ·
[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) ·
[NIPE Open Source](https://opensource.nipesolutions.com)

## License

[MIT](LICENSE)
