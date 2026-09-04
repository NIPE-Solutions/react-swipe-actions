# React Swipe Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify the complete `@nipe-solutions/react-swipe-actions` `0.1.0-alpha.0` repository described by the approved design.

**Architecture:** A compound React component API coordinates an explicit pointer gesture state machine, pure intent/physics functions, rAF-coalesced DOM motion, ResizeObserver measurements, logical-side normalization, and an imperative group registry. Mechanical CSS is independent from the optional theme; the package has zero runtime dependencies and ships ESM, CommonJS, declarations, and strict CSS exports.

**Tech Stack:** React 18.3/19, TypeScript, Vite, Vitest, Testing Library, jsdom, Playwright, axe-core, ESLint, Prettier, npm, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-04-react-swipe-actions-design.md`

## Global Constraints

- Initial version is `0.1.0-alpha.0`; do not publish it during implementation.
- Public React peer range is `^18.3.0 || ^19.0.0`; verify both majors in package fixtures.
- Development and CI use Node.js 24 and npm with a committed lockfile.
- Runtime dependencies remain zero; `react` and `react-dom` are peers.
- Public state uses only `leading | trailing | null`; physical left/right stays internal.
- Do not expose generic gesture hooks, own list/data lifecycle, or add `asChild`, portals, virtualization, or async state management.
- Preserve SSR-safe imports: no browser globals at module initialization.
- Pointer movement must not cause a React render per event.
- Core mechanical CSS and optional presentation CSS remain separate.
- Browser support is current and previous Chrome/Edge, Firefox, and Safari majors plus corresponding modern Android Chrome and Mobile Safari.
- Every completed task receives its own focused commit after its listed verification passes.

## File Map

```text
.github/
  dependabot.yml                         dependency update policy
  workflows/ci.yml                      practical quality gate
  workflows/browser.yml                 Playwright browser matrix
  workflows/release.yml                 trusted-publishing preparation
docs/
  architecture.md                       maintainer architecture
  RELEASING.md                          release procedure
  guides/*.md                           long-form product guides
e2e/
  app/*                                 browser fixture application
  accessibility.spec.ts                 axe and focus-order coverage
  gestures.spec.ts                      real pointer and scroll coverage
  lifecycle.spec.ts                     interruption/cancellation coverage
  rtl.spec.ts                           RTL and direction-change coverage
  visual.spec.ts                        minimal canonical screenshots
scripts/
  check-bundle-size.mjs                 JS/CSS/tarball budgets
  check-public-api.mjs                  export and declaration contract
  copy-styles.mjs                       stable CSS artifacts
  verify-package.mjs                    packed consumer checks
  verify-release.mjs                    release-readiness policy
src/
  components/context.ts                 internal root/side contexts
  components/group.tsx                  imperative coordination registry
  components/root.tsx                   row lifecycle and public state
  components/content.tsx                gesture surface/content layer
  components/side.tsx                   leading/trailing measurement layer
  components/action.tsx                 semantic action registration
  gesture/controller.ts                 pointer session state machine
  gesture/intent.ts                     axis ownership and settle target
  gesture/velocity.ts                   recent-sample velocity estimator
  motion/animator.ts                    interruptible rAF settle engine
  motion/resistance.ts                  deterministic overswipe function
  state/controllable.ts                 controlled/uncontrolled helper
  state/direction.ts                    logical/physical normalization
  styles/core.css                       required mechanics
  styles/theme.css                      optional neutral theme
  styles/styles.css                     convenience aggregate
  utils/dom.ts                          focus/interactive-target utilities
  utils/warn.ts                         deduplicated development warnings
  index.ts                              intentional public exports
  public-types.ts                       exported TypeScript surface
test/
  components/*.test.tsx                 component and interaction tests
  gesture/*.test.ts                     pure gesture math tests
  motion/*.test.ts                      animator/resistance tests
  package/*                             packed consumer fixtures/tests
  setup.ts                              deterministic browser mocks
website/
  index.html                            Vite entry
  src/*                                 docs shell, examples, and content
```

---

### Task 1: Repository Foundation and Reproducible Toolchain

**Files:**
- Create: `package.json`, `package-lock.json`, `.nvmrc`, `.gitignore`, `.prettierignore`, `LICENSE`
- Create: `tsconfig.json`, `tsconfig.build.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`
- Create: `src/index.ts`, `src/public-types.ts`, `test/setup.ts`
- Test: `test/package/foundation.test.mjs`

**Interfaces:**
- Produces package scripts `format`, `format:check`, `lint`, `typecheck`, `test:unit`, `build:dist`, `check`, and `clean`.
- Produces `dist/index.js`, `dist/index.cjs`, and `dist/index.d.ts` without browser-global evaluation.

- [ ] **Step 1: Write the failing foundation contract test**

```js
// test/package/foundation.test.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('package metadata has the approved identity and dependency policy', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'))
  assert.equal(pkg.name, '@nipe-solutions/react-swipe-actions')
  assert.equal(pkg.version, '0.1.0-alpha.0')
  assert.equal(pkg.type, 'module')
  assert.deepEqual(pkg.peerDependencies, {
    react: '^18.3.0 || ^19.0.0',
    'react-dom': '^18.3.0 || ^19.0.0',
  })
  assert.deepEqual(pkg.dependencies ?? {}, {})
  assert.equal(pkg.engines.node, '>=24 <25')
})
```

- [ ] **Step 2: Run the contract and confirm the missing manifest failure**

Run: `node --test test/package/foundation.test.mjs`

Expected: FAIL because `package.json` does not exist.

- [ ] **Step 3: Create the package/tool configuration and minimal public entrypoint**

Use npm worktree-local dev dependencies matching the current compatible releases of Vite, TypeScript, Vitest, Testing Library, jsdom, ESLint, Prettier, Playwright, and axe. Configure Vite library mode with React externalized and both formats:

```ts
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: { entry: 'src/index.ts', formats: ['es', 'cjs'], fileName: (format) => format === 'es' ? 'index.js' : 'index.cjs' },
    rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime'] },
  },
})
```

Start `public-types.ts` with approved side/direction/handle types and export them from `index.ts`. Configure strict TypeScript with DOM/ES2022 libraries and declaration-only `tsconfig.build.json`. Set the strict package exports for `.`, four CSS/package paths, `files: ["dist", "CHANGELOG.md", "LICENSE"]`, and `sideEffects: ["**/*.css"]`.

- [ ] **Step 4: Install, generate the lockfile, and run foundation checks**

Run: `npm install && node --test test/package/foundation.test.mjs && npm run typecheck && npm run build:dist`

Expected: all commands PASS and the three JS/type entry artifacts exist.

- [ ] **Step 5: Commit the foundation**

```bash
git add package.json package-lock.json .nvmrc .gitignore .prettierignore LICENSE tsconfig.json tsconfig.build.json vite.config.ts vitest.config.ts eslint.config.js src test/setup.ts
git commit -m "chore: establish library toolchain"
```

### Task 2: Pure Direction, Velocity, Resistance, and Intent Math

**Files:**
- Create: `src/state/direction.ts`
- Create: `src/gesture/velocity.ts`, `src/gesture/intent.ts`
- Create: `src/motion/resistance.ts`
- Test: `test/gesture/direction.test.ts`, `test/gesture/velocity.test.ts`, `test/gesture/intent.test.ts`, `test/motion/resistance.test.ts`

**Interfaces:**
- Produces `physicalSign(side, direction): 1 | -1` and `sideFromOffset(offset, direction): SwipeActionsSide | null`.
- Produces `estimateVelocity(samples, now, windowMs): number` in px/ms.
- Produces `classifyIntent(dx, dy, deadZone, dominance): 'pending' | 'horizontal' | 'vertical'`.
- Produces `resolveRelease(input): { kind: 'closed' | 'open' | 'activate'; side: SwipeActionsSide | null; offset: number }`.
- Produces `resistedDistance(excess, dimension): number` and `applyResistance(input): number`.

- [ ] **Step 1: Write table-driven failing tests for logical direction and axis arbitration**

```ts
expect(physicalSign('leading', 'ltr')).toBe(1)
expect(physicalSign('trailing', 'ltr')).toBe(-1)
expect(physicalSign('leading', 'rtl')).toBe(-1)
expect(classifyIntent(4, 3, 6, 1.2)).toBe('pending')
expect(classifyIntent(12, 4, 6, 1.2)).toBe('horizontal')
expect(classifyIntent(10, 10, 6, 1.2)).toBe('vertical')
```

- [ ] **Step 2: Run the new pure tests and confirm missing-module failures**

Run: `npm run test:unit -- test/gesture test/motion`

Expected: FAIL because the pure modules do not exist.

- [ ] **Step 3: Implement direction and arbitration with explicit vertical tie bias**

Use signed physical offsets, finite-number guards, a 6px default dead zone, and a 1.2 axis-dominance ratio. Keep functions free of DOM access.

- [ ] **Step 4: Write failing velocity tests for slow drag, flick, reversal, pause, and tiny fast motion**

```ts
expect(estimateVelocity([{ x: 0, t: 0 }, { x: 40, t: 40 }], 40, 100)).toBeCloseTo(1)
expect(estimateVelocity([{ x: 0, t: 0 }, { x: 40, t: 40 }], 200, 100)).toBe(0)
expect(estimateVelocity([{ x: 0, t: 0 }, { x: 40, t: 40 }, { x: 20, t: 60 }], 60, 100)).toBeLessThan(0)
```

- [ ] **Step 5: Implement the recent-sample weighted estimator**

Filter samples to the rolling window, coalesce identical timestamps, require at least two samples, compute weighted segment velocities, and clamp release velocity to the bound consumed by `resolveRelease`.

- [ ] **Step 6: Write failing resistance and release-target matrices**

Cover no-action sides, normal width overshoot, full-swipe eligible overshoot, already-open closing flicks, distance opening, velocity opening, full-swipe minimum travel, and RTL sign normalization. Use explicit fixtures such as a 320px row, 96px action width, `openThreshold: 0.35`, and `fullSwipeThreshold: 0.7`.

- [ ] **Step 7: Implement bounded non-linear resistance and release resolution**

Use `dimension * (1 - 1 / (Math.abs(excess) / dimension + 1))` for asymptotic resistance. Project offset using bounded velocity, but require real travel of at least the gesture dead zone times two before velocity may open and at least 15% of row width before velocity may full-activate.

- [ ] **Step 8: Run pure tests, typecheck, and commit**

Run: `npm run test:unit -- test/gesture test/motion && npm run typecheck`

```bash
git add src/state/direction.ts src/gesture src/motion/resistance.ts test/gesture test/motion
git commit -m "feat: add swipe intent physics"
```

### Task 3: Interruptible Motion Controller and DOM Utilities

**Files:**
- Create: `src/motion/animator.ts`, `src/utils/dom.ts`, `src/utils/warn.ts`
- Test: `test/motion/animator.test.ts`, `test/utils/dom.test.ts`, `test/utils/warn.test.ts`

**Interfaces:**
- Produces `createAnimator({ read, write, now, requestFrame, cancelFrame }): SwipeAnimator`.
- `SwipeAnimator` exposes `animateTo(target, options)`, `cancel()`, `isAnimating()`, and `current()`.
- Produces `isInteractiveTarget(target): boolean`, `focusFirstEnabled(container): boolean`, and `setSubtreeInert(element, inert): void`.
- Produces `warnOnce(key, message): void` stripped/no-op in production.

- [ ] **Step 1: Write failing fake-frame tests for completion, cancellation, reduced motion, and interruption**

Assert that `animateTo(100)` writes monotonically toward 100, resolves once, and that `cancel()` prevents stale completion. Start a second animation mid-frame from `current()` and assert no coordinate jump.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm run test:unit -- test/motion/animator.test.ts`

Expected: FAIL because `createAnimator` is missing.

- [ ] **Step 3: Implement the rAF controller**

Use one frame identifier and one generation token. Read the visual coordinate when interrupted, use cubic ease-out with velocity-bounded duration, resolve canceled promises with `{ status: 'canceled' }`, and return immediate completion when reduced motion is requested.

- [ ] **Step 4: Write and implement DOM/warning utility tests**

Verify interactive detection for button/link/input/select/textarea/contenteditable and descendants; verify ordinary spans are draggable. Verify inert toggling saves/restores descendant `tabindex` only when needed and combines native `inert` with `aria-hidden`. Verify duplicate warning keys log once in development and never in production.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm run test:unit -- test/motion test/utils && npm run typecheck`

```bash
git add src/motion/animator.ts src/utils test/motion test/utils
git commit -m "feat: add interruptible motion utilities"
```

### Task 4: Controlled State and Group Coordination

**Files:**
- Create: `src/state/controllable.ts`, `src/components/group.tsx`, `src/components/context.ts`
- Test: `test/components/controllable.test.tsx`, `test/components/group.test.tsx`

**Interfaces:**
- Produces `useControllableOpenSide({ value, defaultValue, onChange })` returning `[side, requestSide]`.
- Produces `Group`, `GroupContext`, and `register(id, close): () => void`, `notifyOpen(id): void`.
- Group context identity remains stable while rows open and close.

- [ ] **Step 1: Write failing controlled/uncontrolled state tests**

Render a harness that requests `leading`. Assert uncontrolled state changes and callback fires once; controlled state calls back but stays at its prop until rerender; identical requests do not duplicate callbacks.

- [ ] **Step 2: Implement the controllable-state helper and verify**

Run: `npm run test:unit -- test/components/controllable.test.tsx`

Expected: PASS after using an internal state value only when `value === undefined` and a stable callback ref.

- [ ] **Step 3: Write failing group registry tests**

Register A and B, notify A then B, and assert A closes once. Unregister A and repeat without calling stale closures. Assert a consumer that only reads the registry does not rerender on notification.

- [ ] **Step 4: Implement a ref-backed imperative group provider**

Memoize one registry object for the provider lifetime; store close callbacks in `Map<string, () => void>` and current open ID in a ref. Render children directly inside the provider with no DOM wrapper.

- [ ] **Step 5: Run tests and commit**

Run: `npm run test:unit -- test/components/controllable.test.tsx test/components/group.test.tsx`

```bash
git add src/state/controllable.ts src/components/context.ts src/components/group.tsx test/components
git commit -m "feat: add state and group coordination"
```

### Task 5: Compound Components, Measurement, and Configuration Semantics

**Files:**
- Create: `src/components/root.tsx`, `src/components/content.tsx`, `src/components/side.tsx`, `src/components/action.tsx`
- Modify: `src/public-types.ts`, `src/index.ts`, `src/components/context.ts`
- Test: `test/components/composition.test.tsx`, `test/components/measurement.test.tsx`, `test/components/actions.test.tsx`

**Interfaces:**
- Produces `Root`, `Content`, `Leading`, `Trailing`, `Action`, and namespace object `SwipeActions`.
- `Root` ref implements `SwipeActionsHandle` and accepts approved controlled props/thresholds/direction/disabled/ARIA props.
- Side/action registration reports natural widths and eligible full-swipe claimant to Root.

- [ ] **Step 1: Write failing rendering and public API tests**

Assert the canonical example renders one root, content layer, logical sides, semantic `button[type=button]` actions, and all documented data hooks. Type-test namespace usage and exported prop types.

- [ ] **Step 2: Run focused tests and confirm missing component failures**

Run: `npm run test:unit -- test/components/composition.test.tsx`

- [ ] **Step 3: Implement contexts and minimal semantic components**

Forward DOM refs separately from the Root imperative handle where public props expose them. Side components register exactly once under Strict Mode cleanup. Action uses native `disabled`, invokes `onAction` once per click, and reports `fullSwipe && !disabled` eligibility.

- [ ] **Step 4: Write failing ResizeObserver measurement tests**

Use the setup mock to emit leading 80px, trailing 144px, content 320px, then update a localized action to 176px. Assert Root's internal registry and action `--swipe-actions-action-width` update without consumer props.

- [ ] **Step 5: Implement measurement and layout reconciliation**

Create observers only after mount, disconnect on cleanup, batch measurement reconciliation, and cancel invalid resting offsets through a Root motion adapter placeholder. Preserve logical state across width updates.

- [ ] **Step 6: Write configuration-warning tests**

Cover Action outside Root/Side, duplicate Leading, duplicate Trailing, multiple enabled full-swipe actions per side, disabled claimant exclusion, and invalid threshold ratios. Assert each problem explains its correction and warns once in development.

- [ ] **Step 7: Implement registration validation and public namespace exports**

Use development warnings and deterministic first-container/first-eligible claimant behavior. Validate `0 < openThreshold < fullSwipeThreshold < 1`, falling back to documented defaults `0.35` and `0.7`.

- [ ] **Step 8: Run component tests, types, and commit**

Run: `npm run test:unit -- test/components && npm run typecheck`

```bash
git add src/components src/public-types.ts src/index.ts test/components test/setup.ts
git commit -m "feat: add swipe actions compound API"
```

### Task 6: Pointer Gesture Controller and Direct Motion Integration

**Files:**
- Create: `src/gesture/controller.ts`
- Modify: `src/components/root.tsx`, `src/components/content.tsx`, `src/components/context.ts`
- Test: `test/components/pointer.test.tsx`, `test/components/click-suppression.test.tsx`, `test/components/lifecycle.test.tsx`

**Interfaces:**
- `createGestureController(options)` owns exactly one pointer session and returns pointer/click handlers plus `cancel(reason)`.
- Root motion adapter exposes `readOffset`, `writeOffset`, `settle`, `cancel`, and stable measurement/direction getters.
- Pointer frames write documented CSS variables and transform without React state per move.

- [ ] **Step 1: Write failing raw pointer sequence tests**

Cover horizontal down/move/move/up, vertical ownership, exact diagonal vertical bias, horizontal-then-vertical lock, vertical-then-horizontal rejection, jitter, fast flick, slow drag, pause, reversal, cancel, lost capture, blur, and second pointer cancellation.

- [ ] **Step 2: Run focused tests and verify the gesture controller is absent**

Run: `npm run test:unit -- test/components/pointer.test.tsx`

- [ ] **Step 3: Implement pending arbitration and pointer ownership**

Do not capture or prevent default on pointer down. On horizontal ownership capture the primary pointer, seed velocity samples, and schedule one DOM write frame. Vertical ownership permanently ends library participation for that session. Mouse sessions beginning inside `isInteractiveTarget` remain native.

- [ ] **Step 4: Implement release resolution and interruptible settling**

Feed measured widths, content width, logical direction, current side, travel, and estimated velocity into `resolveRelease`. Request semantic state only at settle/activation boundaries. Pointer down during settling reads current computed transform and cancels the old generation.

- [ ] **Step 5: Write failing click-suppression tests**

Verify button/link click, small movement, true swipe, release over a different child, and unrelated subsequent clicks. Assert only the compatibility click belonging to a horizontal-owned drag is canceled.

- [ ] **Step 6: Implement capture-phase one-use click suppression**

Record suppression only after horizontal ownership. Clear it after the matching click, timeout safety boundary, cancellation without compatibility click, or unmount.

- [ ] **Step 7: Write and satisfy lifecycle cleanup tests**

Assert no stale capture, frames, observers, callbacks, or duplicate listeners after pointer cancel, lost capture, blur, unmount, Strict Mode remount, resize mid-drag, side removal, and controlled prop change.

- [ ] **Step 8: Run interaction tests and commit**

Run: `npm run test:unit -- test/components && npm run typecheck`

```bash
git add src/gesture/controller.ts src/components test/components
git commit -m "feat: implement pointer swipe interaction"
```

### Task 7: Full Swipe Activation and Action Expansion

**Files:**
- Modify: `src/components/root.tsx`, `src/components/side.tsx`, `src/components/action.tsx`, `src/gesture/controller.ts`, `src/gesture/intent.ts`
- Test: `test/components/full-swipe.test.tsx`, `test/gesture/intent.test.ts`

**Interfaces:**
- Gesture controller reports `armedSide` and commits one activation callback at release.
- Full-swipe claimant receives `data-active` and expansion CSS variables only while eligible/armed.

- [ ] **Step 1: Write failing full-swipe behavior tests**

Cover slow 69% versus 71% travel, fast committed travel above the 15% minimum, tiny noisy flick rejection, disabled claimant, both logical sides, RTL, callback exactly once, callback exception propagation, and controlled-state reconciliation.

- [ ] **Step 2: Run focused tests and confirm failures**

Run: `npm run test:unit -- test/components/full-swipe.test.tsx test/gesture/intent.test.ts`

- [ ] **Step 3: Implement arming, expansion, and activation commit**

Set armed styling from direct DOM state during drag, settle content to signed row width on committed release, invoke the registered action once at the commit boundary, then reconcile to authoritative state. Never remove the root.

- [ ] **Step 4: Add cancellation regression tests**

Cover unmount during activation, controlled state change during activation, claimant removal mid-animation, and a second pointer. Assert stale generations cannot invoke callbacks.

- [ ] **Step 5: Run tests and commit**

Run: `npm run test:unit -- test/components/full-swipe.test.tsx test/components/lifecycle.test.tsx test/gesture/intent.test.ts`

```bash
git add src/components src/gesture test/components/full-swipe.test.tsx test/components/lifecycle.test.tsx test/gesture/intent.test.ts
git commit -m "feat: add full swipe activation"
```

### Task 8: Keyboard, Focus Visibility, Reduced Motion, and Dynamic RTL

**Files:**
- Modify: `src/components/root.tsx`, `src/components/side.tsx`, `src/components/content.tsx`, `src/state/direction.ts`, `src/utils/dom.ts`
- Test: `test/components/accessibility.test.tsx`, `test/components/keyboard.test.tsx`, `test/components/rtl.test.tsx`, `test/components/reduced-motion.test.tsx`, `test/components/ssr.test.tsx`

**Interfaces:**
- Root keyboard surface exposes physical arrows normalized to logical sides and Escape close.
- Only the open side is non-inert and visible to assistive technology.
- Explicit `direction` overrides computed CSS direction; computed changes reconcile after mount.

- [ ] **Step 1: Write failing keyboard and focus-order tests**

Assert closed actions cannot receive Tab, arrow opening focuses the first enabled action, arrows map correctly in LTR/RTL, editable controls ignore Root shortcuts, Escape closes and restores safe focus, and disabled roots leave content controls usable.

- [ ] **Step 2: Implement disclosure keyboard behavior and inert side management**

Add the Root keyboard surface only when actions exist, pass through consumer ARIA labeling, avoid unnecessary roles, and update inert/`aria-hidden` before moving focus. Restore focus only if the closing side currently contains it.

- [ ] **Step 3: Write failing direction and reduced-motion change tests**

Mock computed direction and media queries. Change LTR to RTL while open, dragging, and settling. Toggle reduced motion mid-settle. Assert cancellation, same logical open side, remapped physical offset, and immediate completion.

- [ ] **Step 4: Implement mounted direction/media observers**

Read computed style only in layout effects. Observe relevant `dir` attribute changes on the root/ancestors with one scoped observer and clean it up. Subscribe to the media query after mount and reconcile active animation on change.

- [ ] **Step 5: Add SSR import/render/hydration tests**

Use `renderToString` without browser globals, then hydrate the same markup in jsdom and assert no mismatch warnings. Ensure initial server state uses logical/default state without computed direction access.

- [ ] **Step 6: Run accessibility/SSR tests and commit**

Run: `npm run test:unit -- test/components/accessibility.test.tsx test/components/keyboard.test.tsx test/components/rtl.test.tsx test/components/reduced-motion.test.tsx test/components/ssr.test.tsx`

```bash
git add src test/components
git commit -m "feat: add accessible keyboard and rtl behavior"
```

### Task 9: Mechanical CSS, Optional Theme, and CSS Contract Checks

**Files:**
- Create: `src/styles/core.css`, `src/styles/theme.css`, `src/styles/styles.css`
- Create: `scripts/copy-styles.mjs`, `scripts/check-css-contract.mjs`
- Modify: `package.json`, `vite.config.ts`
- Test: `scripts/check-css-contract.test.mjs`

**Interfaces:**
- Produces `dist/core.css`, `dist/theme.css`, `dist/styles.css` matching package exports.
- Core owns only layout, transforms, clipping, logical placement, visibility, and `touch-action: pan-y`.
- Theme owns all color, spacing, radius, shadow, and typography decisions.

- [ ] **Step 1: Write a failing CSS contract test**

Parse the source styles and assert core contains the documented custom properties/data selectors and `touch-action: pan-y`, contains no hex/rgb colors or font family, and every selector is namespaced under `[data-swipe-actions-root]`. Assert theme contains no positioning/transform/touch-action declarations.

- [ ] **Step 2: Run the contract and confirm missing stylesheet failure**

Run: `node --test scripts/check-css-contract.test.mjs`

- [ ] **Step 3: Implement core and theme CSS**

Use logical inset properties for sides, translate content using `--swipe-actions-offset`, make closed sides non-interactive, expand the active full-swipe action from its logical edge, and include a reduced-motion fallback. Aggregate styles via CSS `@import` or deterministic concatenation supported by the copy script.

- [ ] **Step 4: Implement artifact copying and wire build scripts**

Copy source CSS byte-for-byte to stable dist filenames after the JS/type build. Run contract validation against both source and dist output.

- [ ] **Step 5: Verify and commit**

Run: `node --test scripts/check-css-contract.test.mjs && npm run build:dist && node scripts/check-css-contract.mjs dist/*.css`

```bash
git add src/styles scripts/copy-styles.mjs scripts/check-css-contract.mjs scripts/check-css-contract.test.mjs package.json vite.config.ts
git commit -m "feat: ship headless swipe action styles"
```

### Task 10: Packed Package, Type Compatibility, and Bundle Budgets

**Files:**
- Create: `scripts/check-public-api.mjs`, `scripts/check-bundle-size.mjs`, `scripts/size-budget.json`, `scripts/verify-package.mjs`
- Create: `test/package/verify-package.test.mjs`, `test/package/fixtures/esm/*`, `test/package/fixtures/cjs/*`, `test/package/fixtures/types/*`, `test/package/fixtures/ssr/*`
- Modify: `package.json`

**Interfaces:**
- `npm run test:package` builds, packs, installs isolated consumers, and verifies entrypoints.
- `npm run test:size` enforces ESM minified/gzip, core/theme CSS, and tarball budgets.
- `npm run test:api` rejects undocumented exports and leaked internal declarations.

- [ ] **Step 1: Write failing artifact/export tests**

Assert the tarball contains only approved files, root ESM import and CJS require expose identical names, CSS subpaths resolve, `src/*` imports fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`, and package metadata points to the GitHub repository.

- [ ] **Step 2: Implement deterministic pack/install verification**

Use `npm pack --json` into a temporary directory, install with `npm install --ignore-scripts <tarball> react@<version> react-dom@<version>`, and run ESM, CJS, SSR, and TypeScript fixture commands. Test React 18.3 and current React 19 fixture lanes.

- [ ] **Step 3: Generate and verify the intentional API inventory**

Read the bundled declaration entry, compare exports to a checked-in allowlist containing only `SwipeActions`, public component/type names, and no gesture/motion internals.

- [ ] **Step 4: Establish evidence-based bundle budgets**

Build once, record actual minified ESM, gzip, core CSS, theme CSS, and packed tarball bytes, then set rounded budgets with 10–15% headroom in `size-budget.json`. The checker reports actual, budget, and delta per artifact and fails on excess or bundled React.

- [ ] **Step 5: Run package gates and commit**

Run: `npm run build:dist && npm run test:api && npm run test:size && npm run test:package`

```bash
git add scripts test/package package.json package-lock.json
git commit -m "test: verify package consumers and budgets"
```

### Task 11: Browser Fixture and Cross-Browser Interaction Suite

**Files:**
- Create: `playwright.config.ts`, `e2e/app/index.html`, `e2e/app/main.tsx`, `e2e/app/styles.css`
- Create: `e2e/gestures.spec.ts`, `e2e/lifecycle.spec.ts`, `e2e/rtl.spec.ts`, `e2e/accessibility.spec.ts`, `e2e/visual.spec.ts`
- Modify: `package.json`

**Interfaces:**
- `npm run test:e2e` runs Chromium, Firefox, and WebKit projects against a production-like Vite fixture.
- Fixture routes/query states expose inbox, overflow scroll, dialog, Bottom Sheet-compatible nesting, lifecycle controls, RTL, reduced motion, and performance lists.

- [ ] **Step 1: Build the browser fixture with test instrumentation**

Expose visible counters for action calls and lifecycle changes, but drive gestures through rendered UI. Include unequal action widths, both sides, full swipe, links/buttons/checkboxes, overflow scrolling, runtime direction toggle, resize controls, unmount controls, and 100/1,000-row pages.

- [ ] **Step 2: Write real gesture and scroll tests**

Use Playwright touchscreen contexts where supported and pointer APIs elsewhere. Assert partial/open/full swipe, velocity flick, vertical scroll delta without row translation, diagonal arbitration, interactive child clicks, drag click suppression, group close, and no-action resistance.

- [ ] **Step 3: Write lifecycle and interruption tests**

Exercise pointer cancel through browser events, lost capture, blur-equivalent cancellation, grab during settling, resize/unmount/controlled change mid-drag, side removal, rapid repeated swipes, and two simultaneous pointers. Assert one action call and no page errors.

- [ ] **Step 4: Write RTL, keyboard, reduced-motion, and axe tests**

Test document RTL, nested RTL, explicit direction, runtime change, physical arrow mapping, Escape, tab order, closed/open/disabled/group axe scans, and immediate settle under emulated reduced motion.

- [ ] **Step 5: Add minimal visual snapshots**

Capture only deterministic closed, leading-open, trailing-open, armed full-swipe, and RTL states at a fixed viewport with animations disabled.

- [ ] **Step 6: Run all three browser projects and commit**

Run: `npx playwright install chromium firefox webkit && npm run test:e2e`

```bash
git add playwright.config.ts e2e package.json package-lock.json
git commit -m "test: add cross-browser swipe coverage"
```

### Task 12: Documentation Website, Examples, and Performance Evidence

**Files:**
- Create: `website/index.html`, `website/src/main.tsx`, `website/src/site.css`, `website/src/content.ts`
- Create: `website/src/components/DocsShell.tsx`, `website/src/components/InboxDemo.tsx`, `website/src/components/GestureVisualizer.tsx`
- Create: `website/src/examples/*.tsx`
- Create: `website/vite.config.ts`, `scripts/verify-website.mjs`
- Create: `docs/architecture.md`, `docs/guides/*.md`, `docs/performance.md`
- Modify: `package.json`

**Interfaces:**
- `npm run dev` serves the website; `npm run build:website` produces a static site.
- Website imports the built/public package surface, not source-private modules, except a dev-only diagnostics adapter that is excluded from package exports.

- [ ] **Step 1: Write website content and navigation inventory test**

Make `verify-website.mjs` assert that every approved section exists, every internal link resolves, code examples import the public package name, the primary demo includes reveal/full-swipe/group behavior, and prohibited marketing phrases are absent.

- [ ] **Step 2: Build the docs shell and polished inbox demo**

Use an intentional, responsive visual language without introducing a runtime UI framework. The first viewport contains the concise product description, install command, canonical code, and interactive mobile inbox. Keep demo presentation in website CSS and library mechanics in `core.css`.

- [ ] **Step 3: Add representative examples and gesture visualizer**

Implement one action, unequal multiple actions, both sides, full swipe, controlled state, group, RTL, keyboard, scroll container, Bottom Sheet-compatible container, notification, todo, and file manager examples. Visualizer reads documented CSS variables plus fixture diagnostics and shows offset, progress, velocity, owner, and open state without adding a package API.

- [ ] **Step 4: Write user and maintainer documentation**

Create the requested guides and `docs/architecture.md` covering DOM layers, gesture lifecycle/arbitration, measurement, velocity, resistance, settling, group registry, accessibility/focus, controlled synchronization, SSR, styling hooks, limitations, and browser policy. Record manual back-edge/device checks separately from automated claims.

- [ ] **Step 5: Measure large-list fixtures and record results**

Run the 100/1,000-row fixture in Chromium, record mount duration, idle rAF count, global listener count, observer count, group-opening rerenders, and drag-frame trace methodology in `docs/performance.md`. Optimize only confirmed regressions, rerunning component/browser tests after any change.

- [ ] **Step 6: Build, verify, and commit**

Run: `npm run build:website && node scripts/verify-website.mjs`

```bash
git add website docs/architecture.md docs/guides docs/performance.md scripts/verify-website.mjs package.json package-lock.json
git commit -m "docs: add website and interaction guides"
```

### Task 13: Project Documentation and Community Health

**Files:**
- Create: `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `docs/RELEASING.md`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/ISSUE_TEMPLATE/feature_request.yml`, `.github/PULL_REQUEST_TEMPLATE.md`
- Modify: `package.json`

**Interfaces:**
- README provides first-screen positioning, install command, canonical API, CSS entrypoint choice, and links to deeper docs.
- Release guide documents dry run, trusted publisher prerequisites, provenance, verification, and no local token requirement for OIDC publishing.

- [ ] **Step 1: Write a failing documentation contract script**

Extend `verify-package.mjs` to require community files, repository links, license identity, install/API snippets, support policy, private vulnerability reporting instructions, and an unreleased changelog section for `0.1.0-alpha.0`.

- [ ] **Step 2: Write concise public documentation**

Use the approved precise positioning; include factual comparison to generic swipe detection and swipe-list ownership. Document core versus theme imports, controlled/uncontrolled examples, accessibility, RTL, SSR, browser support, and v1 limitations.

- [ ] **Step 3: Add contribution, security, conduct, and release policy**

List Node/npm prerequisites, `npm run check`, browser installation/tests, changeset/changelog expectations, architecture links, responsible disclosure route, maintainer response expectations, and artifact inspection steps.

- [ ] **Step 4: Verify and commit**

Run: `npm run format:check && node scripts/verify-package.mjs --source`

```bash
git add README.md CHANGELOG.md CONTRIBUTING.md CODE_OF_CONDUCT.md SECURITY.md docs/RELEASING.md .github package.json
git commit -m "docs: add project and release guidance"
```

### Task 14: CI, Release Preparation, and Dependency Automation

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/browser.yml`, `.github/workflows/release.yml`, `.github/dependabot.yml`
- Create: `scripts/verify-release.mjs`, `scripts/verify-workflows.test.mjs`
- Modify: `package.json`

**Interfaces:**
- CI runs `npm ci` then `npm run check` on Node 24.
- Browser workflow runs isolated Chromium/Firefox/WebKit jobs and uploads reports on failure.
- Release workflow is release/manual gated, uses `id-token: write`, verifies before `npm publish`, and is never invoked locally by `check`.

- [ ] **Step 1: Write failing workflow policy tests**

Parse YAML and assert pinned major action versions, least-privilege default permissions, npm cache, Node 24, `npm ci`, quality/browser commands, artifact upload on failure, concurrency cancellation, release environment, `id-token: write`, provenance, and absence of long-lived npm token configuration.

- [ ] **Step 2: Implement CI and browser workflows**

Keep the practical gate and browser matrix separate. Cache npm and Playwright browsers appropriately, use timeouts, upload traces/screenshots/reports only when useful, and run WebKit as a required job.

- [ ] **Step 3: Implement release-readiness checks and workflow**

Verify clean tracked state, semver prerelease classification, changelog entry, package name/repository, public access, provenance, artifact contents, package consumers, bundle budgets, and registry/version absence in dry-run mode. Configure trusted publishing but do not run `npm publish` during implementation.

- [ ] **Step 4: Implement Dependabot policy and test it**

Configure monthly npm and GitHub Actions updates, grouped non-major development dependencies, sensible open-PR limits, and conventional commit prefixes.

- [ ] **Step 5: Run policy tests and commit**

Run: `node --test scripts/verify-workflows.test.mjs && node scripts/verify-release.mjs --dry-run`

```bash
git add .github scripts/verify-release.mjs scripts/verify-workflows.test.mjs package.json
git commit -m "ci: add quality and release workflows"
```

### Task 15: Adversarial Audit and Final Quality Gate

**Files:**
- Modify: confirmed defect sources and their nearest regression tests only
- Create: `docs/release-readiness/0.1.0-alpha.0.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Produces an evidence record containing exact commands, browser versions, performance findings, bundle sizes, artifact inventory, manual checks, and known limitations.

- [ ] **Step 1: Run the practical quality gate from a clean dependency install**

Run: `npm ci && npm run check`

Expected: format, lint, typecheck, unit/component, build, public API, CSS, size, package, and website checks all PASS.

- [ ] **Step 2: Run the complete browser matrix**

Run: `npm run test:e2e`

Expected: Chromium, Firefox, and WebKit projects PASS, including axe and screenshots.

- [ ] **Step 3: Execute the adversarial interaction checklist**

Manually and through focused Playwright repeats exercise pointer cancel, lost capture, rapid swipes, resize/unmount/controlled changes mid-drag, direction and reduced-motion changes, action removal, Strict Mode, interactive descendants, vertical scroll, two pointers, and back-edge gestures on available physical devices. Convert every confirmed reproducible defect into a failing nearest-layer regression test before fixing it.

- [ ] **Step 4: Verify packed artifacts and release dry run**

Run: `npm run test:package && npm run test:size && npm run release:check -- --dry-run`

Expected: package consumers, budgets, artifact inventory, version/changelog, and provenance configuration PASS without publishing.

- [ ] **Step 5: Record evidence and limitations**

Write measured byte sizes and performance numbers rather than estimates. Record actual Playwright browser builds, physical-device checks completed, unsupported nested roots, absence of automatic removal/asChild/virtualization ownership, and the recommended `0.1.0-alpha.0` classification.

- [ ] **Step 6: Re-run verification after documentation changes**

Run: `npm run check && npm run test:e2e && git status --short`

Expected: all checks PASS; status contains only the release-readiness and changelog edits intended for this task.

- [ ] **Step 7: Commit the verified alpha repository**

```bash
git add CHANGELOG.md docs/release-readiness/0.1.0-alpha.0.md
git commit -m "chore: complete alpha readiness audit"
```

## Final Handoff

The completion report must provide:

1. Architecture summary.
2. Final public API and any approved deviations from this plan.
3. Gesture and settle intent model with actual tuned constants.
4. Native animation and interruption strategy.
5. Accessibility and keyboard model.
6. RTL and dynamic-direction model.
7. Core/theme styling contract.
8. Unit, component, browser, axe, visual, package, and regression tests implemented.
9. Actual Playwright browser versions and documented browser policy.
10. Measured 100/1,000-row performance findings.
11. Actual minified/gzip/CSS/tarball sizes and budgets.
12. Runtime dependency count.
13. CI, trusted-publishing, provenance, and release-dry-run setup.
14. README, website, guides, architecture, community, and release documents delivered.
15. Known limitations and manual checks not completed.
16. Recommended `0.1.0-alpha.0` pre-release classification.

Exact local verification commands:

```bash
nvm use
npm ci
npm run check
npx playwright install chromium firefox webkit
npm run test:e2e
npm run release:check -- --dry-run
```
