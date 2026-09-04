import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import { parse } from 'yaml'

const execFileAsync = promisify(execFile)
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
    const installIndex = commands.findIndex(
      (command) =>
        command.includes('playwright install --with-deps') &&
        command.includes(browser),
    )
    assert.notEqual(installIndex, -1)
    const websiteBrowserIndex = commands.indexOf(
      'npm run verify:website:browser',
    )
    if (browser === 'chromium') {
      assert.ok(
        websiteBrowserIndex > installIndex,
        'live website Chromium/axe validation must follow browser installation',
      )
    } else {
      assert.equal(
        websiteBrowserIndex,
        -1,
        'the Chromium-only website check must not run in other engine jobs',
      )
    }
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
  assert.equal(
    workflow.concurrency.group,
    'npm-nipe-solutions-react-swipe-actions-alpha',
  )
  assert.doesNotMatch(workflow.concurrency.group, /github\.(ref|sha)/)
  assert.equal(workflow.concurrency['cancel-in-progress'], false)

  const verify = workflow.jobs.verify
  const publish = workflow.jobs.publish
  assert.ok(verify)
  assert.ok(publish)
  assert.equal(verify.permissions, undefined)
  assert.deepEqual(publish.permissions, { 'id-token': 'write' })
  assert.equal(publish.needs, 'verify')
  assert.equal(publish.environment, 'release')
  assert.equal(
    publish.if,
    "github.event_name == 'release' || (github.event_name == 'workflow_dispatch' && inputs.confirm == true)",
  )

  const verifyCommands = runCommands(verify)
  assert.ok(verifyCommands.includes('npm ci'))
  assert.ok(verifyCommands.includes('npm run check'))
  const installIndex = verifyCommands.indexOf(
    'npx playwright install --with-deps chromium firefox webkit',
  )
  assert.notEqual(installIndex, -1)
  const websiteBrowserIndex = verifyCommands.indexOf(
    'npm run verify:website:browser',
  )
  assert.ok(
    websiteBrowserIndex > installIndex,
    'release live website Chromium/axe validation must follow browser installation',
  )
  assert.ok(verifyCommands.includes('npm run test:e2e'))
  assert.ok(
    verifyCommands.includes(
      'npm run release:check -- --dry-run --output release-artifact',
    ),
  )
  assert.deepEqual(verify.outputs, {
    tarball: '${{ steps.release.outputs.tarball }}',
    channel: '${{ steps.release.outputs.channel }}',
  })

  const releaseStep = stepsFor(verify).find((step) => step.id === 'release')
  const uploadStep = stepsFor(verify).find((step) =>
    step.uses?.startsWith('actions/upload-artifact@'),
  )
  assert.ok(releaseStep)
  assert.ok(uploadStep)
  assert.ok(
    stepsFor(verify).indexOf(uploadStep) >
      stepsFor(verify).indexOf(releaseStep),
  )
  assert.equal(uploadStep.with.name, 'npm-package-alpha')
  assert.equal(uploadStep.with.path, 'release-artifact')
  assert.equal(uploadStep.with['if-no-files-found'], 'error')
  assert.ok(uploadStep.with['retention-days'] <= 3)

  const publishSteps = stepsFor(publish)
  const publishCommands = runCommands(publish)
  assert.equal(
    publishSteps.some((step) => step.uses?.startsWith('actions/checkout@')),
    false,
  )
  const setupNode = publishSteps.find((step) =>
    step.uses?.startsWith('actions/setup-node@'),
  )
  assert.equal(String(setupNode?.with?.['node-version']), '24')
  assert.equal(setupNode?.with?.cache, undefined)
  assert.equal(setupNode?.with?.['registry-url'], 'https://registry.npmjs.org')

  const downloadStep = publishSteps.find((step) =>
    step.uses?.startsWith('actions/download-artifact@'),
  )
  assert.equal(downloadStep?.with?.name, 'npm-package-alpha')
  assert.equal(downloadStep?.with?.path, 'release-artifact')

  const protectedStep = publishSteps.at(-1)
  assert.equal(
    protectedStep.name,
    'Validate and publish verified artifact',
    'validated npm publish must be the final privileged step',
  )
  assert.deepEqual(protectedStep.env, {
    RELEASE_TARBALL: '${{ needs.verify.outputs.tarball }}',
    RELEASE_CHANNEL: '${{ needs.verify.outputs.channel }}',
  })
  assert.equal(publishCommands.length, 1)
  assert.doesNotMatch(
    protectedStep.run,
    /\$\{\{[^}]*needs\.[^}]*outputs/,
    'OIDC shell must not interpolate job outputs directly',
  )
  assert.match(protectedStep.run, /RELEASE_CHANNEL.*alpha/)
  assert.match(
    protectedStep.run,
    /nipe-solutions-react-swipe-actions-0\.1\.0-alpha\.0\.tgz/,
  )
  assert.match(protectedStep.run, /\^\[A-Za-z0-9\._-\]\+\$/)
  assert.match(protectedStep.run, /exactly one entry/)
  assert.match(protectedStep.run, /manifest filename/)
  assert.match(protectedStep.run, /sha512sum --check --strict --/)
  assert.match(
    protectedStep.run,
    /npm publish --ignore-scripts --provenance --access public --tag "\$RELEASE_CHANNEL" -- "\$RELEASE_TARBALL"/,
  )
  assert.equal(
    protectedStep.run.trimEnd().split('\n').at(-1),
    'npm publish --ignore-scripts --provenance --access public --tag "$RELEASE_CHANNEL" -- "$RELEASE_TARBALL"',
    'npm publish must be the final privileged command',
  )
  assert.doesNotMatch(
    publishCommands.join('\n'),
    /npm ci|npm run|npm pack|npx |node scripts\//,
  )

  const publishOccurrences = Object.values(workflow.jobs).flatMap((job) =>
    runCommands(job).flatMap(
      (command) => command.match(/\bnpm\s+publish\b/g) ?? [],
    ),
  )
  assert.equal(
    publishOccurrences.length,
    1,
    'workflow must contain exactly one npm publish command',
  )

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
  assert.match(packageJson.scripts.check, /npm run verify:website(?:\s|$)/)
  assert.doesNotMatch(
    packageJson.scripts.check,
    /verify:website:browser/,
    'the practical quality gate must not require a Playwright browser cache',
  )
  assert.ok(packageJson.scripts['verify:website:browser'])
  assert.doesNotMatch(packageJson.scripts.check, /release:check/)
})

test('browser workflow keeps Chromium, Firefox, and WebKit required and isolated', async () => {
  validateBrowserWorkflow(await readYaml('.github/workflows/browser.yml'))
})

test('Ubuntu CI has a complete platform-specific visual baseline set', async () => {
  const snapshotDirectory = path.join(
    repositoryRoot,
    'e2e/visual.spec.ts-snapshots',
  )
  const snapshots = await readdir(snapshotDirectory)
  const states = ['armed', 'closed', 'leading', 'rtl', 'trailing']
  const browsers = ['chromium', 'firefox', 'webkit']

  assert.deepEqual(
    snapshots.filter((file) => file.endsWith('-linux.png')).sort(),
    states.flatMap((state) =>
      browsers.map((browser) => `${state}-${browser}-linux.png`),
    ),
  )
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

test('release policy rejects direct job-output interpolation in OIDC shell', async () => {
  const workflow = await readYaml('.github/workflows/release.yml')
  workflow.jobs.publish.steps.at(-1).run +=
    '\necho "${{ needs.verify.outputs.tarball }}"'

  assert.throws(
    () => validateReleaseWorkflow(workflow),
    /must not interpolate job outputs directly/,
  )
})

test('release policy rejects a manual dispatch without explicit confirmation', async () => {
  const workflow = await readYaml('.github/workflows/release.yml')
  workflow.jobs.publish.if =
    "github.event_name == 'release' || github.event_name == 'workflow_dispatch'"

  assert.throws(
    () => validateReleaseWorkflow(workflow),
    /Expected values to be strictly equal/,
  )
})

test('release policy rejects dependency installation in the OIDC job', async () => {
  const workflow = await readYaml('.github/workflows/release.yml')
  workflow.jobs.publish.steps.splice(-1, 0, { run: 'npm ci' })

  assert.throws(
    () => validateReleaseWorkflow(workflow),
    /Expected values to be strictly equal|npm ci/,
  )
})

test('release policy rejects any extra npm publish command', async () => {
  const workflow = await readYaml('.github/workflows/release.yml')
  workflow.jobs.verify.steps.unshift({ run: 'npm publish --dry-run' })

  assert.throws(
    () => validateReleaseWorkflow(workflow),
    /exactly one npm publish command/,
  )
})

test('release policy rejects publication before the final privileged step', async () => {
  const workflow = await readYaml('.github/workflows/release.yml')
  const steps = workflow.jobs.publish.steps
  const checksumStep = steps.at(-2)
  steps[steps.length - 2] = steps.at(-1)
  steps[steps.length - 1] = checksumStep

  assert.throws(
    () => validateReleaseWorkflow(workflow),
    /final privileged step/,
  )
})

test('release policy rejects ref-scoped publication concurrency', async () => {
  const workflow = await readYaml('.github/workflows/release.yml')
  workflow.concurrency.group = 'release-${{ github.ref }}'

  assert.throws(
    () => validateReleaseWorkflow(workflow),
    /npm-nipe-solutions-react-swipe-actions-alpha/,
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
  const changelog = '# Changelog\n\n## [0.1.0-alpha.0] - 2026-09-05\n'

  assert.deepEqual(validateReleaseMetadata(packageJson, changelog), {
    name: '@nipe-solutions/react-swipe-actions',
    version: '0.1.0-alpha.0',
    channel: 'alpha',
  })

  assert.throws(
    () =>
      validateReleaseMetadata(
        packageJson,
        '# Changelog\n\n## [0.1.0-alpha.0] - Unreleased\n',
      ),
    /dated release entry/,
  )
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
    () =>
      validateReleaseMetadata(
        {
          ...packageJson,
          version: '0.1.0-beta.0',
          publishConfig: { ...packageJson.publishConfig, tag: 'beta' },
        },
        '# Changelog\n\n## [0.1.0-beta.0] - 2026-09-05\n',
      ),
    /0\.1 prereleases must use the alpha channel/,
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

test('release output mode preserves a named tarball with a verifiable checksum', async () => {
  const { parseArguments, writeArtifactChecksum } =
    await import('./verify-release.mjs')
  const directory = await mkdtemp(path.join(tmpdir(), 'release-output-test-'))
  const tarballPath = path.join(directory, 'package.tgz')

  try {
    await writeFile(tarballPath, 'abc')
    assert.deepEqual(
      parseArguments(['--dry-run', '--output', 'release-artifact']),
      { dryRun: true, outputDirectory: 'release-artifact' },
    )

    const checksum = await writeArtifactChecksum(tarballPath)
    assert.deepEqual(checksum, {
      digest:
        'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
      checksumPath: `${tarballPath}.sha512`,
    })
    assert.equal(
      await readFile(`${tarballPath}.sha512`, 'utf8'),
      `${checksum.digest}  package.tgz\n`,
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('protected release shell treats output mutation payloads only as data', async () => {
  const workflow = await readYaml('.github/workflows/release.yml')
  const protectedStep = workflow.jobs.publish.steps.at(-1)
  assert.deepEqual(protectedStep.env, {
    RELEASE_TARBALL: '${{ needs.verify.outputs.tarball }}',
    RELEASE_CHANNEL: '${{ needs.verify.outputs.channel }}',
  })

  const directory = await mkdtemp(path.join(tmpdir(), 'release-shell-test-'))
  const sentinel = path.join(directory, 'injection-ran')
  const payloads = [
    `$(touch ${sentinel})`,
    '../package.tgz',
    'package.tgz\nsecond-command',
    'package.tgz; touch injection-ran',
  ]

  try {
    for (const payload of payloads) {
      await assert.rejects(
        execFileAsync('bash', ['-c', protectedStep.run], {
          cwd: directory,
          env: {
            ...process.env,
            RELEASE_TARBALL: payload,
            RELEASE_CHANNEL: 'alpha',
          },
        }),
        (error) => {
          assert.match(error.stderr, /unsafe release tarball/i)
          return true
        },
      )
    }
    await assert.rejects(readFile(sentinel), { code: 'ENOENT' })

    await assert.rejects(
      execFileAsync('bash', ['-c', protectedStep.run], {
        cwd: directory,
        env: {
          ...process.env,
          RELEASE_TARBALL:
            'nipe-solutions-react-swipe-actions-0.1.0-alpha.0.tgz',
          RELEASE_CHANNEL: 'alpha\n$(touch injection-ran)',
        },
      }),
      (error) => {
        assert.match(error.stderr, /release channel must be alpha/i)
        return true
      },
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('protected release shell rejects extra or mismatched checksum entries', async () => {
  const workflow = await readYaml('.github/workflows/release.yml')
  const protectedStep = workflow.jobs.publish.steps.at(-1)
  const directory = await mkdtemp(path.join(tmpdir(), 'release-manifest-test-'))
  const artifactDirectory = path.join(directory, 'release-artifact')
  const tarball = 'nipe-solutions-react-swipe-actions-0.1.0-alpha.0.tgz'
  const digest =
    'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f'

  try {
    await mkdir(artifactDirectory)
    await writeFile(path.join(artifactDirectory, tarball), 'abc')
    const manifest = path.join(artifactDirectory, `${tarball}.sha512`)
    await writeFile(
      manifest,
      `${digest}  ${tarball}\n${digest}  duplicate.tgz\n`,
    )

    await assert.rejects(
      execFileAsync('bash', ['-c', protectedStep.run], {
        cwd: artifactDirectory,
        env: {
          ...process.env,
          RELEASE_TARBALL: tarball,
          RELEASE_CHANNEL: 'alpha',
        },
      }),
      (error) => {
        assert.match(error.stderr, /exactly one entry/i)
        return true
      },
    )

    await writeFile(manifest, `${digest}  other-package.tgz\n`)
    await assert.rejects(
      execFileAsync('bash', ['-c', protectedStep.run], {
        cwd: artifactDirectory,
        env: {
          ...process.env,
          RELEASE_TARBALL: tarball,
          RELEASE_CHANNEL: 'alpha',
        },
      }),
      (error) => {
        assert.match(error.stderr, /manifest filename/i)
        return true
      },
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
