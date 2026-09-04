import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import test from 'node:test'
import { URL } from 'node:url'

import { validateCssContract } from './check-css-contract.mjs'
import { copyStyles } from './copy-styles.mjs'

const sourceDirectory = new URL('../src/styles/', import.meta.url)
const sourcePaths = ['core.css', 'theme.css', 'styles.css'].map(
  (name) => new URL(name, sourceDirectory),
)

test('source styles satisfy the parsed public CSS contract', async () => {
  await validateCssContract(sourcePaths)
})

test('validator rejects a stylesheet that leaks visuals or an unscoped selector', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'swipe-actions-css-'))
  const temporaryPaths = ['core.css', 'theme.css', 'styles.css'].map((name) =>
    join(directory, name),
  )

  try {
    await cp(sourceDirectory, directory, { recursive: true })
    await writeFile(
      join(directory, 'core.css'),
      `\n.accidental { color: #f00; }\n`,
      { flag: 'a' },
    )

    await assert.rejects(
      validateCssContract(temporaryPaths),
      /not namespaced|forbidden visual declaration/i,
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('copyStyles creates byte-identical stable CSS artifacts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'swipe-actions-dist-'))

  try {
    await copyStyles({ sourceDirectory, outputDirectory: directory })

    for (const sourcePath of sourcePaths) {
      const outputPath = join(directory, basename(sourcePath.pathname))
      assert.deepEqual(
        await readFile(outputPath),
        await readFile(sourcePath),
        `${basename(sourcePath.pathname)} must be copied without rewriting`,
      )
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
