import assert from 'node:assert/strict'
import console from 'node:console'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const repositoryRoot = path.resolve(import.meta.dirname, '..')
const options = parseOptions(process.argv.slice(2))
const declarationPath = path.resolve(
  repositoryRoot,
  options.declaration ?? 'dist/index.d.ts',
)
const allowlistPath = path.resolve(
  repositoryRoot,
  options.allowlist ?? 'scripts/public-api.json',
)
const allowlist = JSON.parse(await readFile(allowlistPath, 'utf8'))
const declarationExports = await readDeclarationExports(declarationPath)

const expected = [...allowlist.runtime, ...allowlist.types].sort()
const actual = [...declarationExports].sort()
const unexpected = actual.filter((name) => !expected.includes(name))
const missing = expected.filter((name) => !actual.includes(name))

if (unexpected.length > 0 || missing.length > 0) {
  const messages = []
  if (unexpected.length > 0) {
    messages.push(`Unexpected public exports: ${unexpected.join(', ')}`)
  }
  if (missing.length > 0) {
    messages.push(`Missing public exports: ${missing.join(', ')}`)
  }
  throw new Error(messages.join('\n'))
}

await rejectInternalDeclarationReferences(declarationPath)

if (declarationPath === path.join(repositoryRoot, 'dist/index.d.ts')) {
  const esm = await import(
    pathToFileURL(path.join(repositoryRoot, 'dist/index.js'))
  )
  const runtimeExports = Object.keys(esm).sort()
  assert.deepEqual(
    runtimeExports,
    [...allowlist.runtime].sort(),
    'ESM runtime exports differ from the public API allowlist',
  )
}

console.log(`Public API verified (${actual.length} exports)`)

function parseOptions(args) {
  const parsed = {}
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument !== '--declaration' && argument !== '--allowlist') {
      throw new Error(`Unknown argument: ${argument}`)
    }
    const value = args[index + 1]
    if (value === undefined) {
      throw new Error(`Missing value for ${argument}`)
    }
    parsed[argument.slice(2)] = value
    index += 1
  }
  return parsed
}

async function readDeclarationExports(file) {
  const source = ts.createSourceFile(
    file,
    await readFile(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const names = new Set()

  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause === undefined) {
        throw new Error('Wildcard declaration exports are not allowed')
      }
      if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          names.add(element.name.text)
        }
      }
      continue
    }

    if (!hasExportModifier(statement)) continue

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          throw new Error('Destructured public declarations are not allowed')
        }
        names.add(declaration.name.text)
      }
    } else if ('name' in statement && statement.name !== undefined) {
      names.add(statement.name.text)
    }
  }

  return names
}

function hasExportModifier(node) {
  return node.modifiers?.some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  )
}

async function rejectInternalDeclarationReferences(entry) {
  const queue = [entry]
  const visited = new Set()

  while (queue.length > 0) {
    const current = queue.pop()
    if (current === undefined || visited.has(current)) continue
    visited.add(current)

    const relative = path.relative(path.dirname(entry), current)
    const segments = relative.split(path.sep)
    if (segments.includes('gesture') || segments.includes('motion')) {
      throw new Error(
        `Public declarations reference an internal module: ${relative}`,
      )
    }

    const source = ts.createSourceFile(
      current,
      await readFile(current, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )

    for (const statement of source.statements) {
      if (
        (ts.isImportDeclaration(statement) ||
          ts.isExportDeclaration(statement)) &&
        statement.moduleSpecifier !== undefined &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text.startsWith('.')
      ) {
        queue.push(
          path.resolve(
            path.dirname(current),
            declarationTarget(statement.moduleSpecifier.text),
          ),
        )
      }
    }
  }
}

function declarationTarget(specifier) {
  return specifier.endsWith('.js')
    ? `${specifier.slice(0, -3)}.d.ts`
    : `${specifier}.d.ts`
}
