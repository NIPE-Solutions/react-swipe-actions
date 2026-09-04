# Architecture

`@nipe-solutions/react-swipe-actions` is a compound React component with an
internal pointer controller and animation engine. It owns one row's interaction;
the application continues to own list data, effects, confirmation, undo, and
virtualization.

## Public boundary

The package root exports `Root`, `Content`, `Leading`, `Trailing`, `Action`,
`Group`, the `SwipeActions` namespace, and their public types. Mechanical CSS is
available through `core.css`; `theme.css` is optional presentation; `styles.css`
combines both. Gesture, state, measurement, motion, and diagnostics modules are
not package exports.

The documentation website deliberately consumes the package name and exported
CSS after `dist` is built. Its gesture visualizer is a website fixture adapter:
it observes DOM attributes and documented CSS variables and never reaches into
runtime internals.

## DOM layers

```text
Root [data-swipe-actions-root]
├── Leading [data-swipe-actions-side][data-side="leading"]
│   └── Action [data-swipe-actions-action]
├── Content [data-swipe-actions-content]  ← translated foreground
└── Trailing [data-swipe-actions-side][data-side="trailing"]
    └── Action [data-swipe-actions-action]
```

The side containers are absolutely positioned behind `Content`. Core CSS moves
only the content layer with `--swipe-actions-offset`. The active side changes
visibility and pointer availability as the root moves. A full-swipe claimant can
paint behind the revealed distance with action-scoped expansion variables.

Component order is compositional rather than visual: logical side attributes and
CSS logical properties decide the edge. Multiple containers for one side are a
development warning; the first mounted container supplies measurements.

## Gesture lifecycle

The root exposes `closed`, `open`, `dragging`, `settling`, and `activating` through
`data-state`. Before horizontal ownership, the pointer session also has an
internal pending phase that does not replace the resting DOM state:

1. **Closed or open:** a resting state at zero or one measured side width.
2. **Pending internally:** a primary pointer began on an eligible surface, but
   the axis is undecided.
3. **Dragging:** horizontal intent won, pointer capture is active, and one write
   is coalesced per animation frame.
4. **Settling:** the release target is closed or open and the animator approaches
   its exact measured offset.
5. **Activating:** a full-swipe claimant is armed and invoked while the row
   settles across its content width.

Starting a new eligible gesture interrupts an active settle from the current
visual offset. Pointer cancel, capture loss, window blur, unmount, direction
changes, and relevant configuration changes cancel transient work and restore an
authoritative resting state. Generation counters prevent a canceled animation's
promise from committing stale state.

After a trusted touch or pen drag, click suppression is scoped to the completing
pointer/target and expires after 400 ms. It does not turn the row into a global
click interceptor.

## Gesture arbitration

Intent remains pending inside a 6 px radial dead zone. Past it, one axis must be
greater than 1.2 times the other to win immediately. Near-diagonal movement
remains pending until it becomes decisive or reaches the explicit 18 px decision
distance; only then does the deterministic tie rule give vertical scrolling
ownership. Core CSS sets `touch-action: pan-y` on `Content` so the browser can
preserve vertical scrolling until horizontal intent wins.

Only the primary pointer and main button begin a gesture. A second pointer
cancels the active session. Mouse drags do not begin from buttons, links, inputs,
selects, text areas, or editable content. Touch and pen keep native event trust
information so click suppression can distinguish browser-generated follow-up
clicks.

## Measurement

`Content`, each side container, and every action create a local
`ResizeObserver`. Their content-box widths are stored in root-owned maps keyed by
mount-stable symbols. Measurements are therefore per element, not inferred from
a fixed action count or shared width.

Registration and width changes schedule one microtask reconciliation. A missing
formerly open side requests close. Configuration changes cancel transient
motion before the next authoritative target is applied. Observer cleanup is
paired with component cleanup, including Strict Mode effect replay.

The large-list fixture reports five live `ResizeObserver` instances per row when
it renders one content layer, two side containers, and one action in each side.
That is current evidence, not a public constant consumers should depend on.

## Velocity and release projection

The controller retains position samples from the last 100 ms. Duplicate
timestamps are coalesced, recent segment velocities receive greater weight, and
stale time after the last sample attenuates the result. Release velocity is
clamped to ±2 px/ms before target projection.

The release resolver projects travel 120 ms forward. A side opens when measured
travel crosses `sideWidth × openThreshold` (default `0.35`) or a forward flick
projects across that point after meaningful travel. Backward projected movement
can close a row even if the raw distance is beyond the threshold.

A full swipe uses `contentWidth × fullSwipeThreshold` (default `0.7`). Its
velocity path requires directional pointer displacement of at least 15% of the
content width. A pre-existing open offset is not counted as pointer travel, so a
tiny extension from an open row cannot activate a destructive action.

## Resistance and full swipe

Without a full-swipe claimant, unrestricted travel ends at the measured side
width. With one, it continues to the content width. Travel beyond that bound uses
an asymptotic resistance curve:

```text
resisted excess = dimension × (1 - 1 / (excess / dimension + 1))
```

This keeps overswipe finite and continuous. An enabled claimant is selected from
the active side; more than one enabled claimant on a side emits a development
warning and the first is used.

When a gesture starts from an open side and crosses the closed position, the
opposite side has a bounded gate before it begins revealing. The gate is the
smaller of 25% of the resting side width and 15% of the row width. This prevents
the previous open offset from becoming immediate one-to-one travel on the other
side while preserving deliberate cross-row motion in both LTR and RTL.

## Settling and reduced motion

The animator reads the current offset, writes through `requestAnimationFrame`,
and uses cubic ease-out. Duration is distance divided by velocity toward the
target, clamped between 120 and 360 ms; a minimum settle velocity of 0.75 px/ms
avoids long low-speed tails. Velocity away from the target does not make the
settle slower.

When `prefers-reduced-motion: reduce` matches, the destination is written
immediately and no animation frame is scheduled. The media-query listener is
attached after mount and removed during cleanup.

## Group registry

`Group` holds a stable context registry with a map of root IDs to close callbacks
and the current open ID. A dragged row claims group ownership when release
commits to an open target, before settling begins, so the previously open peer
closes while the successor settles. The same timing applies to a controlled row:
the peer closes at the committed opening request while the controlled prop stays
authoritative for the successor. The registry deduplicates repeated ownership
notifications. It does not hold message objects, render the list, add document
listeners, or force every row through a shared controlled value.

Unmount removes the callback and clears the current ID when appropriate. Nested
groups create independent registries; nested swipe roots are not supported.

## Accessibility and focus

The root becomes focusable when it has actions and is not disabled. Physical
`ArrowLeft` and `ArrowRight` open the corresponding screen edge after conversion
to logical state. Opening by keyboard moves focus to the first enabled revealed
action. `Escape` closes an open row and focus is restored when it would otherwise
remain in a hidden side.

Inactive sides use `inert`, `aria-hidden`, and managed descendant `tabindex`
fallbacks. A local `MutationObserver` tracks focusable descendants added or
changed while a side is inactive and restores the consumer's original values
when the side opens or unmounts. Interactive descendants handle their own
keyboard events; editable targets and modified key combinations are ignored by
the root.

`Action` is a native `button type="button"`. Disabled roots block swipe and
imperative gesture effects without blocking normal content interaction. Disabled
actions use native disabled semantics.

## Controlled synchronization

Uncontrolled roots initialize from `defaultOpenSide` and commit requests to
local state. Controlled roots read `openSide` and report requests through
`onOpenSideChange`; they do not pretend a requested value was accepted. The
settle completion re-reads the authoritative side before writing its final
offset.

Refs expose `open(side)` and `close()`. These use the same state request path, so
controlled parents receive callbacks and remain authoritative. Switching between
controlled and uncontrolled ownership is discouraged because it makes that
authority ambiguous.

## Direction and SSR

Public state is always `leading`, `trailing`, or `null`. In LTR, leading has a
positive physical offset; in RTL, the signs reverse. An explicit `direction`
prop wins. Otherwise an isomorphic layout effect reads computed direction on the
client, and one attribute-only observer watches relevant ancestry for runtime
changes.

Module evaluation does not access `window` or `document`. Server rendering emits
the configured controlled or default open state and stable initial CSS variables.
Measurement, media-query subscription, computed direction, observers, and
pointer resources begin after mount. Applications should keep server and
first-client controlled/default state consistent to avoid a hydration mismatch.

## Styling hooks

Stable hooks are documented CSS variables and attributes, not class names:

- `--swipe-actions-offset`
- `--swipe-actions-progress`
- `--swipe-actions-leading-progress`
- `--swipe-actions-trailing-progress`
- `--swipe-actions-action-width` on each measured action
- `--swipe-actions-full-swipe-width` and
  `--swipe-actions-full-swipe-progress` on the claimant
- `data-state`, `data-side`, `data-revealing-side`, `data-active`
- `data-full-swipe`, `data-full-swipe-expanding`, `data-destructive`,
  `data-disabled`

Consumers may add classes and inline custom properties to public components.
Core CSS must precede product styling. The optional theme is intentionally
neutral and replaceable. Presentation CSS must not transition `transform` on the
content layer because JavaScript owns direct drag and settle coordinates.

## Limitations

The alpha does not provide row removal, undo, confirmation, async state, generic
gesture hooks, virtualization, portals, drag and drop, `asChild`, React Native,
or nested swipe roots. It has no runtime integration dependency for dialogs,
drawers, or Bottom Sheet components. Those containers must allow vertical pan
ownership and should be tested with their actual gesture configuration.

Performance cost currently scales with rendered rows and observed elements.
Applications with very large datasets should virtualize at the list layer. CSS
transforms or layout changes that make content-box widths differ from the desired
reveal geometry require application validation.

## Browser policy

Support targets the current and previous major versions at release time of
Chrome/Chromium, Edge, Firefox, and Safari, plus corresponding modern Chrome
Android and Mobile Safari releases. Required primitives are Pointer Events,
`ResizeObserver`, `requestAnimationFrame`, CSS custom properties, and logical
properties. The exact automated browser builds belong in CI/release evidence,
not as a permanent version promise.

## Automated and manual evidence

Automated tests cover pointer lifecycle, arbitration, click suppression,
measurement, velocity, resistance, controlled synchronization, group cleanup,
keyboard/focus, RTL, reduced motion, SSR import/rendering, browser interaction,
package consumers, and CSS/API boundaries.

Manual checks are recorded separately and are never implied by an automated
pass. In particular, OS browser back-edge gestures on physical Mobile Safari and
Chrome Android require device testing because desktop automation cannot
faithfully reproduce navigation-edge ownership. Bottom Sheet integrations also
need checks against the consuming sheet version and configuration.
