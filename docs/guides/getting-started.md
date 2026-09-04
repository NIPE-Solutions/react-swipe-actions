# Getting started

## Install

```bash
npm install @nipe-solutions/react-swipe-actions
```

React 18.3 or React 19 and the matching React DOM version must already be in the
application. The package has no runtime dependencies.

## Compose a row

Import the mechanical stylesheet once near the application entry:

```tsx
import { SwipeActions } from '@nipe-solutions/react-swipe-actions'
import '@nipe-solutions/react-swipe-actions/core.css'

export function MessageRow() {
  return (
    <SwipeActions.Root aria-label="Quarterly planning actions">
      <SwipeActions.Leading>
        <SwipeActions.Action onAction={() => archiveMessage()}>
          Archive
        </SwipeActions.Action>
      </SwipeActions.Leading>

      <SwipeActions.Content>Quarterly planning</SwipeActions.Content>

      <SwipeActions.Trailing>
        <SwipeActions.Action
          destructive
          fullSwipe
          onAction={() => deleteMessage()}
        >
          Delete
        </SwipeActions.Action>
      </SwipeActions.Trailing>
    </SwipeActions.Root>
  )
}
```

`core.css` supplies positioning, visibility, transforms, and vertical-pan
behavior. Add product presentation in a separate stylesheet, or import
`theme.css` after core for neutral defaults.

## Choose state ownership

Use `defaultOpenSide` when a row can own its state:

```tsx
<SwipeActions.Root defaultOpenSide="trailing">
  {/* sides and content */}
</SwipeActions.Root>
```

Use `openSide` and `onOpenSideChange` when another state owner must approve every
change:

```tsx
import { useState } from 'react'
import {
  Root,
  type SwipeActionsOpenSide,
} from '@nipe-solutions/react-swipe-actions'

const [openSide, setOpenSide] = useState<SwipeActionsOpenSide>(null)

<Root openSide={openSide} onOpenSideChange={setOpenSide}>
  {/* sides and content */}
</Root>
```

Public state uses logical `leading` and `trailing`, never left and right.

## Coordinate a list

Wrap sibling rows in `Group` when opening a row should close the previously open
one:

```tsx
import { Group } from '@nipe-solutions/react-swipe-actions'

<Group>
  {messages.map((message) => (
    <MessageRow key={message.id} message={message} />
  ))}
</Group>
```

Keep message data, row removal, undo, and virtualization in the application.

## Add full swipe carefully

Only one enabled action on a side should have `fullSwipe`. Full swipe invokes the
same `onAction` callback as clicking or pressing the action; it does not remove a
row automatically. Use a clear label and test accidental activation with the
actual row width.

## Verify the integration

- Drag both logical sides.
- Scroll vertically starting on a row.
- Use ArrowLeft, ArrowRight, Escape, Enter, and Space.
- Check focus after closing a row.
- Test reduced motion and an RTL container.
- Test touch, pen if relevant, and interactive controls inside `Content`.
