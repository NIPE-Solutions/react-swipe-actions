import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import console from 'node:console'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { gzipSync } from 'node:zlib'

const execFileAsync = promisify(execFile)
const repositoryRoot = path.resolve(import.meta.dirname, '..')
const budgets = JSON.parse(
  await readFile(path.join(import.meta.dirname, 'size-budget.json'), 'utf8'),
)
const esmPath = path.join(repositoryRoot, 'dist/index.js')
const cjsPath = path.join(repositoryRoot, 'dist/index.cjs')
const esm = await readFile(esmPath)
const cjs = await readFile(cjsPath, 'utf8')
const packageJson = JSON.parse(
  await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
)
const packDirectory = await mkdtemp(path.join(tmpdir(), 'swipe-actions-size-'))

try {
  const { stdout } = await execFileAsync(
    'npm',
    ['pack', '--json', '--pack-destination', packDirectory],
    { cwd: repositoryRoot },
  )
  const [pack] = JSON.parse(stdout)
  const tarballPath = path.join(packDirectory, pack.filename)
  const measurements = {
    esmBytes: esm.byteLength,
    esmGzipBytes: gzipSync(esm, { level: 9 }).byteLength,
    coreCssBytes: (await stat(path.join(repositoryRoot, 'dist/core.css'))).size,
    themeCssBytes: (await stat(path.join(repositoryRoot, 'dist/theme.css')))
      .size,
    tarballBytes: (await stat(tarballPath)).size,
  }

  assert.deepEqual(packageJson.dependencies ?? {}, {}, 'runtime dependencies')
  assert.match(esm.toString('utf8'), /from ["']react["']/)
  assert.match(esm.toString('utf8'), /from ["']react\/jsx-runtime["']/)
  assert.match(cjs, /require\(["']react["']\)/)
  assert.match(cjs, /require\(["']react\/jsx-runtime["']\)/)

  const bundledReactMarkers = [
    'react.production.min.js',
    '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED',
    'REACT_ELEMENT_TYPE',
  ]
  for (const marker of bundledReactMarkers) {
    assert.equal(
      esm.includes(marker) || cjs.includes(marker),
      false,
      `React appears bundled (${marker})`,
    )
  }

  let exceeded = false
  for (const [name, actual] of Object.entries(measurements)) {
    const budget = budgets[name]
    assert.equal(Number.isInteger(budget), true, `Missing budget for ${name}`)
    const delta = budget - actual
    console.log(
      `${name}: actual=${actual} budget=${budget} delta=${delta >= 0 ? '+' : ''}${delta}`,
    )
    if (actual > budget) exceeded = true
  }

  if (exceeded) {
    throw new Error('One or more package size budgets were exceeded')
  }
  console.log('React externalization verified')
} finally {
  await rm(packDirectory, { recursive: true, force: true })
}
