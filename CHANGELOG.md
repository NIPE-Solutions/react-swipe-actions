# Changelog

All notable changes are documented in this file.

## [0.1.0-alpha.1] - 2026-09-05

### Fixed

- Settle a previously open grouped row continuously from its current visual
  offset before committing the closed state, preventing handoff snaps and
  large-list flashes.

### Verified

- Added unit and Chromium, Firefox, and WebKit regressions for continuous Group
  handoff, including the 1,000-row performance fixture.

## [0.1.0-alpha.0] - 2026-09-05

### Added

- Compound React components for leading and trailing swipe actions.
- Core, optional theme, and combined stylesheet entrypoints.
- Controlled and uncontrolled open state, group coordination, keyboard access,
  RTL, SSR-safe imports, and browser interaction coverage.
- A documentation website with live examples, grouped navigation, release
  status, project/legal links, and complete search/social metadata.

### Fixed

- Require genuine directional pointer travel for velocity-assisted full-swipe
  activation, including rows that start open, and gate opposite-side reveal
  after crossing closed.
- Keep near-diagonal intent pending until a decisive boundary, coordinate groups
  at committed opening before settle, and preserve interruptible visible motion.
- Remove theme-level content transform transitions so presentation cannot fight
  direct gesture and settle writes.
- Use SSR-safe isomorphic layout effects, verify warning-free React 18 and 19
  hydration from packed consumers, and warn once when Content or side
  components are mounted outside Root.
- Keep the default quality gate browser-free, while running live website and axe
  checks only after browser installation in browser/release workflows.
- Ship Ubuntu-specific visual baselines and a single bundled declaration entry,
  with an isolated packed-tarball Vite consumer.
- Build the distribution before typechecking package self-imports, and verify
  the complete quality gate in a tracked snapshot with no stale `dist` output.
- Declared Node globals for the workflow-policy test so the clean lint gate
  covers its release-shell regressions.
- Corrected the interaction guide's RTL keyboard mapping and added a package
  regression that keeps physical arrow edges aligned with logical sides.
- Stabilized full-swipe arming with a small internal hysteresis band shared by
  visual state and release resolution, without adding a public tuning prop.
- Made the cross-browser fast-flick trace deterministic inside browser frames so
  protocol latency cannot turn the test's intended flick into a stale release.

### Verified

- Repeated pointer cancellation, capture loss, settling interruption, rapid
  swipes, resize, unmount, controlled changes, side removal, RTL, reduced
  motion, interactive descendants, vertical scrolling, Strict Mode, and
  multipointer handling during the final alpha audit.
- Verified Chromium, Firefox, and WebKit browser projects, accessibility scans,
  canonical screenshots, React 18/19 package consumers, bundle budgets, and the
  non-publishing release dry run.

### Limitations

- This prerelease does not publish list lifecycle features such as removal,
  undo, confirmation, async mutation state, or virtualization.
- Nested swipe roots, portals, `asChild`, React Native, and automatic list
  lifecycle ownership are outside the alpha scope.
- Physical Mobile Safari/Chrome Android back-edge behavior and real Bottom Sheet
  integrations remain manual checks; desktop automation is not evidence for
  either environment.
