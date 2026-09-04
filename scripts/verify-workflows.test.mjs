import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { parse } from 'yaml'

const repositoryRoot = path.resolve(import.meta.dirname, '..')

async function readYaml(relativePath) {
  return parse(await readFile(path.join(repositoryRoot, relativePath), 'utf8'))
}

function stepsFor(job) {
  assert.ok(Array.isArray(job?.steps), 'job must define executable steps')
  return job.steps
}

function runCommands(job) {
  return stepsFor(job)
    .map((step) => step.run)
    .filter((command) => typeof command === 'string')
}

function assertPinnedActions(workflow) {
  for (const job of Object.values(workflow.jobs)) {
    for (const step of stepsFor(job)) {
      if (step.uses) {
        assert.match(
          step.uses,
          /^[\w.-]+\/[\w.-]+@v\d+$/,
          `${step.uses} must use an explicit major action version`,
        )
      }
    }
  }
}

function assertReadOnlyByDefault(workflow) {
  assert.deepEqual(workflow.permissions, { contents: 'read' })
}

function validateBrowserWorkflow(workflow) {
  assertReadOnlyByDefault(workflow)
  assertPinnedActions(workflow)
  assert.equal(workflow.concurrency['cancel-in-progress'], true)

  const browserNames = ['chromium', 'firefox', 'webkit']
  assert.deepEqual(Object.keys(workflow.jobs).sort(), browserNames)

  for (const browser of browserNames) {
    const job = workflow.jobs[browser]
    assert.equal(job['continue-on-error'], undefined)
    assert.equal(job.strategy, undefined, `${browser} must be an isolated job`)
    assert.ok(job['timeout-minutes'] <= 30)

    const steps = stepsFor(job)
    const setupNode = steps.find((step) =>
      step.uses?.startsWith('actions/setup-node@'),
    )
    assert.equal(String(setupNode?.with?.['node-version']), '24')
    assert.equal(setupNode?.with?.cache, 'npm')

    const browserCache = steps.find((step) =>
      step.uses?.startsWith('actions/cache@'),
    )
    assert.match(browserCache?.with?.path ?? '', /ms-playwright/)
    assert.match(browserCache?.with?.key ?? '', new RegExp(browser))

    const commands = runCommands(job)
    assert.ok(commands.includes('npm ci'))
    assert.ok(
      commands.some(
        (command) =>
          command.includes('playwright install --with-deps') &&
          command.includes(browser),
      ),
    )
    assert.ok(
      commands.includes(
        `npm run test:e2e -- --project=${browser} --reporter=line,html`,
      ),
    )

    const artifact = steps.find((step) =>
      step.uses?.startsWith('actions/upload-artifact@'),
    )
    assert.equal(artifact?.if, 'failure()')
    assert.match(artifact?.with?.name ?? '', new RegExp(browser))
    assert.match(artifact?.with?.path ?? '', /playwright-report/)
    assert.match(artifact?.with?.path ?? '', /test-results/)
    assert.equal(artifact?.with?.['if-no-files-found'], 'ignore')
    assert.ok(artifact?.with?.['retention-days'] <= 7)
  }
}

function validateReleaseWorkflow(workflow) {
  assertReadOnlyByDefault(workflow)
  assertPinnedActions(workflow)
  assert.deepEqual(workflow.on.release.types, ['published'])
  assert.equal(workflow.on.workflow_dispatch.inputs.confirm.type, 'boolean')
  assert.equal(workflow.on.workflow_dispatch.inputs.confirm.required, true)
  assert.equal(workflow.concurrency['cancel-in-progress'], false)

  const verify = workflow.jobs.verify
  const publish = workflow.jobs.publish
  assert.ok(verify)
  assert.ok(publish)
  assert.equal(verify.permissions, undefined)
  assert.deepEqual(publish.permissions, {
    contents: 'read',
    'id-token': 'write',
  })
  assert.equal(publish.needs, 'verify')
  assert.equal(publish.environment, 'release')
  assert.match(publish.if, /confirm/)

  const verifyCommands = runCommands(verify)
  assert.ok(verifyCommands.includes('npm ci'))
  assert.ok(verifyCommands.includes('npm run check'))
  assert.ok(
    verifyCommands.includes(
      'npx playwright install --with-deps chromium firefox webkit',
    ),
  )
  assert.ok(verifyCommands.includes('npm run test:e2e'))
  assert.ok(verifyCommands.includes('npm run release:check -- --dry-run'))

  const publishCommands = runCommands(publish)
  const releaseCheck = publishCommands.indexOf(
    'npm run release:check -- --dry-run',
  )
  const npmPublish = publishCommands.indexOf(
    'npm publish --provenance --access public --tag alpha',
  )
  assert.ok(releaseCheck >= 0)
  assert.ok(npmPublish > releaseCheck)

  const serialized = JSON.stringify(workflow)
  assert.doesNotMatch(serialized, /NODE_AUTH_TOKEN|NPM_TOKEN|secrets\./i)
}

test('quality workflow is a cancellable Node 24 npm gate', async () => {
  const workflow = await readYaml('.github/workflows/ci.yml')
  const packageJson = JSON.parse(
    await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
  )

  assertReadOnlyByDefault(workflow)
  assertPinnedActions(workflow)
  assert.equal(workflow.concurrency['cancel-in-progress'], true)
  assert.deepEqual(Object.keys(workflow.jobs), ['quality'])

  const quality = workflow.jobs.quality
  assert.ok(quality['timeout-minutes'] <= 20)
  const setupNode = stepsFor(quality).find((step) =>
    step.uses?.startsWith('actions/setup-node@'),
  )
  assert.equal(String(setupNode?.with?.['node-version']), '24')
  assert.equal(setupNode?.with?.cache, 'npm')
  assert.deepEqual(runCommands(quality), ['npm ci', 'npm run check'])
  assert.match(packageJson.scripts.check, /npm run test:workflows/)
  assert.doesNotMatch(packageJson.scripts.check, /release:check/)
})

test('browser workflow keeps Chromium, Firefox, and WebKit required and isolated', async () => {
  validateBrowserWorkflow(await readYaml('.github/workflows/browser.yml'))
})

test('browser policy rejects a best-effort WebKit job', async () => {
  const workflow = await readYaml('.github/workflows/browser.yml')
  workflow.jobs.webkit['continue-on-error'] = true

  assert.throws(
    () => validateBrowserWorkflow(workflow),
    /Expected values to be strictly equal/,
  )
})

test('release workflow gates OIDC publication behind complete verification', async () => {
  validateReleaseWorkflow(await readYaml('.github/workflows/release.yml'))
})

test('release policy rejects long-lived npm credentials', async () => {
  const workflow = await readYaml('.github/workflows/release.yml')
  workflow.jobs.publish.steps.at(-1).env = {
    NODE_AUTH_TOKEN: '${{ secrets.NPM_TOKEN }}',
  }

  assert.throws(
    () => validateReleaseWorkflow(workflow),
    /NODE_AUTH_TOKEN|NPM_TOKEN|secrets/,
  )
})

test('release policy rejects publication before release verification', async () => {
  const workflow = await readYaml('.github/workflows/release.yml')
  workflow.jobs.publish.steps.reverse()

  assert.throws(
    () => validateReleaseWorkflow(workflow),
    /false == true|The expression evaluated to a falsy value/,
  )
})

test('Dependabot updates npm and Actions monthly with grouped non-majors', async () => {
  const dependabot = await readYaml('.github/dependabot.yml')
  assert.equal(dependabot.version, 2)
  assert.equal(dependabot.updates.length, 2)

  const npm = dependabot.updates.find(
    (entry) => entry['package-ecosystem'] === 'npm',
  )
  const actions = dependabot.updates.find(
    (entry) => entry['package-ecosystem'] === 'github-actions',
  )
  assert.ok(npm)
  assert.ok(actions)

  for (const entry of [npm, actions]) {
    assert.equal(entry.directory, '/')
    assert.equal(entry.schedule.interval, 'monthly')
    assert.ok(entry['open-pull-requests-limit'] > 0)
    assert.ok(entry['open-pull-requests-limit'] <= 10)
    assert.match(entry['commit-message'].prefix, /^(chore|ci)\(deps\)$/)
  }

  assert.deepEqual(npm.groups['development-dependencies'], {
    'dependency-type': 'development',
    'update-types': ['minor', 'patch'],
  })
})

test('release metadata requires the approved prerelease identity and provenance', async () => {
  const { validateReleaseMetadata } = await import('./verify-release.mjs')
  const packageJson = {
    name: '@nipe-solutions/react-swipe-actions',
    version: '0.1.0-alpha.0',
    repository: {
      type: 'git',
      url: 'git+https://github.com/nipe-solutions/react-swipe-actions.git',
    },
    publishConfig: { access: 'public', provenance: true, tag: 'alpha' },
  }
  const changelog = '# Changelog\n\n## [0.1.0-alpha.0] - Unreleased\n'

  assert.deepEqual(validateReleaseMetadata(packageJson, changelog), {
    name: '@nipe-solutions/react-swipe-actions',
    version: '0.1.0-alpha.0',
    channel: 'alpha',
  })

  assert.throws(
    () =>
      validateReleaseMetadata({ ...packageJson, version: '0.1.0' }, changelog),
    /must be a semantic prerelease/,
  )
  assert.throws(
    () =>
      validateReleaseMetadata(
        { ...packageJson, version: '0.1.0-alpha.01' },
        changelog,
      ),
    /must be a semantic prerelease/,
  )
  assert.throws(
    () =>
      validateReleaseMetadata(
        { ...packageJson, publishConfig: { access: 'public' } },
        changelog,
      ),
    /provenance/,
  )
  assert.throws(
    () =>
      validateReleaseMetadata(
        {
          ...packageJson,
          publishConfig: { ...packageJson.publishConfig, tag: 'latest' },
        },
        changelog,
      ),
    /dist-tag.*alpha/,
  )
  assert.throws(
    () => validateReleaseMetadata(packageJson, '# Changelog\n'),
    /CHANGELOG\.md.*0\.1\.0-alpha\.0/,
  )
})

test('release artifact policy rejects unexpected packed files', async () => {
  const { validatePackedFiles } = await import('./verify-release.mjs')

  assert.doesNotThrow(() =>
    validatePackedFiles(
      ['dist/index.js', 'LICENSE'],
      ['LICENSE', 'dist/index.js'],
    ),
  )
  assert.throws(
    () =>
      validatePackedFiles(
        ['dist/index.js', 'dist/private.js', 'LICENSE'],
        ['dist/index.js', 'LICENSE'],
      ),
    /Unexpected packed files: dist\/private\.js/,
  )
})

test('local release dry-run reports feature branch and tracked dirtiness', async () => {
  const { validateRepositoryContext } = await import('./verify-release.mjs')

  assert.deepEqual(
    validateRepositoryContext({
      branch: 'feat/react-swipe-actions-alpha',
      dirtyEntries: [' M package.json', '?? scripts/verify-release.mjs'],
      dryRun: true,
      githubActions: false,
    }),
    [
      'Local dry-run: allowing 2 working-tree changes for inspection',
      'Local dry-run: running from feature branch feat/react-swipe-actions-alpha',
    ],
  )
})

test('GitHub release verification rejects dirty or mismatched refs', async () => {
  const { validateRepositoryContext } = await import('./verify-release.mjs')
  const releaseContext = {
    branch: '',
    dirtyEntries: [],
    dryRun: true,
    githubActions: true,
    eventName: 'release',
    refName: 'v0.1.0-alpha.0',
    refType: 'tag',
    version: '0.1.0-alpha.0',
  }

  assert.deepEqual(validateRepositoryContext(releaseContext), [])
  assert.throws(
    () =>
      validateRepositoryContext({
        ...releaseContext,
        dirtyEntries: [' M package.json'],
      }),
    /tracked state must be clean/,
  )
  assert.throws(
    () =>
      validateRepositoryContext({
        ...releaseContext,
        refName: 'v0.1.0-alpha.1',
      }),
    /must match package version/,
  )
})

test('release registry policy rejects an existing package version', async () => {
  const { assertRegistryVersionAbsent } = await import('./verify-release.mjs')

  assert.doesNotThrow(() =>
    assertRegistryVersionAbsent(undefined, '0.1.0-alpha.0'),
  )
  assert.throws(
    () => assertRegistryVersionAbsent('0.1.0-alpha.0', '0.1.0-alpha.0'),
    /already exists on the npm registry/,
  )
})
