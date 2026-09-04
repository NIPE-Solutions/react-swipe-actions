import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import console from 'node:console'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const repositoryRoot = path.resolve(import.meta.dirname, '..')
const fixturesRoot = path.join(repositoryRoot, 'test/package/fixtures')
const packageName = '@nipe-solutions/react-swipe-actions'
const approvedPackedFiles = JSON.parse(
  await readFile(path.join(import.meta.dirname, 'package-files.json'), 'utf8'),
)
const expectedRuntimeExports = [
  'Action',
  'Content',
  'Group',
  'Leading',
  'Root',
  'SwipeActions',
  'Trailing',
]
const lanes = [
  {
    label: 'React 18.3.1',
    react: '18.3.1',
    reactDom: '18.3.1',
    reactTypes: '18.3.31',
    reactDomTypes: '18.3.7',
  },
  {
    label: 'React 19.2.8',
    react: '19.2.8',
    reactDom: '19.2.8',
    reactTypes: '19.2.18',
    reactDomTypes: '19.2.7',
  },
]
const temporaryRoot = await mkdtemp(
  path.join(tmpdir(), 'react-swipe-actions-package-'),
)

try {
  const packDirectory = path.join(temporaryRoot, 'pack')
  await mkdir(packDirectory)
  const { stdout } = await run('npm', [
    'pack',
    '--json',
    '--pack-destination',
    packDirectory,
  ])
  const [pack] = JSON.parse(stdout)
  assert.ok(pack, 'npm pack did not report an artifact')
  validatePackedFiles(pack.files.map(({ path: file }) => file))

  const tarballPath = path.join(packDirectory, pack.filename)
  let esmExports
  let cjsExports

  for (const lane of lanes) {
    const consumer = path.join(
      temporaryRoot,
      lane.label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-'),
    )
    await mkdir(consumer)
    await cp(fixturesRoot, path.join(consumer, 'fixtures'), { recursive: true })
    await writeFile(
      path.join(consumer, 'package.json'),
      `${JSON.stringify({ private: true, type: 'module' }, null, 2)}\n`,
    )

    await run(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--no-package-lock',
        '--save-exact',
        '--install-strategy=hoisted',
        tarballPath,
        `react@${lane.react}`,
        `react-dom@${lane.reactDom}`,
        `@types/react@${lane.reactTypes}`,
        `@types/react-dom@${lane.reactDomTypes}`,
      ],
      consumer,
    )

    const installedPackage = JSON.parse(
      await readFile(
        path.join(
          consumer,
          'node_modules',
          ...packageName.split('/'),
          'package.json',
        ),
        'utf8',
      ),
    )
    assert.deepEqual(installedPackage.dependencies ?? {}, {})
    assert.deepEqual(installedPackage.repository, {
      type: 'git',
      url: 'git+https://github.com/nipe-solutions/react-swipe-actions.git',
    })
    const installedReact = JSON.parse(
      await readFile(
        path.join(consumer, 'node_modules/react/package.json'),
        'utf8',
      ),
    )
    const installedReactDom = JSON.parse(
      await readFile(
        path.join(consumer, 'node_modules/react-dom/package.json'),
        'utf8',
      ),
    )
    assert.equal(installedReact.version, lane.react)
    assert.equal(installedReactDom.version, lane.reactDom)

    const esm = await run(
      process.execPath,
      ['fixtures/esm/index.mjs'],
      consumer,
    )
    const cjs = await run(
      process.execPath,
      ['fixtures/cjs/index.cjs'],
      consumer,
    )
    await run(process.execPath, ['fixtures/ssr/index.mjs'], consumer)
    await run(
      process.execPath,
      [
        path.join(repositoryRoot, 'node_modules/typescript/bin/tsc'),
        '--project',
        'fixtures/types/tsconfig.json',
      ],
      consumer,
    )

    const laneEsmExports = JSON.parse(esm.stdout.trim())
    const laneCjsExports = JSON.parse(cjs.stdout.trim())
    assert.deepEqual(laneEsmExports, expectedRuntimeExports)
    assert.deepEqual(laneCjsExports, expectedRuntimeExports)
    assert.deepEqual(laneEsmExports, laneCjsExports)

    esmExports ??= laneEsmExports
    cjsExports ??= laneCjsExports
    assert.deepEqual(laneEsmExports, esmExports)
    assert.deepEqual(laneCjsExports, cjsExports)
    console.log(`${lane.label}: ESM, CJS, types, and SSR passed`)
  }

  console.log(
    `Packed package verification passed (${pack.entryCount} files, ${pack.size} bytes)`,
  )
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}

function validatePackedFiles(files) {
  const actual = [...files].sort()
  const expected = [...approvedPackedFiles].sort()
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

function run(command, args, cwd = repositoryRoot) {
  return execFileAsync(command, args, {
    cwd,
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      npm_config_update_notifier: 'false',
    },
    maxBuffer: 10 * 1024 * 1024,
  })
}
