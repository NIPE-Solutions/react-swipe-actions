# Performance evidence

This document records measured evidence for the alpha package. It is not a claim
that every application or device will match these timings.

## Fixture

The production website build exposes:

```text
?fixture=performance&rows=100
?fixture=performance&rows=1000
```

It imports `@nipe-solutions/react-swipe-actions` and `core.css` through package
exports. Every row has one content layer, one leading action, one trailing action,
and belongs to one `Group`. Each instrumented row uses controlled open state and
increments a render counter in its component body. Fixture counters are available
on `window.__swipePerformance__`; no diagnostics are added to package exports.

## Environment and command

Measured at `2026-09-04T16:38:25.754Z` on macOS 14.6.1 (Apple M3 Max,
arm64), Node 24.20.0, npm 11.19.0, and headless Chromium 145.0.7632.6.
The viewport was 1440 × 1000.

```bash
npm run build:website
node scripts/measure-website-performance.mjs
```

## Results

| Metric | 100 rows | 1,000 rows |
| --- | ---: | ---: |
| Mount to second post-commit frame | 41.7 ms | 439.1 ms |
| Live `ResizeObserver` instances | 500 | 5,000 |
| Pending rAF callbacks after 250 ms idle | 0 | 0 |
| Package-attributed window pointer listeners | 0 | 0 |
| Initial controlled-row renders | 100 | 1,000 |
| Renders to open the first row | 1 | 1 |
| Renders to transfer group ownership | 2 | 2 |
| Pending rAF callbacks after interaction | 0 | 0 |

The browser automation harness itself installed two capture listeners on
`window` (`pointerdown` and `pointerup`). The measurement script used the Chrome
DevTools Protocol to inspect listener source and attribute both to Playwright's
`_setupHitTargetInterceptors`; neither came from the package bundle. The raw
count was therefore 2 and the package-attributed count was 0 for both fixtures.

## What each value means

- **Mount duration:** elapsed `performance.now()` from fixture module setup to the
  second animation frame after the initial React commit. It includes website
  script evaluation, React render/commit, layout, and two paint opportunities.
- **Idle rAF count:** pending callbacks in an instrumented
  `requestAnimationFrame` set after the fixture becomes ready and remains idle.
- **Global listener count:** live window listeners for `pointerdown`,
  `pointermove`, `pointerup`, and `pointercancel`.
- **Observer count:** live `ResizeObserver` instances. With one content, two
  sides, and two actions, the expected structural count is five per row.
- **Group-opening rerenders:** controlled row renders after opening the first
  row, then the delta while ownership transfers to the second row. The initial
  baseline is read before interaction, so mount renders are excluded.

## Drag-frame trace method

The run started a temporary page-level rAF sampler immediately before a real
12-step Playwright mouse drag of 118 px. Sampling continued through the library's
settle and stopped when the root reached `data-state="open"`. The 100-row trace
captured 28 deltas (median 8.3 ms, p95 9.1 ms, max 9.3 ms). The 1,000-row trace
captured 28 deltas (median 8.3 ms, p95 9.1 ms, max 9.2 ms).

Headless Chromium in this environment schedules near an 8.3 ms cadence. These
numbers describe cadence during the observed drag/settle interval; they do not
separate scripting, style, layout, and paint cost, and they are not a stable
frame-rate guarantee.

## Interpretation

Mount time and live measurement observers scale with the number of rendered
rows, as expected from the per-element measurement model. Idle animation work
and package-owned global pointer listeners remain zero at both list sizes. Group
coordination updates the newly opened row and, on transfer, the one previously
open row; it does not rerender the other 998 rows in the controlled fixture.

The 1,000-row fixture is evidence for behavior under a deliberately large fully
mounted DOM, not a recommendation to render every row. Applications should use
their list virtualizer when data size, row content, or device constraints make
full mounting expensive. No package optimization was made from this run because
the recorded scaling matches the documented architecture and no idle/global or
group-wide regression was observed.

## Manual checks not claimed by automation

No physical-device browser back-edge result is inferred from these desktop
measurements. Mobile Safari and Chrome Android edge ownership must be checked on
real devices and recorded separately. Bottom Sheet performance also depends on
the consuming sheet, scroll container, row content, and virtualization strategy.
