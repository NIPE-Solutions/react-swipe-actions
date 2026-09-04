import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import test from 'node:test'

const execFileAsync = promisify(execFile)
const repositoryRoot = path.resolve(import.meta.dirname, '../..')

test('distribution bundles declarations into its public entrypoint', async () => {
  // Catches private implementation declarations leaking into the packed artifact.
  const declarations = (await readdir('dist', { recursive: true }))
    .filter((file) => file.endsWith('.d.ts'))
    .sort()

  assert.deepEqual(declarations, ['index.d.ts'])
  assert.doesNotMatch(
    await readFile(path.join(repositoryRoot, 'dist/index.d.ts'), 'utf8'),
    /(?:from\s+|import\()['"]\.\//,
  )
})

test('package metadata points to the approved GitHub repository', async () => {
  const { default: packageJson } = await import('../../package.json', {
    with: { type: 'json' },
  })

  assert.deepEqual(packageJson.repository, {
    type: 'git',
    url: 'git+https://github.com/nipe-solutions/react-swipe-actions.git',
  })
})

test('interaction guide documents RTL keyboard mapping from physical edges', async () => {
  const guide = await readFile(
    path.join(repositoryRoot, 'docs/guides/interaction-accessibility.md'),
    'utf8',
  )

  assert.match(
    guide,
    /In RTL,\s+ArrowLeft therefore opens `trailing`, while ArrowRight opens `leading`\./,
  )
})

test('public documentation matches the SSR and release automation contracts', async () => {
  const [readme, architecture, releasing] = await Promise.all([
    readFile(path.join(repositoryRoot, 'README.md'), 'utf8'),
    readFile(path.join(repositoryRoot, 'docs/architecture.md'), 'utf8'),
    readFile(path.join(repositoryRoot, 'docs/RELEASING.md'), 'utf8'),
  ])

  assert.match(
    readme,
    /server rendering reflects the supplied\s+controlled or default open state/i,
  )
  assert.match(
    architecture,
    /server rendering emits\s+the configured controlled or default open state/i,
  )
  assert.doesNotMatch(releasing, /when release automation is introduced/i)
  assert.match(releasing, /\.github\/workflows\/release\.yml/)
})

test('website documents every stable CSS hook named by the design', async () => {
  const source = await readFile(
    path.join(repositoryRoot, 'website/src/main.tsx'),
    'utf8',
  )

  for (const hook of [
    '--swipe-actions-action-width',
    'data-full-swipe',
    'data-disabled',
  ]) {
    assert.match(source, new RegExp(hook))
  }
})

test('public API checker rejects an exported gesture internal', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'swipe-actions-api-'))
  const declaration = path.join(directory, 'index.d.ts')

  try {
    await writeFile(
      declaration,
      'export declare const SwipeActions: object\nexport interface GestureState {}\n',
    )

    await assert.rejects(
      execFileAsync(
        process.execPath,
        ['scripts/check-public-api.mjs', '--declaration', declaration],
        { cwd: repositoryRoot },
      ),
      (error) => {
        assert.match(error.stderr, /Unexpected public exports: GestureState/)
        return true
      },
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('public API checker rejects an inline import of an internal type', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'swipe-actions-api-'))
  const declaration = path.join(directory, 'index.d.ts')
  const allowlist = path.join(directory, 'public-api.json')

  try {
    await writeFile(
      declaration,
      "export declare const SwipeActions: import('./gesture/controller.js').GestureState\n",
    )
    await writeFile(
      allowlist,
      `${JSON.stringify({ runtime: ['SwipeActions'], types: [] })}\n`,
    )

    await assert.rejects(
      execFileAsync(
        process.execPath,
        [
          'scripts/check-public-api.mjs',
          '--declaration',
          declaration,
          '--allowlist',
          allowlist,
        ],
        { cwd: repositoryRoot },
      ),
      (error) => {
        assert.match(
          error.stderr,
          /Public declarations reference an internal module: gesture[/\\]controller\.d\.ts/,
        )
        return true
      },
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('packed file allowlist rejects an unexpected dist file', async () => {
  const unexpectedFile = path.join(repositoryRoot, 'dist/unexpected.tmp')

  try {
    await writeFile(unexpectedFile, 'must not ship\n')
    await assert.rejects(
      execFileAsync(process.execPath, ['scripts/verify-package.mjs'], {
        cwd: repositoryRoot,
        maxBuffer: 10 * 1024 * 1024,
      }),
      (error) => {
        assert.match(
          error.stderr,
          /Unexpected packed files: dist\/unexpected\.tmp/,
        )
        return true
      },
    )
  } finally {
    await rm(unexpectedFile, { force: true })
  }
})

test('packed package passes isolated React 18 and React 19 consumers', async () => {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    ['scripts/verify-package.mjs'],
    {
      cwd: repositoryRoot,
      maxBuffer: 10 * 1024 * 1024,
    },
  )

  assert.equal(stderr, '')
  assert.match(stdout, /React 18\.3\.1: ESM, CJS, types, SSR passed/)
  assert.match(stdout, /React 19\.2\.8: ESM, CJS, types, SSR, and Vite passed/)
  assert.match(stdout, /Packed package verification passed/)
})
