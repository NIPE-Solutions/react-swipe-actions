import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import console from 'node:console'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const repositoryRoot = path.resolve(import.meta.dirname, '..')
const expectedName = '@nipe-solutions/react-swipe-actions'
const expectedRepository =
  'git+https://github.com/nipe-solutions/react-swipe-actions.git'
const semverPrerelease =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

export function validateReleaseMetadata(packageJson, changelog) {
  assert.equal(packageJson.name, expectedName, 'Unexpected package name')
  assert.deepEqual(
    packageJson.repository,
    { type: 'git', url: expectedRepository },
    'Unexpected package repository',
  )

  const match = semverPrerelease.exec(packageJson.version)
  assert.ok(
    match,
    `Package version ${packageJson.version} must be a semantic prerelease`,
  )
  const channel = match[4].split('.')[0]
  assert.match(
    changelog,
    new RegExp(
      `^## \\[${escapeRegExp(packageJson.version)}\\] - Unreleased$`,
      'm',
    ),
    `CHANGELOG.md must contain an Unreleased entry for ${packageJson.version}`,
  )
  assert.equal(
    packageJson.publishConfig?.access,
    'public',
    'publishConfig must enforce public access',
  )
  assert.equal(
    packageJson.publishConfig?.provenance,
    true,
    'publishConfig must enable provenance',
  )
  assert.equal(
    packageJson.publishConfig?.tag,
    channel,
    `publishConfig dist-tag must match prerelease channel ${channel}`,
  )

  return { name: packageJson.name, version: packageJson.version, channel }
}

export function validatePackedFiles(actualFiles, expectedFiles) {
  const actual = [...actualFiles].sort()
  const expected = [...expectedFiles].sort()
  const unexpected = actual.filter((file) => !expected.includes(file))
  const missing = expected.filter((file) => !actual.includes(file))
  const messages = []

  if (unexpected.length > 0) {
    messages.push(`Unexpected packed files: ${unexpected.join(', ')}`)
  }
  if (missing.length > 0) {
    messages.push(`Missing packed files: ${missing.join(', ')}`)
  }

  assert.deepEqual(
    actual,
    expected,
    messages.join('\n') || 'Packed file inventory differs from its allowlist',
  )
}

export function validateRepositoryContext({
  branch,
  dirtyEntries,
  dryRun,
  githubActions,
  eventName,
  refName,
  refType,
  version,
}) {
  const messages = []

  if (githubActions) {
    assert.equal(
      dirtyEntries.length,
      0,
      'GitHub release tracked state must be clean',
    )

    if (eventName === 'release') {
      assert.equal(refType, 'tag', 'GitHub release verification requires a tag')
      assert.ok(
        refName === version || refName === `v${version}`,
        `Release tag ${refName} must match package version ${version}`,
      )
    } else if (eventName === 'workflow_dispatch') {
      assert.equal(
        refType,
        'branch',
        'Manual release verification requires a branch',
      )
      assert.equal(
        refName,
        'main',
        'Manual release verification must run from main',
      )
    } else {
      assert.fail(`Unsupported GitHub release event: ${eventName}`)
    }

    return messages
  }

  assert.equal(dryRun, true, 'Local release verification is dry-run only')
  if (dirtyEntries.length > 0) {
    messages.push(
      `Local dry-run: allowing ${dirtyEntries.length} working-tree changes for inspection`,
    )
  }
  if (branch && branch !== 'main') {
    messages.push(`Local dry-run: running from feature branch ${branch}`)
  }
  return messages
}

export function assertRegistryVersionAbsent(publishedVersion, version) {
  assert.notEqual(
    publishedVersion,
    version,
    `${expectedName}@${version} already exists on the npm registry`,
  )
}

export async function verifyRelease({ dryRun = false } = {}) {
  assert.equal(dryRun, true, 'Release verification requires --dry-run')

  const packageJson = JSON.parse(
    await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
  )
  const changelog = await readFile(
    path.join(repositoryRoot, 'CHANGELOG.md'),
    'utf8',
  )
  const expectedFiles = JSON.parse(
    await readFile(
      path.join(import.meta.dirname, 'package-files.json'),
      'utf8',
    ),
  )
  const release = validateReleaseMetadata(packageJson, changelog)

  assert.match(
    packageJson.scripts?.check ?? '',
    /npm run test:workflows/,
    'The quality gate must include workflow policy tests',
  )
  assert.doesNotMatch(
    packageJson.scripts?.check ?? '',
    /release:check/,
    'The normal quality gate must never invoke release verification',
  )

  const [{ stdout: status }, { stdout: branch }] = await Promise.all([
    run('git', ['status', '--porcelain', '--untracked-files=no']),
    run('git', ['branch', '--show-current']),
  ])
  const dirtyEntries = status.trim() ? status.trimEnd().split('\n') : []
  const contextMessages = validateRepositoryContext({
    branch: branch.trim(),
    dirtyEntries,
    dryRun,
    githubActions: process.env.GITHUB_ACTIONS === 'true',
    eventName: process.env.GITHUB_EVENT_NAME,
    refName: process.env.GITHUB_REF_NAME,
    refType: process.env.GITHUB_REF_TYPE,
    version: release.version,
  })
  for (const message of contextMessages) console.log(message)

  console.log(`Release candidate: ${release.name}@${release.version}`)
  console.log(`Prerelease channel: ${release.channel}`)

  await runVisible('npm', ['run', 'build:dist'])
  await runVisible('npm', ['run', 'test:size'])
  await runVisible('npm', ['run', 'test:package'])

  const packDirectory = await mkdtemp(
    path.join(tmpdir(), 'react-swipe-actions-release-'),
  )
  try {
    const { stdout } = await run('npm', [
      'pack',
      '--json',
      '--pack-destination',
      packDirectory,
    ])
    const [pack] = JSON.parse(stdout)
    assert.ok(pack, 'npm pack did not report an artifact')
    validatePackedFiles(
      pack.files.map(({ path: file }) => file),
      expectedFiles,
    )
    console.log(
      `Artifact inventory verified (${pack.entryCount} files, ${pack.size} bytes)`,
    )

    await runVisible('npm', [
      'publish',
      '--dry-run',
      '--ignore-scripts',
      '--provenance',
      '--access',
      'public',
      '--tag',
      release.channel,
      path.join(packDirectory, pack.filename),
    ])
  } finally {
    await rm(packDirectory, { recursive: true, force: true })
  }

  const publishedVersion = await readRegistryVersion(
    release.name,
    release.version,
  )
  assertRegistryVersionAbsent(publishedVersion, release.version)
  console.log(`Registry version is available: ${release.version}`)
  console.log('Release dry-run verification passed; nothing was published')
}

async function readRegistryVersion(name, version) {
  try {
    const { stdout } = await run('npm', [
      'view',
      `${name}@${version}`,
      'version',
      '--json',
    ])
    const parsed = JSON.parse(stdout)
    return typeof parsed === 'string' ? parsed : undefined
  } catch (error) {
    const output = `${error.stdout ?? ''}\n${error.stderr ?? ''}`
    if (/E404|404 Not Found/.test(output)) return undefined
    throw error
  }
}

async function runVisible(command, args) {
  const { stdout, stderr } = await run(command, args)
  if (stdout) process.stdout.write(stdout)
  if (stderr) process.stderr.write(stderr)
}

function run(command, args) {
  return execFileAsync(command, args, {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      npm_config_update_notifier: 'false',
    },
    maxBuffer: 10 * 1024 * 1024,
  })
}

function escapeRegExp(value) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url

if (isMain) {
  try {
    const args = process.argv.slice(2)
    assert.deepEqual(args, ['--dry-run'], 'Usage: verify-release.mjs --dry-run')
    await verifyRelease({ dryRun: true })
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
