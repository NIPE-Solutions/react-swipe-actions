# React Swipe Actions Design

## Status

Approved for implementation on 2026-09-04.

## Product Definition

`@nipe-solutions/react-swipe-actions` is a focused React primitive for adding polished swipe actions to arbitrary content. It owns swipe mechanics, semantic action exposure, and optional row coordination. It does not own list rendering, application data, visual design, virtualization, network state, or destructive data lifecycle.

Tagline: **Composable swipe actions for React.**

Long description: **Accessible, gesture-aware swipe actions with velocity, resistance, full-swipe activation, RTL support, and scroll-safe interaction.**

The initial release is `0.1.0-alpha.0`. It supports React `^18.3.0 || ^19.0.0`, modern evergreen browsers, Node.js 24 for development and release automation, and npm as the package manager. React and React DOM are peer dependencies. The runtime has zero dependencies.

## Scope

### Included

- Leading and trailing logical action sides.
- Multiple independently measured actions per side.
- Optional full-swipe activation, with at most one enabled claimant per side.
- Controlled and uncontrolled open state.
- Imperative `open(side)` and `close()` methods.
- Optional group coordination that closes the previously open row.
- Pointer-event gestures for touch, pen, and suitable mouse targets.
- Horizontal/vertical gesture arbitration and vertical-scroll preservation.
- Velocity-aware settling, resistance, overswipe, and interruptible animation.
- Keyboard, assistive-technology, reduced-motion, and RTL support.
- Headless mechanical CSS plus an optional neutral theme.
- SSR-safe imports and hydration.
- Unit, component, accessibility, browser, packaging, performance, and bundle verification.
- Documentation, examples, CI, and release-readiness automation.

### Excluded from v1

- Generic gesture hooks or gesture APIs.
- List rendering, virtualization, sorting, or drag and drop.
- Portals, React Native, or non-React ports.
- Automatic row removal, undo, confirmation, toast, async action, or server-state systems.
- Built-in loading, retry, or rollback behavior.
- Nested swipe-action roots.
- `asChild` or general polymorphic composition.
- A runtime dependency on Bottom Sheet or a gesture/animation package.

## Public API

The package exports a compound component namespace and intentional public types:

```tsx
import { SwipeActions } from '@nipe-solutions/react-swipe-actions'
import '@nipe-solutions/react-swipe-actions/core.css'

<SwipeActions.Group>
  <SwipeActions.Root
    openSide={openSide}
    onOpenSideChange={setOpenSide}
    ref={handleRef}
  >
    <SwipeActions.Leading>
      <SwipeActions.Action onAction={archive}>Archive</SwipeActions.Action>
    </SwipeActions.Leading>

    <SwipeActions.Content>
      <EmailRow />
    </SwipeActions.Content>

    <SwipeActions.Trailing>
      <SwipeActions.Action destructive fullSwipe onAction={remove}>
        Delete
      </SwipeActions.Action>
    </SwipeActions.Trailing>
  </SwipeActions.Root>
</SwipeActions.Group>
```

### Components

- `SwipeActions.Root`: row boundary, state owner, measurement coordinator, gesture controller, and imperative handle.
- `SwipeActions.Content`: foreground content layer and gesture surface.
- `SwipeActions.Leading`: measured logical leading action container.
- `SwipeActions.Trailing`: measured logical trailing action container.
- `SwipeActions.Action`: semantic `<button type="button">` with normal click, touch, and keyboard activation.
- `SwipeActions.Group`: optional coordination provider that renders no layout wrapper.

### Core types

```ts
type SwipeActionsSide = 'leading' | 'trailing'
type SwipeActionsOpenSide = SwipeActionsSide | null
type SwipeActionsDirection = 'ltr' | 'rtl'

interface SwipeActionsHandle {
  open(side: SwipeActionsSide): void
  close(): void
}
```

Public prop types are exported as `SwipeActionsRootProps`, `SwipeActionsContentProps`, `SwipeActionsSideProps`, `SwipeActionsActionProps`, and `SwipeActionsGroupProps`. Internal gesture, measurement, and animation types are not exported.

### Root state

`Root` accepts `openSide`, `defaultOpenSide`, and `onOpenSideChange`. Controlled mode never mutates authoritative open state internally; it requests changes through the callback and visually reconciles to the prop. Uncontrolled mode owns its open side. The initial default is closed.

`Root` also accepts `disabled`, optional `direction`, `openThreshold`, `fullSwipeThreshold`, and standard non-conflicting `<div>` props. Thresholds are ratios strictly between zero and one. Defaults are tuned from interaction fixtures before the alpha is finalized and then documented as stable values.

The imperative ref exposes only `open(side)` and `close()`. It follows the same controlled-state rules and never triggers an action.

### Actions

`Action` accepts `onAction`, `disabled`, `destructive`, and `fullSwipe`, plus ordinary button attributes that do not conflict with library behavior. `onAction` may return any value, including a promise, but its return value is ignored. The library does not manage asynchronous state.

At most one enabled action per side may claim `fullSwipe`. A disabled action cannot be the active full-swipe action. Duplicate side containers, multiple enabled full-swipe claimants, invalid thresholds, and components outside their required context emit clear, deduplicated development warnings. Production validation is limited to correctness-critical behavior.

Mouse dragging is enabled by default only when pointer down begins on non-interactive, non-editable content. Links, buttons, inputs, selects, textareas, contenteditable regions, and their descendants retain native clicking, selection, and form behavior.

## DOM and Layout Architecture

Each root is an overflow-clipped positioning context. Leading and trailing action containers sit beneath the content layer at logical inline edges. The content layer is the only translated row-sized foreground. Actions retain their natural widths and may differ.

`ResizeObserver` measures leading width, trailing width, and content width after mount. Measurements update for label changes, font loading effects, localization, and responsive resizing. The module never accesses `window`, `document`, `ResizeObserver`, `matchMedia`, or computed style during module initialization or server rendering.

No-action sides apply resisted movement and return closed. Side removal, resizing, or direction change cancels active animation and reconciles the current offset to a valid state. Open logical state is preserved when possible.

## Gesture State Machine

One explicit internal state machine replaces independent interaction booleans:

```text
idle -> pending -> dragging -> settling -> open
                         \-> activating -> idle/open
```

Disabled roots bypass gesture handling. `open` is a stable resting state; a new pointer session can move directly from it through `pending` into `dragging`. Cancellation returns to the last valid controlled or uncontrolled resting target.

### Pointer lifecycle

Pointer down records the pointer identifier, physical starting coordinates, time, current visual offset, and starting open side. It does not call `preventDefault()` or capture the pointer yet.

Movement remains pending inside a small dead zone. Beyond it, axis dominance determines ownership:

- Clear horizontal intent: the row captures the pointer, owns the session, and locks movement to x.
- Clear vertical intent: native scroll permanently owns the session; the row cannot reactivate until the next pointer down.
- Exact or near diagonal intent: remain pending until movement becomes decisive, then use a deterministic tie rule biased toward vertical scrolling.

After horizontal ownership, the handler prevents browser behavior only where necessary and updates a pending physical offset. One scheduled animation frame writes transforms and CSS variables directly to the DOM. React does not render on every pointer move.

Pointer up resolves a resting or activation target. `pointercancel`, lost capture, window blur, a second active pointer, component unmount, and relevant configuration changes cancel safely, release capture if held, clear samples, and settle or reconcile once. Cleanup is idempotent under React Strict Mode.

### Click suppression

Normal pointer movement inside the pending dead zone preserves clicks. A session that acquired horizontal ownership sets a one-use suppression marker scoped to the root and pointer completion. The next compatible click produced by that drag is canceled during capture; unrelated later clicks are not. Dragging over a different descendant cannot activate it on release.

## Velocity and Settle Intent

Velocity is calculated from several recent, timestamped samples within a short rolling window, not from one delta. Samples older than the window are discarded. Weighting favors recent coherent motion while limiting timestamp noise. A pause before release reduces velocity toward zero. Direction reversal is represented by recent motion rather than the total drag direction.

Target selection is a pure function of:

- Current physical offset and logical direction.
- Projected offset from bounded release velocity.
- Leading/trailing measured widths.
- Current open side.
- Available action side.
- Normal open distance threshold.
- Full-swipe distance and velocity gates.

Opening actions and full-swipe activation are separate decisions. Normal opening uses the side's available width and projected intent. Full swipe uses row width, requires a minimum real travel distance, and permits a constrained high-velocity path. A tiny high-speed sample cannot activate an action. A disabled full-swipe claimant is ignored.

## Resistance and Overswipe

Resistance is a deterministic non-linear pure function. It is applied when dragging toward a side with no actions, crossing the closed boundary from an open side, and exceeding normal revealed width. Movement remains bounded.

If a side has no full-swipe action, overswipe beyond its measured width becomes progressively harder. If it has an eligible full-swipe action, motion transitions into expansion mode and the claimant visually expands as the row approaches the armed threshold. The interaction is physical and predictable, not a literal spring simulation.

## Full Swipe

Full swipe is armed only for the eligible action on the currently revealed side. Stable data attributes expose armed/active styling state. Releasing while armed settles the content offscreen, invokes `onAction` exactly once, and then returns the mechanics to the authoritative controlled or uncontrolled state. The library never removes the row or changes application data.

If the component unmounts during activation, cleanup stops motion and prevents stale callbacks. If controlled state changes while activation settles, the controlled state wins after the already-committed action invocation boundary.

## Animation

Dragging uses direct rAF-coalesced transform updates. Settling uses a small internal requestAnimationFrame controller with duration and easing derived from travel distance and bounded release velocity. It produces no continuous idle loop.

Settling is interruptible. A new pointer down samples the current computed transform, cancels the active controller, and starts from the visible coordinate rather than stale logical state. Animation cancellation is idempotent and covers unmount, resize, controlled changes, direction changes, side removal, and reduced-motion changes.

`prefers-reduced-motion: reduce` makes settle transitions immediate while keeping direct dragging interactive. Preference observation occurs only after mount and is cleaned up deterministically.

## Accessibility and Keyboard Model

Swipe is never the only route to actions. The root/content control surface is keyboard reachable when actions exist and has a consumer-overridable accessible label. It uses semantic HTML and minimal ARIA.

- Physical `ArrowLeft` and `ArrowRight` expose the corresponding side, normalized into logical leading/trailing state.
- Arrow handling ignores editable controls, modified keystrokes, and events already handled by interactive descendants.
- Keyboard opening moves focus to the first enabled revealed action.
- `Escape` closes an open row and restores focus safely when focus would otherwise become hidden.
- Tab reaches actions only on the currently open side.
- `Action` uses native button Enter/Space activation and disabled semantics.

Closed action sides are not invisible focus targets. They use `inert` where supported together with `aria-hidden` and deterministic descendant tab-order handling needed for supported browsers. The active open side is accessible. Focus is never left within a side while it becomes hidden.

The disabled root blocks swipe mechanics and imperative gesture effects but leaves content interactive and accessible. Disabled actions use native button semantics.

Automated axe scans and explicit tab-order tests cover closed, leading-open, trailing-open, disabled, and grouped states. Documentation describes all keyboard behavior and introduced ARIA.

## RTL and Dynamic Direction

Public state always uses logical `leading` and `trailing`. Internally, a direction adapter maps logical sides to physical x signs:

- LTR: leading is left and positive x; trailing is right and negative x.
- RTL: leading is right and negative x; trailing is left and positive x.

An explicit `direction` prop wins. Otherwise the mounted root resolves computed CSS direction and observes relevant direction changes without affecting SSR output. Nested RTL containers therefore work independently of document direction.

A runtime direction change cancels a gesture or animation, remaps the same logical open side where possible, and never reinterprets controlled state as a physical side. Full-swipe velocity and thresholds operate after normalization.

## Group Coordination and Performance

`Group` provides an imperative registry. Each root registers a stable identifier and a close function. When a root begins opening, the group closes the previously open root and records the new identifier. Coordination does not flow through a context value that changes per open, so unrelated rows do not rerender.

Standalone roots require no group. Group renders no layout wrapper and does not own list items or keys.

Closed idle rows have no global pointer listeners, running animation frames, or React updates. Observers are scoped and cleaned up. Performance fixtures render 100 and 1,000 rows and report initial mount, open coordination behavior, observer/listener counts, and gesture frame behavior. Measurements determine whether further optimization is warranted.

## Styling Contract

Mechanics and presentation are separate package entrypoints:

- `core.css`: required positioning, clipping, logical placement, transforms, visibility, and `touch-action: pan-y` mechanics.
- `theme.css`: optional neutral colors, spacing, radii, and transitions for examples and quick starts.
- `styles.css`: convenience composition of core and theme.

The package has no Tailwind or CSS framework dependency. Stable styling hooks include:

- `data-state="closed|open|dragging|settling|activating"` on the root.
- `data-side="leading|trailing"` on side containers and actions.
- `data-active`, `data-full-swipe`, `data-destructive`, and `data-disabled` where semantically applicable.
- `--swipe-actions-offset`: current signed physical offset in pixels.
- `--swipe-actions-progress`: normalized progress for the active side, clamped to `[0, 1]`.
- `--swipe-actions-leading-progress` and `--swipe-actions-trailing-progress`: per-side normalized progress in `[0, 1]`.
- `--swipe-actions-action-width`: measured action width in pixels on each action.

Only documented attributes and variables are public styling contracts.

## Repository and Packaging

The project is a single package with a co-located documentation site:

```text
.github/
docs/
e2e/
scripts/
src/
  components/
  gesture/
  motion/
  state/
  styles/
  utils/
test/
website/
```

Small responsibilities stay together; directories are not created merely for symmetry.

Vite builds ESM and CommonJS. TypeScript emits bundled declarations. A strict exports map exposes only `.`, `./core.css`, `./theme.css`, `./styles.css`, and `./package.json`. CSS is marked as a side effect; JavaScript remains tree-shakeable. The npm artifact contains dist output and required legal/release documentation only.

Package verification packs the real tarball, installs it into isolated fixtures, and verifies React + TypeScript, ESM import, CommonJS require, Vite consumption, SSR import, CSS imports, declaration quality, and private export rejection.

Bundle budgets are established from the completed baseline and checked for minified ESM, gzip, core CSS, theme CSS, and npm tarball size. The budget records its rationale and includes a small intentional margin rather than being set to the exact current byte count.

## Testing Strategy

### Pure unit tests

Vitest covers velocity windows, pauses, reversals, tiny fast movement, direction mapping, resistance curves and bounds, open/full-swipe threshold resolution, controlled target selection, and settle timing.

### Component tests

Testing Library covers compound-component configuration, controlled and uncontrolled modes, leading/trailing open and close, imperative refs, disabled roots and actions, action activation, multiple and unequal-width actions, group coordination, development warnings, keyboard/focus behavior, click suppression, ResizeObserver changes, Strict Mode cleanup, and SSR-safe import.

Raw pointer sequences cover down/move/up, cancel, lost capture, blur, unmount, multiple pointers, horizontal/vertical/diagonal arbitration, axis changes, jitter, flicks, slow drags, pauses, and reversals.

### Browser tests

Playwright runs Chromium, Firefox, and WebKit projects. Tests use real browser pointer/touch behavior for vertical scrolling, partial and full swipe, multiple actions, action clicks, interactive children, animation interruption, resize, RTL, dynamic direction, reduced motion, keyboard behavior, and accessibility. Canonical screenshots cover only closed, open sides, full-swipe armed, and RTL states.

Fixtures include body scroll, overflow containers, dialog/drawer-like containment, Bottom Sheet integration without a runtime dependency, row unmount during interaction, and 100/1,000-row performance pages. Browser back-edge behavior receives documented manual device coverage because desktop automation cannot faithfully reproduce every OS-level navigation gesture.

### Accessibility tests

`@axe-core/playwright` scans closed, open-leading, open-trailing, disabled, and group fixtures. Explicit focus-order assertions verify that hidden actions are unreachable and keyboard exposure remains discoverable.

## Documentation Website

The Vite-powered website has a polished mobile inbox as its primary demonstration. It makes reveal, full swipe, and group coordination understandable immediately. It includes Introduction, Installation, Quick Start, Anatomy, Actions, Leading and Trailing, Full Swipe, Controlled State, Groups, Gestures, Scroll Interaction, Accessibility, Keyboard, RTL, Styling, CSS Variables, Data Attributes, Performance, SSR, API Reference, Examples, FAQ, Migration, and Contributing content.

Representative examples validate one action, three unequal actions, trailing only, both sides, full swipe, controlled state, group coordination, RTL, keyboard use, scroll containers, custom styling, file/todo/notification patterns, and Bottom Sheet integration. A maintainer-only interaction visualizer reports offset, progress, velocity, owner, and open state without entering the runtime API.

`docs/architecture.md` explains DOM layering, lifecycle, arbitration, measurement, velocity, resistance, settling, group coordination, accessibility, and controlled synchronization.

## Quality Gates and CI

`npm run check` runs formatting verification, lint, typecheck, unit/component tests, build, API and CSS contract checks, bundle budgets, packed-package consumer tests, and docs build. Browser tests run separately because of browser installation cost.

GitHub Actions includes:

- Main quality gate on the supported Node/npm toolchain.
- Playwright matrix for Chromium, Firefox, and WebKit, including axe.
- Dependency update configuration.
- Release-readiness and artifact verification.

Release automation checks version/changelog alignment, a clean expected artifact, export boundaries, bundle size, package contents, and a dry run. The prepared npm workflow uses trusted publishing/OIDC and provenance with least-privilege permissions. It is manually/release triggered and is not executed as part of implementation.

## Browser Policy

The supported policy is the current and previous major versions at release time of Chrome/Chromium, Edge, Firefox, and Safari, plus the corresponding modern Chrome Android and Mobile Safari releases. Required primitives are Pointer Events, ResizeObserver, requestAnimationFrame, CSS custom properties, and logical properties. Accessibility fallbacks cover browsers where `inert` behavior is incomplete. Obsolete browsers without these primitives are unsupported.

The exact versions tested by the lockfile's Playwright release are recorded in CI artifacts and release notes rather than frozen indefinitely in prose.

## Error and Failure Behavior

Misconfiguration warnings explain the problem and correction and are deduplicated where practical. A missing action side never exposes empty unrestricted space. Invalid measurements preserve the last valid resting state. Cancellation and cleanup are safe to repeat. Action callbacks are invoked at most once for each committed click, tap, keyboard activation, or full swipe. Consumer callback exceptions are not swallowed or converted into library state.

## Validation and Completion Criteria

The alpha is ready only when the interaction, accessibility, internationalization, React, performance, packaging, quality, and documentation items from the product brief are demonstrated by automated tests or an explicit documented manual check. The final audit deliberately exercises pointer cancellation, capture loss, rapid swipes, mid-drag resize/unmount/controlled changes, side removal, RTL and reduced-motion changes, Strict Mode, interactive children, vertical-scroll competition, multi-touch, and browser edge gestures.

The final handoff reports architecture, public API, gesture and animation models, accessibility and RTL behavior, styling contracts, tests, browser policy, measured performance, bundle sizes, runtime dependencies, CI/release setup, documentation, limitations, pre-release classification, and exact local verification commands.

## Key Decisions

- Use an internal native pointer and motion engine; add no runtime animation or gesture dependency.
- Support React 18.3 and React 19.
- Ship ESM and CommonJS plus declarations and strict CSS entrypoints.
- Enable mouse dragging only from non-interactive content.
- Expose logical leading/trailing state, never public left/right state.
- Make keyboard arrows the non-swipe disclosure mechanism and keep hidden actions out of the accessibility tree and tab order.
- Use development warnings for ambiguous composition instead of production throws.
- Keep full-swipe action effects and row removal under application ownership.
- Keep browser tests separate from the practical local `npm run check` suite.
- Recommend `0.1.0-alpha.0` until interaction behavior and API have real-world validation.
