# Interaction and accessibility

## Pointer intent

The row waits through a small dead zone before deciding whether a pointer belongs
to horizontal reveal or vertical scroll. Do not override `touch-action: pan-y`
from `core.css` unless the surrounding scroller provides an equivalent contract.
Near-diagonal movement remains pending beyond the dead zone until one axis is
decisive or the gesture reaches the 18 px decision distance. At that explicit
decision boundary, a remaining tie is resolved toward vertical scrolling.

Mouse dragging begins only from non-interactive row content. Touch and pen
gestures may begin on the content surface, while buttons and links continue to
receive their normal clicks. A completed trusted drag suppresses its matching
follow-up click for a short window.

Cancellation is expected. Pointer cancel, capture loss, a second pointer, window
blur, unmount, measurement/configuration changes, or direction changes can return
the row to its authoritative resting state.

## Keyboard behavior

- `ArrowLeft` opens the physical left edge.
- `ArrowRight` opens the physical right edge.
- If that side is already open, the arrow moves focus to its first enabled
  action.
- `Escape` closes an open row.
- Enter and Space activate the focused native action button.

Arrow keys are converted to logical state after direction is known. In RTL,
ArrowLeft therefore opens `trailing`, while ArrowRight opens `leading`.

The root ignores modified key combinations, editable controls, and keyboard
events already owned by interactive descendants. Give each root an accessible
label that describes the row, such as `"Quarterly planning actions"`.

## Focus and hidden sides

Only the open side participates in the accessibility tree and tab order. Closed
sides use `inert`, `aria-hidden`, and a managed `tabindex` fallback. Focus is not
left in a side as it becomes hidden.

Do not use CSS to force closed action buttons visible or focusable. If product
styling changes visibility, verify screen-reader exposure and tab order in every
open state.

## Disabled behavior

`disabled` on `Root` prevents gesture and imperative opening while leaving the
content itself available. `disabled` on `Action` is forwarded to a native button.
Do not replace these semantics with color or pointer-event rules alone.

## Reduced motion

When the user requests reduced motion, settling writes the target immediately
without scheduling animation frames. Product CSS must not add a `transform`
transition to the content layer in any motion preference: direct dragging and
the internal settle animator both write that coordinate. Other presentation
transitions should become immediate inside the product's reduced-motion media
query.

## Testing checklist

Automate closed, leading-open, trailing-open, disabled, and grouped accessibility
states. Assert which elements receive focus, not only that a key was pressed.
Use an accessibility scanner as a supplement to explicit tab-order and name
checks.

On physical devices, separately check the browser back edge. Desktop automation
does not reproduce every operating-system navigation gesture, so those results
must be reported as manual evidence rather than folded into an automated claim.
