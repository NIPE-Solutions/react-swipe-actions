# React Swipe Actions Final Review Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every final-review finding while preserving the public API, zero runtime dependencies, and reproducible release evidence.

**Architecture:** Keep browser-free validation in the practical quality gate and run live Chromium/axe checks only in browser-enabled lanes. Carry pointer-session facts explicitly through the gesture resolver, coordinate groups at the committed-open boundary, keep layout-sensitive effects synchronous only in browsers, and ship one declaration entrypoint. Validate platform screenshots in the same Playwright Ubuntu family used by CI.

**Tech Stack:** React 18/19, TypeScript 6, Vitest, Testing Library, Vite, Playwright 1.58.2, Node 24/npm 11.

**Spec:** `docs/superpowers/specs/2026-09-04-react-swipe-actions-design.md`

## Global Constraints

- Keep `npm run check` browser-free; browser installation and execution remain separate.
- Preserve React peer support `^18.3.0 || ^19.0.0` and zero runtime dependencies.
- Keep public state logical (`leading`/`trailing`) and support LTR and RTL.
- Keep exports limited to `.`, `./core.css`, `./theme.css`, `./styles.css`, and `./package.json`.
- Do not publish or push; release verification is dry-run only.

---

### Task 1: Browser-free quality gate and workflow ordering

**Files:** Modify `scripts/verify-website.mjs`, create `scripts/verify-website-browser.mjs`, modify `package.json`, `scripts/verify-clean-check.test.mjs`, `scripts/verify-workflows.test.mjs`, `.github/workflows/browser.yml`, and `.github/workflows/release.yml`.

**Interfaces:** `verify:website` performs source/build inspection without launching a browser; `verify:website:browser` owns live layout, interaction, and axe validation.

- [ ] Add policy tests asserting `check` excludes the live script, a clean snapshot supplies an empty browser path, and workflow install steps precede live website validation.
- [ ] Run the focused Node tests and capture the expected failures.
- [ ] Split validation and update scripts/workflows.
- [ ] Run the focused tests and an empty-cache `npm ci && npm run check` to green.

### Task 2: Release intent and open-side resistance

**Files:** Modify `test/gesture/intent.test.ts`, `test/components/full-swipe.test.tsx`, `test/motion/resistance.test.ts`, `src/gesture/intent.ts`, `src/gesture/controller.ts`, and `src/motion/resistance.ts`.

**Interfaces:** `resolveRelease` consumes both absolute `offset` and signed `pointerDisplacement`; `applyResistance` consumes `startOffset` and `restingSide`.

- [ ] Add LTR/RTL default-open regressions proving 13px fast extension cannot activate and 48px genuine travel can.
- [ ] Add pure resistance regressions for crossing from each open side in LTR and RTL.
- [ ] Run focused tests and capture failures against absolute-offset/full-speed crossing behavior.
- [ ] Pass pointer-session displacement/resting facts and implement the minimum travel/crossing gate.
- [ ] Re-run focused tests to green.

### Task 3: Intent arbitration

**Files:** Modify `test/gesture/intent.test.ts`, `test/components/pointer.test.tsx`, `e2e/gestures.spec.ts`, `src/gesture/intent.ts`, and `docs/architecture.md`.

**Interfaces:** Near-diagonal movement beyond the dead zone stays pending until an explicit decision distance; a tie at that boundary deterministically yields vertical.

- [ ] Add pure/component regressions for pending near-diagonal movement, later decisive horizontal ownership, and vertical tie ownership.
- [ ] Capture RED, implement the decision boundary, and capture GREEN.

### Task 4: Group commit timing

**Files:** Modify `test/components/group.test.tsx`, `src/components/context.ts`, `src/components/group.tsx`, `src/components/root.tsx`, and `src/gesture/controller.ts`.

**Interfaces:** Gesture controller reports `beginOpening(side)` on an open release before settle; root deduplicates coordination while controlled state remains authoritative.

- [ ] Add integration tests proving the old row stays open during drag, closes at release/settle start, and receives one close request for controlled and uncontrolled successors.
- [ ] Capture RED, add the committed-opening callback and root coordination, then capture GREEN.

### Task 5: Theme motion contract

**Files:** Modify `scripts/check-css-contract.test.mjs`, `scripts/check-css-contract.mjs`, `src/styles/theme.css`, and add a styles.css browser fixture/test under `e2e/`.

**Interfaces:** Theme CSS must not transition `transform`; direct drag writes remain the visible coordinate.

- [ ] Add a validator rejection fixture and a real-browser direct-motion regression.
- [ ] Capture validator RED, remove the transform transition, strengthen validation, and run focused Node/browser tests to green.

### Task 6: SSR timing and package consumers

**Files:** Create `src/utils/use-isomorphic-layout-effect.ts`; modify layout-effect consumers, `test/components/ssr.test.tsx`, `test/package/fixtures/ssr/index.mjs`, and `scripts/verify-package.mjs`.

**Interfaces:** Server uses a passive effect without warnings; browser uses a layout effect; packed SSR lanes render and hydrate with empty stderr.

- [ ] Add SSR stderr/hydration assertions that fail with React 18's server layout-effect warning.
- [ ] Implement and adopt the isomorphic effect helper.
- [ ] Run component and both packed React lanes to green.

### Task 7: Composition warnings

**Files:** Modify `test/components/actions.test.tsx`, `src/components/content.tsx`, and `src/components/side.tsx`.

**Interfaces:** Standalone Content and each Side emit one actionable development warning per component kind.

- [ ] Add deduplication regressions, capture RED, add warnings, and capture GREEN.

### Task 8: Declaration bundle and Vite consumer

**Files:** Modify `package.json`, `package-lock.json`, `scripts/verify-package.mjs`, `scripts/package-files.json`, and create `test/package/fixtures/vite/*`.

**Interfaces:** The tarball ships `dist/index.d.ts` as its single declaration file and an isolated Vite consumer imports JS and `styles.css`.

- [ ] Add package assertions for one declaration artifact and a built Vite fixture; capture RED.
- [ ] Add dev-only declaration bundling tooling, update the build and allowlist, and capture GREEN for React 18/19 plus Vite.

### Task 9: Linux visuals, docs, and budgets

**Files:** Add Linux images under `e2e/visual.spec.ts-snapshots`; modify `README.md`, `CHANGELOG.md`, `docs/RELEASING.md`, `docs/architecture.md`, styling/interaction guides, website content, `scripts/size-budget.json`, and release evidence.

**Interfaces:** Ubuntu Playwright projects resolve native Linux baselines; documented styling/state and release automation match shipped behavior; every capped artifact retains 10–15% headroom.

- [ ] Generate Linux baselines using Playwright 1.58.2's Ubuntu 24.04 (Noble) image and validate them there without comparing them to Darwin.
- [ ] Correct release, SSR, arbitration, grouping, resistance, variables, and attributes documentation.
- [ ] Measure final artifacts, round budgets upward to 10–15% margin, and record exact values/rationale.

### Task 10: Final verification and report

**Files:** Create `.superpowers/sdd/2026-09-04-react-swipe-actions-implementation/final-fix-report.md` and update `docs/release-readiness/0.1.0-alpha.0.md`.

**Interfaces:** Evidence records exact commands, exit results, platform constraints, RED/GREEN observations, final inventory, and sizes.

- [ ] Run focused regressions, clean-cache install/check, package lanes, three-browser e2e/live website, Linux visual validation, workflow policy/actionlint, and release dry run.
- [ ] Inspect git diff/status, write exact evidence, format-check the report, and commit all changes without publishing.
