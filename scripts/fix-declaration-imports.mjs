import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const declarationsRoot = path.resolve(import.meta.dirname, '../dist')

for (const declaration of await declarationFiles(declarationsRoot)) {
  const source = await readFile(declaration, 'utf8')
  const compatible = source.replace(
    /((?:from\s+|import\s*\(\s*)['"])(\.{1,2}\/[^'"]+)(['"])/g,
    (match, prefix, specifier, suffix) => {
      if (path.posix.extname(specifier) !== '') return match
      return `${prefix}${specifier}.js${suffix}`
    },
  )
  if (compatible !== source) {
    await writeFile(declaration, compatible)
  }
}

async function declarationFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const resolved = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await declarationFiles(resolved)))
    } else if (entry.name.endsWith('.d.ts')) {
      files.push(resolved)
    }
  }
  return files
}
