# Releasing

This guide prepares a release; it does not authorize or perform publication.
Do not run a real `npm publish` from a local machine.

The sole historical exception is `0.1.0-alpha.0`: it was published
interactively from the exact verified tarball to create the package before npm
could accept its Trusted Publisher connection. Its GitHub release is excluded
from publication by an exact immutable tag guard. Do not reuse this bootstrap
procedure for later versions.

## Preconditions

- Use Node.js 24 and npm 11.19.0 with a clean, reviewed worktree.
- Confirm the intended version, prerelease tag, and matching unreleased entry
  in [CHANGELOG.md](../CHANGELOG.md).
- Confirm package metadata, exports, license, and repository links still match
  the [public API](../README.md) and [architecture](architecture.md).
- Review the current and previous browser-major policy in
  [architecture](architecture.md#browser-policy), including any manual
  mobile-edge and container evidence that automated desktop browsers cannot
  establish.

Install and run the quality evidence:

```bash
npm ci
npm run check
npx playwright install chromium firefox webkit
npm run test:e2e
```

## Inspect the artifact

Build and inspect the exact tarball contents before release automation uses it:

```bash
npm run build:dist
npm pack --json
tar -tf nipe-solutions-react-swipe-actions-0.1.0-alpha.2.tgz
npm publish --dry-run --provenance --access public
```

The dry run must report the intended package name, version, public access,
provenance setting, and only allowed files. Remove the locally created tarball
after inspection. The dry run is not a publication and does not replace the
trusted publisher check.

## Trusted publishing and provenance

Publication belongs only to the repository's protected GitHub Actions workflow
at `.github/workflows/release.yml`. npm Trusted Publishing is configured for
`NIPE-Solutions/react-swipe-actions`, workflow `release.yml`, and environment
`release`. The workflow uses an OIDC identity token
(`id-token: write`), runs the checks and artifact inspection first, and invokes
`npm publish --provenance --access public` only after approval.

OIDC trusted publishing means maintainers do not need a long-lived npm token in
their local environment or GitHub secrets. Never substitute a local token to
bypass a missing trusted-publisher configuration. Record the workflow run,
published version, provenance link, tarball inventory, browser evidence, and
any manual-device checks with the release record.

Each prerelease is published only after a maintainer explicitly approves the
release, confirms the protected environment and triggers the workflow. Until
then, this guide remains a review procedure and dry-run checklist.
