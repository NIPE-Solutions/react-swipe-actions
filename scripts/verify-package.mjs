import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import console from 'node:console'
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
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
const sourceMode = process.argv.includes('--source')
const repositoryUrl = 'https://github.com/nipe-solutions/react-swipe-actions'
const documentationFiles = [
  'README.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'SECURITY.md',
  'docs/RELEASING.md',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml',
  '.github/PULL_REQUEST_TEMPLATE.md',
]
const sourceDocumentation = await validateSourceDocumentation()
const lanes = [
  {
    label: 'React 18.3.1',
    react: '18.3.1',
    reactDom: '18.3.1',
    reactTypes: '18.3.31',
    reactDomTypes: '18.3.7',
    vite: false,
  },
  {
    label: 'React 19.2.8',
    react: '19.2.8',
    reactDom: '19.2.8',
    reactTypes: '19.2.18',
    reactDomTypes: '19.2.7',
    vite: true,
  },
]

if (sourceMode) {
  console.log(
    `Source documentation verification passed (${sourceDocumentation.size} files)`,
  )
  process.exit(0)
}

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

    const installPackages = [
      tarballPath,
      `react@${lane.react}`,
      `react-dom@${lane.reactDom}`,
      `@types/react@${lane.reactTypes}`,
      `@types/react-dom@${lane.reactDomTypes}`,
      'jsdom@30.0.1',
    ]
    if (lane.vite) {
      installPackages.push('vite@8.2.2')
    }
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
        ...installPackages,
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
    const ssr = await run(
      process.execPath,
      ['fixtures/ssr/index.mjs'],
      consumer,
    )
    await run(
      process.execPath,
      [
        path.join(repositoryRoot, 'node_modules/typescript/bin/tsc'),
        '--project',
        'fixtures/types/tsconfig.json',
      ],
      consumer,
    )
    if (lane.vite) {
      await run(
        process.execPath,
        [
          'node_modules/vite/bin/vite.js',
          'build',
          '--config',
          'fixtures/vite/vite.config.mjs',
        ],
        consumer,
      )
      const viteIndex = await readFile(
        path.join(consumer, 'fixtures/vite/dist/index.html'),
        'utf8',
      )
      assert.match(viteIndex, /<script[^>]+type="module"/)
      assert.ok(
        (await readdir(path.join(consumer, 'fixtures/vite/dist/assets'))).some(
          (file) => file.endsWith('.css'),
        ),
        'isolated Vite consumer emits the imported package stylesheet',
      )
    }

    const laneEsmExports = JSON.parse(esm.stdout.trim())
    const laneCjsExports = JSON.parse(cjs.stdout.trim())
    assert.deepEqual(laneEsmExports, expectedRuntimeExports)
    assert.deepEqual(laneCjsExports, expectedRuntimeExports)
    assert.deepEqual(laneEsmExports, laneCjsExports)

    esmExports ??= laneEsmExports
    cjsExports ??= laneCjsExports
    assert.deepEqual(laneEsmExports, esmExports)
    assert.deepEqual(laneCjsExports, cjsExports)
    assert.equal(
      ssr.stderr,
      '',
      `${lane.label} SSR render/hydration must not emit warnings`,
    )
    assert.match(ssr.stdout, /SSR render and hydration passed/)
    console.log(
      `${lane.label}: ESM, CJS, types, SSR${lane.vite ? ', and Vite' : ''} passed`,
    )
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

async function validateSourceDocumentation() {
  const files = new Map()
  for (const relativePath of documentationFiles) {
    const absolutePath = path.join(repositoryRoot, relativePath)
    assert.ok(
      await pathExists(absolutePath),
      `Required documentation file is missing: ${relativePath}`,
    )
    files.set(relativePath, await readFile(absolutePath, 'utf8'))
  }

  const packageJson = JSON.parse(
    await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
  )
  const publicApi = JSON.parse(
    await readFile(path.join(import.meta.dirname, 'public-api.json'), 'utf8'),
  )
  assert.equal(packageJson.license, 'MIT')
  assert.equal(packageJson.homepage, `${repositoryUrl}#readme`)
  assert.deepEqual(packageJson.bugs, { url: `${repositoryUrl}/issues` })

  const license = await readFile(path.join(repositoryRoot, 'LICENSE'), 'utf8')
  assert.match(license, /^MIT License\r?\n/)

  const readme = files.get('README.md')
  assert.ok(readme, 'README.md must be readable')
  assert.ok(
    markdownLinks(readme).some(({ target }) => target === repositoryUrl),
    'README.md must link to the canonical repository URL',
  )
  assert.ok(
    shellBlocks(readme).some(
      (command) => command === `npm install ${packageName}`,
    ),
    'README.md must provide the package installation command',
  )
  assertDocumentedImportsExist(readme, packageJson.exports, publicApi)

  const changelog = files.get('CHANGELOG.md')
  assert.ok(changelog, 'CHANGELOG.md must be readable')
  assert.match(
    changelog,
    /^## \[0\.1\.0-alpha\.0\] - Unreleased$/m,
    'CHANGELOG.md must contain the unreleased 0.1.0-alpha.0 section',
  )

  const contributing = files.get('CONTRIBUTING.md')
  assert.ok(contributing, 'CONTRIBUTING.md must be readable')
  assertDocumentedNpmScript(contributing, packageJson.scripts, 'check')
  assertDocumentedNpmScript(contributing, packageJson.scripts, 'test:e2e')
  assert.ok(
    markdownLinks(contributing).some(
      ({ target }) => target === `${repositoryUrl}/issues/new/choose`,
    ),
    'CONTRIBUTING.md must link to the public support route',
  )

  const security = files.get('SECURITY.md')
  assert.ok(security, 'SECURITY.md must be readable')
  const privateReportUrl = `${repositoryUrl}/security/advisories/new`
  assert.ok(
    markdownLinks(security).some(({ target }) => target === privateReportUrl),
    'SECURITY.md must link to private GitHub vulnerability reporting',
  )

  const release = files.get('docs/RELEASING.md')
  assert.ok(release, 'docs/RELEASING.md must be readable')
  assertDocumentedNpmScript(release, packageJson.scripts, 'check')
  assert.ok(
    shellBlocks(release).some(
      (command) =>
        command === 'npm publish --dry-run --provenance --access public',
    ),
    'docs/RELEASING.md must document the provenance dry run command',
  )

  for (const [relativePath, source] of files) {
    await assertLocalMarkdownLinksResolve(relativePath, source)
  }

  return files
}

function assertDocumentedImportsExist(readme, exportsMap, publicApi) {
  const approvedSymbols = new Set([...publicApi.runtime, ...publicApi.types])

  for (const source of typescriptBlocks(readme)) {
    for (const specifier of source.matchAll(
      /from\s+['"]@nipe-solutions\/react-swipe-actions([^'"]*)['"]/g,
    )) {
      const subpath = specifier[1] || '.'
      assert.ok(
        Object.hasOwn(exportsMap, subpath),
        `README.md imports an unavailable package subpath: ${subpath}`,
      )
    }

    for (const namedImport of source.matchAll(
      /import\s*\{([^}]*)\}\s*from\s*['"]@nipe-solutions\/react-swipe-actions['"]/g,
    )) {
      for (const imported of namedImport[1].split(',')) {
        const symbol = imported
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/, 1)[0]
        if (symbol.length === 0) {
          continue
        }
        assert.ok(
          approvedSymbols.has(symbol),
          `README.md imports an unavailable public symbol: ${symbol}`,
        )
      }
    }
  }
}

function assertDocumentedNpmScript(source, scripts, name) {
  assert.ok(
    shellBlocks(source).some((command) => command === `npm run ${name}`),
    `Documentation must contain npm run ${name}`,
  )
  assert.ok(scripts[name], `package.json must define the ${name} script`)
}

async function assertLocalMarkdownLinksResolve(relativePath, source) {
  for (const { target } of markdownLinks(source)) {
    if (
      target.startsWith('#') ||
      target.startsWith('http://') ||
      target.startsWith('https://') ||
      target.startsWith('mailto:')
    ) {
      continue
    }

    const [pathname] = target.split('#', 1)
    const destination = path.resolve(
      repositoryRoot,
      path.dirname(relativePath),
      pathname,
    )
    assert.ok(
      await pathExists(destination),
      `${relativePath} links to a missing local path: ${target}`,
    )
  }
}

function markdownLinks(source) {
  return [
    ...source.matchAll(/\[[^\]]+\]\(([^)\s]+)(?:\s+['"][^'"]*['"])?\)/g),
  ].map(([, target]) => ({ target }))
}

function shellBlocks(source) {
  return [...source.matchAll(/```(?:bash|sh)\r?\n([\s\S]*?)```/g)].flatMap(
    ([, block]) =>
      block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#')),
  )
}

function typescriptBlocks(source) {
  return [...source.matchAll(/```(?:tsx|ts)\r?\n([\s\S]*?)```/g)].map(
    ([, block]) => block,
  )
}

async function pathExists(target) {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}
