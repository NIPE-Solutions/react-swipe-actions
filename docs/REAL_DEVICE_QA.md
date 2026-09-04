# Real-device interaction QA

This checklist separates repeatable automation from physical-device evidence.
An unchecked manual item is pending, not an implied pass.

## Automated coverage

CI exercises Chromium, Firefox, and WebKit with real browser pointer sequences.
It covers horizontal intent, vertical-scroll arbitration, slow and fast release,
pause before release, direction reversal, full-swipe activation and cancellation,
re-grab during settle, group handoff, interactive children, keyboard disclosure,
RTL, reduced motion, resize, pointer cancellation, and accessibility scans.

Desktop browser automation cannot faithfully reproduce OS navigation-edge
gestures, device touch latency, orientation sensors, or assistive technology on
a physical phone. Those results must be recorded below by a person using the
named device and browser.

## Manual pending

Run every row on each available target:

| Check | iPhone Safari | Android Chrome | Desktop Chrome (mouse) | Desktop Safari |
| --- | :---: | :---: | :---: | :---: |
| Vertical list scroll remains natural | ☐ | ☐ | N/A | N/A |
| Slow reveal and release | ☐ | ☐ | ☐ | ☐ |
| Fast flick opens predictably | ☐ | ☐ | ☐ | ☐ |
| Open and close exposed actions | ☐ | ☐ | ☐ | ☐ |
| Full swipe invokes once | ☐ | ☐ | ☐ | ☐ |
| Arm, reverse, and cancel full swipe | ☐ | ☐ | ☐ | ☐ |
| Re-grab during settling has no jump | ☐ | ☐ | ☐ | ☐ |
| Opening another row closes the first | ☐ | ☐ | ☐ | ☐ |
| Links, buttons, checkboxes, and inputs still click | ☐ | ☐ | ☐ | ☐ |
| RTL sides and physical arrow keys behave correctly | ☐ | ☐ | ☐ | ☐ |
| Reduced-motion setting remains understandable | ☐ | ☐ | ☐ | ☐ |
| Orientation or viewport change preserves valid state | ☐ | ☐ | N/A | ☐ |
| Screen-edge back navigation is not trapped | ☐ | ☐ | N/A | N/A |

Also record the device model, OS version, browser version, page URL/commit, and
date. A failed item should include a short pointer trace and whether it reproduces
outside a nested scroll container.

## Manual verified

No physical-device run has been recorded for this release candidate yet.
