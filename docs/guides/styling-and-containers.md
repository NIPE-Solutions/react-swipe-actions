# Styling and containers

## Stylesheet choices

Choose one of these entry strategies:

```tsx
// Mechanical contract only; add all presentation yourself.
import '@nipe-solutions/react-swipe-actions/core.css'

// Neutral package presentation after mechanics.
import '@nipe-solutions/react-swipe-actions/core.css'
import '@nipe-solutions/react-swipe-actions/theme.css'

// Equivalent combined entry.
import '@nipe-solutions/react-swipe-actions/styles.css'
```

Keep core before presentation so product rules can supply color, typography,
spacing, and action widths without replacing the positioning contract.

## Stable hooks

Use attributes rather than package implementation class names:

```css
.message-row [data-swipe-actions-content] {
  min-block-size: 4rem;
  background: white;
}

.message-row [data-swipe-actions-action] {
  inline-size: 5rem;
  border: 0;
}

.message-row [data-destructive] {
  background: #b42318;
  color: white;
}

.message-row[data-state='dragging'] [data-swipe-actions-content] {
  cursor: grabbing;
}
```

Action widths are measured individually. Prefer a declared inline size or stable
padding so label changes do not unexpectedly alter an already open target.
Do not transition `transform` on `[data-swipe-actions-content]`; the gesture and
settle engine owns that property on every animation frame.

## Progress variables

The root exposes offset and reveal progress:

- `--swipe-actions-offset`
- `--swipe-actions-progress`
- `--swipe-actions-leading-progress`
- `--swipe-actions-trailing-progress`
- `--swipe-actions-action-width` on each action
- `--swipe-actions-full-swipe-width` on the active claimant
- `--swipe-actions-full-swipe-progress` on the active claimant

The active full-swipe claimant also receives expansion width/progress variables.
These are useful for color or label emphasis tied directly to the gesture. Avoid
running a permanent animation loop to read them; computed style can be sampled in
response to pointer or mutation events, as the maintainer website fixture does.

State attributes include `data-state`, `data-side`,
`data-revealing-side`, `data-active`, `data-full-swipe`,
`data-full-swipe-expanding`, `data-destructive`, and `data-disabled`. The two
full-swipe attributes distinguish eligibility from an actively expanding
claimant; `data-disabled` is present on disabled roots and actions.

## Scroll containers

Rows work in body and overflow scrollers when vertical pan remains available.
Do not attach document-level pointer listeners for each row. If a custom scroller
changes `touch-action`, test diagonal starts, fast flicks, and cancellation at its
boundaries.

## Dialogs, drawers, and Bottom Sheets

No container package is a runtime dependency. Mount rows normally inside the
container's content area:

```tsx
<SheetContent>
  <SheetHeader>Saved places</SheetHeader>
  <SwipeActions.Group>
    {places.map((place) => (
      <PlaceRow key={place.id} place={place} />
    ))}
  </SwipeActions.Group>
</SheetContent>
```

The sheet and row both classify gestures. Configure the sheet to retain vertical
pan and test horizontal rows from the sheet body, near its handle, and while the
sheet is partially expanded. The package does not claim or coordinate the sheet's
drag state.

## RTL containers

Use logical CSS (`inset-inline-start`, `margin-inline`, and similar properties)
for action presentation. Either pass `direction` to a root or let it inherit the
nearest computed direction. Avoid flipping action DOM order with physical CSS;
the package already maps logical sides to their physical edge.
