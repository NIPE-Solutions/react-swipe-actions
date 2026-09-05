# Contributing

Issues and pull requests are welcome for reproducible defects, documentation,
tests, and focused improvements to the public contract. The package is in an
alpha phase; discuss a new public API or broad interaction model before writing
an implementation.

## Local setup

Development and release automation use Node.js 24 (`>=24 <25`) and npm 11.19.0.
Install the committed dependency tree with:

```bash
npm ci
```

Run the practical quality gate before requesting review:

```bash
npm run check
```

Browser coverage is separate because Playwright browsers are not installed by
`npm ci`:

```bash
npx playwright install chromium firefox webkit
npm run test:e2e
```

`npm run check` includes formatting, linting, type checking, unit tests,
package/API/size checks, the website build, and website verification. It does
not install or run the browser matrix.

## Working conventions

- Read [the architecture](docs/architecture.md) and the relevant guide before
  changing gesture, accessibility, CSS, or package behavior.
- Keep a change focused. Add or update source-aware tests when a public or
  observable behavior changes.
- Use logical `leading` and `trailing` terminology in API discussions and
  evidence. Physical directions are browser behavior, not public state.
- Include documentation updates when the exported API, CSS contract, browser
  policy, or limitations change.
- No Changesets integration is configured for this alpha. Describe the
  user-visible changelog entry in the pull request; maintainers update
  [CHANGELOG.md](CHANGELOG.md) when preparing a release.

## Review evidence

For gesture changes, include a minimal reproduction and the browser, browser
version, operating system, pointer type, direction, and scroll/container setup.
State whether the result came from automated coverage, a real device, or both.
For accessibility changes, include keyboard focus-order and assistive-technology
evidence where applicable. Do not treat a desktop browser run as evidence for a
mobile browser back-edge gesture.

Use the issue forms for public reports. Follow the [security policy](SECURITY.md)
instead of opening a public issue for a vulnerability.

## Support and triage

Use the [public issue forms](https://github.com/NIPE-Solutions/react-swipe-actions/issues/new/choose)
for reproducible defects and focused requests. Maintainers triage reports on a
best-effort basis; an issue is not a support-service agreement. Include the
requested environment and interaction evidence so another contributor can
reproduce it.
