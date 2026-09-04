# Changelog

All notable changes are documented in this file.

## [0.1.0-alpha.0] - Unreleased

### Added

- Compound React components for leading and trailing swipe actions.
- Core, optional theme, and combined stylesheet entrypoints.
- Controlled and uncontrolled open state, group coordination, keyboard access,
  RTL, SSR-safe imports, and browser interaction coverage.

### Fixed

- Build the distribution before typechecking package self-imports, and verify
  the complete quality gate in a tracked snapshot with no stale `dist` output.
- Declared Node globals for the workflow-policy test so the clean lint gate
  covers its release-shell regressions.
- Corrected the interaction guide's RTL keyboard mapping and added a package
  regression that keeps physical arrow edges aligned with logical sides.

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
