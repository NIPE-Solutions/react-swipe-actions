# React Swipe Actions

Composable React rows that reveal measured leading and trailing actions while the
application keeps ownership of list data and side effects.

`@nipe-solutions/react-swipe-actions` supplies the row interaction: pointer
arbitration, keyboard behavior, focus handling, logical RTL sides, and optional
full-swipe activation. It is not a generic swipe-detection hook and does not
own a swipe list, row removal, undo, confirmation, async mutations, or
virtualization.

## Install

```bash
npm install @nipe-solutions/react-swipe-actions
```

React 18.3 or 19 and the matching `react-dom` version are peer dependencies.
The package has no runtime dependencies.

## Start with the row API

```tsx
import {
  Action,
  Content,
  Leading,
  Root,
  Trailing,
} from '@nipe-solutions/react-swipe-actions'
import '@nipe-solutions/react-swipe-actions/core.css'

interface MessageRowProps {
  onArchive: () => void
  onDelete: () => void
}

export function MessageRow({ onArchive, onDelete }: MessageRowProps) {
  return (
    <Root aria-label="Quarterly planning actions">
      <Leading>
        <Action onAction={onArchive}>Archive</Action>
      </Leading>
      <Content>Quarterly planning</Content>
      <Trailing>
        <Action destructive fullSwipe onAction={onDelete}>
          Delete
        </Action>
      </Trailing>
    </Root>
  )
}
```

Import `core.css` for required positioning, transforms, and vertical-pan
behavior. Then either add product presentation yourself, import `theme.css`
after core for neutral defaults, or import `styles.css` for their combined
equivalent.

```tsx
import '@nipe-solutions/react-swipe-actions/core.css'
import '@nipe-solutions/react-swipe-actions/theme.css'

// Or: import '@nipe-solutions/react-swipe-actions/styles.css'
```

## State, accessibility, and platforms

An uncontrolled row owns its initial side:

```tsx
<Root defaultOpenSide="trailing">{/* sides and content */}</Root>
```

A controlled row asks the application to change its logical side:

```tsx
import { useState } from 'react'
import {
  Root,
  type SwipeActionsOpenSide,
} from '@nipe-solutions/react-swipe-actions'

export function ControlledRow() {
  const [openSide, setOpenSide] = useState<SwipeActionsOpenSide>(null)

  return (
    <Root openSide={openSide} onOpenSideChange={setOpenSide}>
      {/* sides and content */}
    </Root>
  )
}
```

Use `Group` to close the previously open sibling; keep data, requests, undo,
and removal in the application. Roots use `leading` and `trailing` state in
both LTR and RTL. Give each actionable row an accessible label; ArrowLeft and
ArrowRight open physical edges, Escape closes, and inactive actions leave the
tab order. Imports are SSR-safe, and server rendering reflects the supplied
controlled or default open state. Keep server and first-client state consistent.

Support targets the current and previous major Chrome/Chromium, Edge, Firefox,
and Safari releases, plus modern Chrome Android and Mobile Safari. It requires
Pointer Events, `ResizeObserver`, animation frames, CSS custom properties, and
logical properties. v1 is an alpha and intentionally excludes generic gesture
hooks, nested swipe roots, portals, React Native, `asChild`, and application
list lifecycle features.

## Read more

- [Getting started](docs/guides/getting-started.md) and
  [styling/container guidance](docs/guides/styling-and-containers.md)
- [Interaction and accessibility](docs/guides/interaction-accessibility.md),
  [application patterns](docs/guides/application-patterns.md), and
  [architecture](docs/architecture.md)
- [Performance evidence](docs/performance.md), [contributing](CONTRIBUTING.md),
  [security reporting](SECURITY.md), and [release procedure](docs/RELEASING.md)
- [GitHub repository](https://github.com/nipe-solutions/react-swipe-actions)

This project is licensed under the [MIT License](LICENSE).
