# Final Review Fix Wave Report

Date: 2026-09-04  
Implementation commit: `306ab64 fix: close final alpha review gaps`  
Scope: all critical, important, and minor findings in the final review  
Result: complete; no package was pushed or published

## Outcome

The quality gate is browser-free, Linux and Darwin visual snapshots are
platform-specific, full-swipe activation measures actual pointer travel, and
open-side crossing now has an opposite-side gate. Theme CSS no longer
interpolates JavaScript motion. React 18/19 packed consumers prove warning-free
SSR and hydration. Group ownership transfers at the committed opening boundary.
Declarations are bundled into one public file and a packed Vite consumer passes.

The public runtime/type API remains unchanged at 7 runtime exports and 9 public
types. The package still declares zero runtime dependencies.

## Finding resolutions and TDD evidence

### Critical 1: fresh-runner quality gate required a browser cache

Resolution:

- Split source/build inspection into `scripts/verify-website-static.mjs` and
  retained Chromium/axe/rendered interaction checks in
  `scripts/verify-website.mjs`.
- `verify:website` is now static and remains in `check`;
  `verify:website:browser` is the live gate.
- Chromium browser CI builds the site and runs the live gate only after its
  Playwright install. Release verification does the same after all three engine
  installs.
- Workflow tests reject a live browser command in `check` and reject either
  workflow ordering the live check before installation.
- The tracked-snapshot clean regression supplies an empty
  `PLAYWRIGHT_BROWSERS_PATH` and verifies that it remains empty.

Files:

- `package.json`
- `scripts/verify-website-static.mjs`
- `scripts/verify-clean-check.test.mjs`
- `scripts/verify-workflows.test.mjs`
- `.github/workflows/browser.yml`
- `.github/workflows/release.yml`
- `eslint.config.js`

RED:

```sh
node --test scripts/verify-workflows.test.mjs
node --test scripts/verify-clean-check.test.mjs
```

The first regression run reported 11 passed and 9 failed because the split
command and install-before-live-check ordering did not exist. The clean snapshot
then failed when the old `verify:website` tried to launch Chromium from the
empty cache.

During the final clean proof, the harness also exposed two induced failures:
it first tried to copy the intentionally deleted
`scripts/fix-declaration-imports.mjs`; after honoring tracked deletions, it
correctly rejected three declaration-bundler warning lines on stderr. The build
now uses the bundler's `--silent` flag, preserving error failures without noisy
stderr.

GREEN:

```text
test:workflows: 21 passed, 0 failed
test:clean-check: 1 passed, 0 failed (19.9 s in the final nested run)
Website structure verified (24 sections, 14 examples, public package imports, production assets)
EMPTY_BROWSER_CACHE_OK=/tmp/react-swipe-actions-browser-cache.H0Fm1l
```

The outer proof was the literal `npm ci && npm run check` with the empty cache;
it exited 0.

### Critical 2: Linux visual baselines were missing

Resolution:

- Added 15 Linux snapshots: five canonical states for Chromium, Firefox, and
  WebKit.
- Generated and rechecked them with the pinned Playwright 1.58.2 Ubuntu 24.04
  Noble image under `--platform linux/amd64`, matching GitHub-hosted Ubuntu
  runner architecture.
- Added a workflow-policy regression requiring the exact complete Linux
  inventory. Darwin snapshots remain separate; no cross-platform identity is
  assumed.

Files:

- `e2e/visual.spec.ts-snapshots/*-linux.png` (15 files)
- `scripts/verify-workflows.test.mjs`

RED:

The pre-fix inventory contained 15 `*-darwin.png` files and zero
`*-linux.png` files. Playwright therefore had no names matching Ubuntu's
`<state>-<project>-linux.png` lookup.

GREEN:

```text
mcr.microsoft.com/playwright:v1.58.2-noble
Ubuntu 24.04, x86_64, Node v24.13.0, Playwright 1.58.2
generation run: 15 passed (40.5 s)
comparison-only run: 15 passed (38.1 s)
```

The image digest was
`sha256:6446946a1d9fd62d9ae501312a2d76a43ee688542b21622056a372959b65d63d`.

### Critical 3: default-open offset bypassed full-swipe travel safety

Resolution:

- `ReleaseInput` now carries `offset` and `pointerDisplacement` separately.
- The 15% full-swipe minimum uses signed directional pointer displacement only;
  the resting 96 px offset is not eligible travel.
- The controller calculates displacement from the session pointer origin.
- Added pure and component coverage for default-open trailing rows in LTR and
  RTL: 13 px at maximum projected velocity does not invoke; a genuine 48 px
  displacement on a 320 px row may invoke.

Files:

- `src/gesture/intent.ts`
- `src/gesture/controller.ts`
- `test/gesture/intent.test.ts`
- `test/components/full-swipe.test.tsx`

RED:

The first five-file gesture/motion run had 8 failing regressions among 69 tests.
After separating displacement at the resolver boundary, two component cases
still failed because the controller had not yet forwarded the real pointer
delta; both 13 px default-open cases invoked incorrectly.

GREEN:

```text
5 focused files passed
69 tests passed, 0 failed
```

### Important 1: theme transform transition fought direct motion

Resolution:

- Removed the content `transform` transition and its reduced-motion selector
  from `theme.css`.
- The CSS AST validator rejects `transition` and `transition-property` values
  containing either `transform` or `all`.
- Added a dedicated browser fixture importing combined `styles.css`; it checks
  zero transform transition duration and equality between computed translation
  and the root's JavaScript-written offset during a live drag.

Files:

- `src/styles/theme.css`
- `scripts/check-css-contract.mjs`
- `scripts/check-css-contract.test.mjs`
- `e2e/theme-app/*`
- `e2e/theme.spec.ts`

RED:

The new CSS regression produced 1 failure in the four-test CSS suite because the
validator allowed `transition: transform 180ms ease-out`. The browser behavior
fixture had no ready route before its fixture files were added.

GREEN:

```text
CSS contract: 4 passed, 0 failed
Chromium theme behavior: 1 passed, 0 failed
Full browser matrix: the theme behavior passed in all 3 projects
```

### Important 2: React 18 server layout-effect warnings

Resolution:

- Added an SSR-safe isomorphic layout effect and used it in Root, Content, Side,
  Action, and measurement effects. Client module evaluation still selects
  `useLayoutEffect`; server evaluation selects `useEffect`.
- Expanded the packed SSR fixture to render a default-open leading side inside
  RTL, hydrate it in jsdom, and assert open state, focusability, and no
  recoverable hydration errors.
- Both React lanes now retain the SSR subprocess result and assert `stderr ===
  ''` plus the explicit success marker.

Files:

- `src/utils/use-isomorphic-layout-effect.ts`
- `src/components/root.tsx`, `content.tsx`, `side.tsx`, and `action.tsx`
- `src/components/measurement.ts`
- `test/package/fixtures/ssr/index.mjs`
- `scripts/verify-package.mjs`

RED:

`npm run test:package` failed in the React 18 lane with repeated
`useLayoutEffect does nothing on the server` stderr. Strengthening teardown then
exposed Node 24's read-only `navigator` descriptor and one queued React 19
scheduler callback after globals were restored; descriptor-safe restoration and
one `setImmediate` drain resolved those fixture defects.

GREEN:

```text
React 18.3.1: ESM, CJS, types, SSR passed
React 19.2.8: ESM, CJS, types, SSR, and Vite passed
```

Both SSR subprocess stderr values were exactly empty.

### Important 3: Group closed peers only after settle

Resolution:

- Added a `beginOpening` controller boundary and notify Group immediately when
  release commits to an ordinary open target, before setting the settling phase.
- Retained Group's idempotent ownership registry, so the later semantic open
  effect cannot close a peer twice.
- Integration tests use real Roots and a controlled frame loop. They assert the
  old row remains open during drag, closes at pointer release while the new row
  is settling, remains closed after settle, and receives exactly one close
  request.
- A controlled successor is explicit: it closes the previous row at the same
  commit boundary, requests `leading` once when settle completes, and remains
  visually closed when its prop remains `null`.

Files:

- `src/gesture/controller.ts`
- `src/components/root.tsx`
- `test/components/group.test.tsx`

RED:

```text
test/components/group.test.tsx: 3 passed, 2 failed
```

Both new integration tests observed the original first row still open at the
start of the successor's settle.

GREEN:

```text
test/components/group.test.tsx: 5 passed, 0 failed
```

### Important 4: no bounded opposite-side region after crossing closed

Resolution:

- Resistance input now receives `startOffset` and `restingSide`; the pointer
  session captures both.
- When a gesture begins on its actual resting open side and crosses zero, it
  consumes a gate equal to `min(restingWidth × 0.25, rowWidth × 0.15)` before
  revealing the opposite side. The gate is bounded and applies only to an
  initially open crossing.
- Added the full logical/physical matrix: leading and trailing in both LTR and
  RTL.

Files:

- `src/motion/resistance.ts`
- `src/gesture/controller.ts`
- `test/motion/resistance.test.ts`

RED:

These cases contributed four failures to the initial eight-failure focused run:
the old pure function returned immediate opposite-signed movement rather than
`0` inside the gate and ±8 px beyond it.

GREEN:

```text
test/motion/resistance.test.ts: all cases passed
LTR/RTL × leading/trailing crossing matrix: 4 passed
```

### Minor 1: animator interruption assertion was incomplete

Resolution:

- Converted the interruption regression to async.
- Captured the visible coordinate before restart and asserted the animator's
  restart coordinate equals it.
- Asserted the first promise resolves canceled, the second resolves completed,
  intermediate writes move from the captured coordinate, and the final value is
  exactly 100.

File: `test/motion/animator.test.ts`

RED was an assertion-coverage gap rather than a reproduced runtime defect: the
old test discarded both promises and only checked a broad intermediate range.
The strengthened test passed against the existing generation-safe animator and
remains green in the 184-test unit suite.

### Minor 2: near-diagonal intent resolved too early

Resolution:

- Added the explicit 18 px diagonal decision distance.
- Near-diagonal motion beyond 6 px remains pending. A later 1.2× horizontal or
  vertical move wins; unresolved motion reaching the decision boundary receives
  the deterministic vertical bias.
- Updated unit, component, browser, architecture, and interaction-guide
  expectations.

Files:

- `src/gesture/intent.ts`
- `test/gesture/intent.test.ts`
- `test/components/pointer.test.tsx`
- `e2e/gestures.spec.ts`
- `docs/architecture.md`
- `docs/guides/interaction-accessibility.md`

RED: the new near-diagonal component/browser path stayed permanently vertical
under the old classifier instead of remaining pending for the later decisive
horizontal move. It was part of the initial eight-failure focused run.

GREEN: unit/component focused tests passed, and both new browser cases passed in
Chromium, Firefox, and WebKit.

### Minor 3: no isolated Vite consumer and fragmented declarations

Resolution:

- Added dev-only `dts-bundle-generator@9.5.1` and replaced the multi-file
  TypeScript declaration tree/postprocessor with one checked public
  `dist/index.d.ts`.
- Removed the obsolete declaration-import fixer and shrank the strict artifact
  allowlist from 27 files to 10.
- Added a Vite 8.2.2 fixture copied into the isolated React 19 consumer. It
  builds from the packed tarball, imports `styles.css` through the exports map,
  and must emit a CSS asset.

Files:

- `package.json`, `package-lock.json`
- `scripts/package-files.json`
- `scripts/verify-package.mjs`
- `scripts/fix-declaration-imports.mjs` (removed)
- `test/package/verify-package.test.mjs`
- `test/package/fixtures/vite/*`

RED:

```sh
node --test --test-name-pattern="distribution bundles declarations" test/package/verify-package.test.mjs
```

The declaration inventory deep-equality failed because private implementation
`.d.ts` files were present instead of only `index.d.ts`. Before the fixture was
added, the packed verifier also had no Vite configuration to execute.

GREEN:

```text
distribution bundles declarations into its public entrypoint: passed
React 19.2.8: ESM, CJS, types, SSR, and Vite passed
Packed package verification passed (10 files, 23688 bytes)
```

Bundling was not harmful: the 2,628-byte declaration passes NodeNext consumers,
the 16-export API checker, and private-reference rejection.

### Minor 4: size budgets lacked 10–15% headroom

Resolution:

- Rebuilt the final artifact and reset rounded ceilings to 10–15% actual-growth
  capacity.

File: `scripts/size-budget.json`

RED measurement with the prior budgets:

```text
esmBytes: actual=32439 budget=35000 delta=+2561       (7.9%)
esmGzipBytes: actual=9656 budget=10500 delta=+844     (8.7%)
tarballBytes: actual=23684 budget=25000 delta=+1316   (5.6%)
```

GREEN final measurement after the four-byte `--silent` package-script change:

```text
esmBytes: actual=32439 budget=36500 delta=+4061       (12.5%)
esmGzipBytes: actual=9656 budget=10800 delta=+1144    (11.8%)
coreCssBytes: actual=2248 budget=2500 delta=+252      (11.2%)
themeCssBytes: actual=1228 budget=1400 delta=+172     (14.0%)
tarballBytes: actual=23688 budget=26500 delta=+2812   (11.9%)
React externalization verified
```

Percentages are `(budget - actual) / actual`; ceilings are rounded to 100 or
500 bytes rather than fitted to the exact build.

### Minor 5: Content and sides failed silently outside Root

Resolution:

- Added actionable development warnings for `Content`, `Leading`, and
  `Trailing` outside `Root`.
- Each warning has a stable unique key and uses the existing process-wide
  `warnOnce` deduplicator.
- Updated the existing Action nesting expectation because a malformed standalone
  side and its action now correctly diagnose two distinct problems.

Files:

- `src/components/content.tsx`
- `src/components/side.tsx`
- `test/components/context-warnings.test.tsx`
- `test/components/actions.test.tsx`

RED:

```text
test/components/context-warnings.test.tsx: 0 passed, 3 failed
```

GREEN:

```text
actions + context warnings + SSR: 15 passed, 0 failed
```

### Minor 6: stale release, SSR, and styling documentation

Resolution:

- README and architecture now state that SSR reflects matching controlled or
  default open state, rather than always starting closed.
- Releasing guidance names the existing `.github/workflows/release.yml` and no
  longer describes automation as future work.
- Website and styling docs now include `--swipe-actions-action-width`,
  `data-full-swipe`, and `data-disabled`.
- Architecture and interaction docs cover true full-swipe displacement,
  diagonal decision timing, opposite-side resistance, early Group coordination,
  isomorphic effects, and the no-transform-transition contract.
- `CHANGELOG.md` records the behavior, SSR, packaging, visual, and quality-gate
  fixes.

Files:

- `README.md`, `CHANGELOG.md`
- `docs/RELEASING.md`, `docs/architecture.md`
- `docs/guides/interaction-accessibility.md`
- `docs/guides/styling-and-containers.md`
- `website/src/main.tsx`
- `test/package/verify-package.test.mjs`

RED:

```text
public documentation matches the SSR and release automation contracts: failed
website documents every stable CSS hook named by the design: failed
2 tests, 0 passed, 2 failed
```

GREEN:

```text
2 tests, 2 passed, 0 failed
```

## Final verification matrix

### Focused regressions

```sh
npx vitest run test/gesture/intent.test.ts test/motion/resistance.test.ts \
  test/motion/animator.test.ts test/components/full-swipe.test.tsx \
  test/components/pointer.test.tsx test/components/group.test.tsx \
  test/components/context-warnings.test.tsx test/components/actions.test.tsx \
  test/components/ssr.test.tsx
```

Result: 9 files passed, 89 tests passed.

The focused Node policy/package run reported 34 tests passed across CSS,
workflow, and package suites.

### Clean installation and practical check

```text
npm ci: added 214 packages, audited 215, 0 vulnerabilities
npm run check: exit 0
Vitest: 22 files, 184 passed
workflow policy: 21 passed
clean snapshot: 1 passed
package tests: 9 passed
public API: 16 exports
website static inventory: 24 sections, 14 examples
empty Playwright browser cache: unchanged and empty
```

### Live website and three browsers

```text
Website verified (24 sections, 14 examples, public package imports, desktop/mobile layout, live demo)
Playwright: 162 scheduled; 160 passed, 2 skipped, 0 failed (1.3 m)
```

The two skips are the documented Firefox/WebKit trusted continuous-touch driver
gap; their synthetic touch and all other tests passed.

### Linux visual validation

```text
Pinned Ubuntu 24.04 x86_64 generation: 15 passed
Fresh comparison-only container: 15 passed
```

### Workflow and release

```text
actionlint 1.7.12: exit 0, no diagnostics
release dry run at clean 306ab64: exit 0
Artifact inventory verified (10 files, 23688 bytes)
Registry version is available: 0.1.0-alpha.0
Release dry-run verification passed; nothing was published
```

### Fresh performance snapshot

At 100 / 1,000 rows: mount 51.5 / 437.0 ms; observers 500 / 5,000;
package window pointer listeners 0 / 0; idle rAF 0 / 0; group-transfer row
renders 2 / 2; drag p95 8.4 / 8.8 ms; post-interaction rAF 0 / 0.

## Exact artifact

`npm pack --json --dry-run` reported:

- Tarball: 23,688 bytes
- Unpacked: 75,357 bytes
- Entries: 10
- ESM: 32,439 bytes; gzip level 9: 9,656 bytes
- CJS: 25,674 bytes
- Bundled declaration: 2,628 bytes
- Core/theme/aggregate CSS: 2,248 / 1,228 / 45 bytes
- shasum: `0d611ef77840e4c3d39dcd60d3f28a4c837e4247`
- integrity:
  `sha512-AiJiF47Whkn1iSl32eu3qpTojl6KdAmW3znwky20V31itlzfvePFxIbsICcmR6qx7Y08lHFOukuww9OlzVbKZw==`

The allowlist is `CHANGELOG.md`, `LICENSE`, `README.md`, four distribution
entry files (`index.js`, `index.cjs`, `index.d.ts`, and `styles.css`), the two
individual CSS files, and `package.json`.

## Limitations and concerns

- The pinned Playwright Noble image carries Node v24.13.0, which produces an
  `EBADENGINE` install warning for jsdom 30.0.1's v24.15.0 floor. The Linux lane
  executed Playwright only, completed install, launched all three engines, and
  passed twice. CI itself configures Node 24 using `actions/setup-node`.
- Docker validation matches CI's Ubuntu release, x86_64 architecture, Playwright
  package, and browser image, but it does not claim that a local container is a
  GitHub-hosted runner execution. The committed platform naming is what
  Playwright resolves on CI.
- The existing two browser skips, physical-mobile/back-edge checks, real Bottom
  Sheet integration, assistive technology, actual Edge, npm trusted-publisher
  configuration, and GitHub workflow execution remain accurately documented in
  `docs/release-readiness/0.1.0-alpha.0.md`.
- `npm ci` still reports the two existing optional `fsevents` install scripts as
  unapproved; it reports 0 vulnerabilities.
- No push, publish, tag, release, or external-state mutation was performed.
