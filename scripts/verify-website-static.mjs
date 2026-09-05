import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'

import {
  canonicalCode,
  completeCanonicalCode,
  navigationGroups,
  sections,
  siteMetadata,
} from '../website/src/content.ts'

const repositoryRoot = path.resolve(import.meta.dirname, '..')
const websiteRoot = path.join(repositoryRoot, 'website')
const sourceRoot = path.join(websiteRoot, 'src')
const buildRoot = path.join(websiteRoot, 'dist')
const packageName = '@nipe-solutions/react-swipe-actions'
const approvedSections = [
  'introduction',
  'installation',
  'quick-start',
  'anatomy',
  'actions',
  'leading-trailing',
  'full-swipe',
  'controlled-state',
  'groups',
  'gestures',
  'scroll-interaction',
  'accessibility',
  'keyboard',
  'rtl',
  'styling',
  'css-variables',
  'data-attributes',
  'performance',
  'ssr',
  'api-reference',
  'examples',
  'faq',
  'migration',
  'contributing',
]
const approvedExamples = [
  'one-action',
  'unequal-actions',
  'both-sides',
  'full-swipe-example',
  'custom-styling',
  'controlled-state-example',
  'group-example',
  'rtl-example',
  'keyboard-example',
  'scroll-container',
  'bottom-sheet',
  'notification',
  'todo',
  'file-manager',
]
const prohibitedPhrases = [
  'best-in-class',
  'delightful',
  'effortless',
  'game-changing',
  'production-ready',
  'seamless',
  'supercharge',
]

await verifySourceBoundaries()
await verifyDocumentInventory()
await verifyIdentityAndMetadata()
await verifyProductionBuild()
verifyCanonicalSource(canonicalCode, 'Compact canonical excerpt', {
  complete: false,
})
verifyCanonicalSource(completeCanonicalCode, 'Complete canonical sample', {
  complete: true,
})

console.log(
  `Website structure verified (${approvedSections.length} sections, ${approvedExamples.length} examples, public package imports, production assets)`,
)

async function verifySourceBoundaries() {
  const sourceFiles = await collectFiles(sourceRoot, (file) =>
    /\.(ts|tsx)$/.test(file),
  )
  assert.ok(sourceFiles.length > 0, 'Website source files exist')
  const exampleFiles = await collectFiles(
    path.join(sourceRoot, 'examples'),
    (file) => file.endsWith('.tsx'),
  )
  assert.ok(
    exampleFiles.length > 0,
    'Representative example source files exist',
  )

  for (const file of sourceFiles) {
    const source = await readFile(file, 'utf8')
    assert.doesNotMatch(
      source,
      /from\s+['"][^'"]*(?:\/src\/|\.\.\/\.\.\/src|\.\.\/src)/,
      `${path.relative(repositoryRoot, file)} must not import package-private source`,
    )
  }

  for (const file of exampleFiles) {
    const source = await readFile(file, 'utf8')
    assert.match(
      source,
      new RegExp(`from ['"]${escapeRegExp(packageName)}['"]`),
      `${path.relative(repositoryRoot, file)} imports the public package name`,
    )
  }

  const mainSource = await readFile(path.join(sourceRoot, 'main.tsx'), 'utf8')
  assert.match(
    mainSource,
    new RegExp(`import ['"]${escapeRegExp(packageName)}\\/core\\.css['"]`),
    'Website imports mechanical CSS through the public core.css export',
  )
  assert.doesNotMatch(
    mainSource,
    new RegExp(`${escapeRegExp(packageName)}\\/(?:theme|styles)\\.css`),
    'Website presentation stays in site.css instead of the package theme',
  )

  const packageJson = JSON.parse(
    await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
  )
  assert.equal(
    packageJson.exports?.['./diagnostics'],
    undefined,
    'Website diagnostics remain outside the package API',
  )
}

async function verifyDocumentInventory() {
  assert.deepEqual(
    sections.map(([id]) => id),
    approvedSections,
    'Documentation sections differ from the approved inventory',
  )

  assert.deepEqual(
    navigationGroups.map(({ label }) => label),
    [
      'Start',
      'Core concepts',
      'Interaction',
      'Customization',
      'Advanced',
      'Resources',
    ],
    'Documentation navigation uses the approved groups',
  )
  assert.deepEqual(
    navigationGroups.flatMap(({ entries }) => entries.map(([id]) => id)),
    approvedSections,
    'Grouped navigation preserves the approved section order',
  )

  const sourceFiles = await collectFiles(sourceRoot, (file) =>
    /\.(ts|tsx)$/.test(file),
  )
  const source = (
    await Promise.all(sourceFiles.map((file) => readFile(file, 'utf8')))
  ).join('\n')
  for (const id of approvedSections) {
    assert.ok(source.includes(`id="${id}"`) || source.includes(`['${id}',`))
  }
  for (const id of approvedExamples) {
    assert.ok(
      source.includes(`id="${id}"`) ||
        source.includes(`data-example-id="${id}"`),
      `Website source contains the ${id} example`,
    )
  }

  const lowerSource = source.toLowerCase()
  assert.deepEqual(
    prohibitedPhrases.filter((phrase) => lowerSource.includes(phrase)),
    [],
    'Website source contains prohibited marketing language',
  )
}

async function verifyIdentityAndMetadata() {
  const packageJson = JSON.parse(
    await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
  )
  assert.equal(siteMetadata.version, packageJson.version)
  assert.equal(siteMetadata.statusLabel, '0.1 alpha')
  assert.equal(siteMetadata.reactCompatibility, 'React 18.3 and 19')

  const mainSource = await readFile(path.join(sourceRoot, 'main.tsx'), 'utf8')
  const performanceSource = await readFile(
    path.join(sourceRoot, 'performance-fixture.tsx'),
    'utf8',
  )
  const shellSource = await readFile(
    path.join(sourceRoot, 'components', 'DocsShell.tsx'),
    'utf8',
  )
  const projectMarkFile = path.join(sourceRoot, 'components', 'ProjectMark.tsx')
  assert.equal(
    await fileExists(projectMarkFile),
    true,
    'Website includes a reusable project icon',
  )
  const projectMarkSource = await readFile(projectMarkFile, 'utf8')
  const faviconSource = await readFile(
    path.join(websiteRoot, 'public', 'favicon.svg'),
    'utf8',
  )
  const contentSource = await readFile(
    path.join(sourceRoot, 'content.ts'),
    'utf8',
  )
  const source = `${mainSource}\n${shellSource}\n${contentSource}`
  assert.match(
    shellSource,
    /<ProjectMark\b/,
    'Documentation wordmark uses the project icon',
  )
  for (const part of ['action', 'content']) {
    assert.ok(
      projectMarkSource.includes(`data-mark-part="${part}"`) &&
        faviconSource.includes(`data-mark-part="${part}"`),
      `Header and favicon share the ${part} mark geometry`,
    )
  }
  assert.match(
    source,
    /Swipe actions that feel native\. State that stays yours\./,
    'Hero describes native feel without claiming a native primitive',
  )
  assert.match(
    performanceSource,
    /Back to documentation/,
    'Performance fixture provides a route back to the documentation',
  )
  assert.match(
    performanceSource,
    /<footer className="performance-fixture__footer">/,
    'Performance fixture includes a compact project footer',
  )
  for (const destination of [
    'https://github.com/NIPE-Solutions/react-swipe-actions',
    'https://opensource.nipesolutions.com',
    'https://opensource.nipesolutions.com/impressum',
    'https://opensource.nipesolutions.com/privacy',
  ]) {
    assert.ok(source.includes(destination), `Website links to ${destination}`)
  }

  const index = await readFile(path.join(websiteRoot, 'index.html'), 'utf8')
  for (const pattern of [
    /<link[\s\S]*?rel="canonical"[\s\S]*?href="https:\/\/react-swipe-actions\.nipesolutions\.com\/"/,
    /<meta property="og:title"/,
    /<meta[\s\S]*?property="og:description"/,
    /<meta[\s\S]*?property="og:image"[\s\S]*?content="https:\/\/react-swipe-actions\.nipesolutions\.com\/og-react-swipe-actions\.png"/,
    /<meta name="twitter:card" content="summary_large_image"/,
    /<meta name="theme-color"/,
    /<link rel="icon"/,
  ]) {
    assert.match(index, pattern)
  }

  for (const asset of [
    'public/og-react-swipe-actions.svg',
    'public/og-react-swipe-actions.png',
    'public/favicon.svg',
    'public/robots.txt',
    'public/sitemap.xml',
  ]) {
    assert.equal(
      await fileExists(path.join(websiteRoot, asset)),
      true,
      `Website includes ${asset}`,
    )
  }
}

async function verifyProductionBuild() {
  const index = await readFile(path.join(buildRoot, 'index.html'), 'utf8')
  assert.match(index, /<div id="root"><\/div>/)
  assert.match(index, /<script[^>]+type="module"[^>]+src="(?:\.\/|\/)assets\//)
  const assets = await collectFiles(path.join(buildRoot, 'assets'), () => true)
  assert.ok(
    assets.some((file) => file.endsWith('.js')),
    'Production website includes a JavaScript asset',
  )
  assert.ok(
    assets.some((file) => file.endsWith('.css')),
    'Production website includes a CSS asset',
  )
}

function verifyCanonicalSource(source, label, { complete }) {
  const result = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: `${label.replaceAll(' ', '-')}.tsx`,
    reportDiagnostics: true,
  })
  const syntaxErrors = (result.diagnostics ?? [])
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    )
  assert.deepEqual(syntaxErrors, [], `${label} parses as TSX`)
  assert.match(source, new RegExp(`['"]${escapeRegExp(packageName)}['"]`))
  assert.match(
    source,
    new RegExp(`['"]${escapeRegExp(packageName)}\\/core\\.css['"]`),
  )
  for (const part of complete
    ? ['Root', 'Leading', 'Content', 'Trailing']
    : ['Root', 'Leading', 'Content']) {
    assert.match(source, new RegExp(`<(?:(?:[A-Za-z]+\\.)?${part})\\b`))
  }
  assert.ok(
    source.match(/<(?:(?:[A-Za-z]+\.)?Action)\b/g)?.length >=
      (complete ? 2 : 1),
    `${label} includes the required action composition`,
  )
}

async function collectFiles(root, predicate) {
  const files = []
  for (const entry of await readdir(root)) {
    const file = path.join(root, entry)
    if ((await stat(file)).isDirectory()) {
      files.push(...(await collectFiles(file, predicate)))
    } else if (predicate(file)) {
      files.push(file)
    }
  }
  return files.sort()
}

async function fileExists(file) {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
