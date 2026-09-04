# Application patterns

Swipe actions expose intent; the application commits effects. Keeping that
boundary visible makes async failure, undo, and removal predictable.

## Notification

Use a non-destructive leading action for “Mark read” and a trailing action for
“Clear.” Update the notification store in `onAction`. If clearing is reversible,
remove optimistically in application state and put undo in the notification
system, not inside the row.

## Todo

A full leading swipe can mean “Complete” when that behavior is familiar in the
product. Keep completion idempotent because click, keyboard, and full swipe all
reach the same callback. A trailing “Later” action can open an application-owned
date picker.

## File manager

Use measured unequal widths for Rename, Move, and Delete. Do not put a full swipe
on Rename or Move because either needs follow-up input. For destructive deletion,
the callback may open confirmation instead of mutating the file list immediately.

## Controlled server state

Controlled open state should not double as request state. Keep them separate:

```tsx
const [openSide, setOpenSide] = useState<SwipeActionsOpenSide>(null)
const mutation = useDeleteMessage()

<Root openSide={openSide} onOpenSideChange={setOpenSide}>
  <Content>{message.subject}</Content>
  <Trailing>
    <Action
      destructive
      disabled={mutation.isPending}
      onAction={() => mutation.mutate(message.id)}
    >
      {mutation.isPending ? 'Deleting' : 'Delete'}
    </Action>
  </Trailing>
</Root>
```

The application decides when to close, remove, retry, or report a failed request.

## Virtualized lists

Put `Group` outside the virtualizer when visible rows should coordinate. Give each
virtual row a stable application key. Unmounting a row releases its registration,
measurements, observers, capture, and pending motion. Validate that the virtualizer
does not recycle a DOM row across different items without changing its React key.
