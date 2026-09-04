import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import { generate, parse, walk } from 'css-tree'

const ROOT_SELECTOR = '[data-swipe-actions-root]'
const REQUIRED_STYLE_NAMES = ['core.css', 'theme.css', 'styles.css']
const REQUIRED_CUSTOM_PROPERTIES = [
  '--swipe-actions-offset',
  '--swipe-actions-progress',
  '--swipe-actions-leading-progress',
  '--swipe-actions-trailing-progress',
  '--swipe-actions-action-width',
]
const REQUIRED_SELECTOR_FRAGMENTS = [
  '[data-swipe-actions-root]',
  '[data-swipe-actions-content]',
  '[data-swipe-actions-side]',
  '[data-swipe-actions-action]',
  '[data-state="closed"]',
  '[data-side="leading"]',
  '[data-side="trailing"]',
  '[data-active]',
  '[data-full-swipe]',
]
const CORE_DECLARATIONS = new Set([
  'content',
  'display',
  'inset-block',
  'inset-inline-end',
  'inset-inline-start',
  'inline-size',
  'overflow',
  'pointer-events',
  'position',
  'touch-action',
  'transform',
  'visibility',
  'z-index',
])
const THEME_MECHANICAL_DECLARATIONS = new Set([
  'display',
  'inset',
  'inset-block',
  'inset-block-end',
  'inset-block-start',
  'inset-inline',
  'inset-inline-end',
  'inset-inline-start',
  'left',
  'overflow',
  'pointer-events',
  'position',
  'right',
  'top',
  'bottom',
  'touch-action',
  'transform',
  'visibility',
  'z-index',
])

function asPath(pathOrUrl) {
  return pathOrUrl instanceof URL ? fileURLToPath(pathOrUrl) : pathOrUrl
}

function defaultPaths() {
  return REQUIRED_STYLE_NAMES.map(
    (name) => new URL(`../src/styles/${name}`, import.meta.url),
  )
}

function parsedRules(ast) {
  const rules = []
  walk(ast, {
    visit: 'Rule',
    enter(node) {
      rules.push(node)
    },
  })
  return rules
}

function parsedDeclarations(ast) {
  const declarations = []
  walk(ast, {
    visit: 'Declaration',
    enter(node) {
      declarations.push(node)
    },
  })
  return declarations
}

function selectorTexts(ast) {
  const selectors = []
  for (const rule of parsedRules(ast)) {
    if (rule.prelude?.type !== 'SelectorList') {
      continue
    }
    walk(rule.prelude, {
      visit: 'Selector',
      enter(node) {
        selectors.push(generate(node))
      },
    })
  }
  return selectors
}

function parseStylesheet(path, css) {
  try {
    return parse(css, { context: 'stylesheet', parseValue: true })
  } catch (error) {
    throw new Error(`${basename(path)} could not be parsed: ${error.message}`, {
      cause: error,
    })
  }
}

function collectCustomProperties(ast) {
  const properties = new Set()
  for (const declaration of parsedDeclarations(ast)) {
    if (declaration.property.startsWith('--swipe-actions-')) {
      properties.add(declaration.property)
    }
    const value = generate(declaration.value)
    for (const property of REQUIRED_CUSTOM_PROPERTIES) {
      if (value.includes(property)) {
        properties.add(property)
      }
    }
  }
  return properties
}

function collectImports(ast) {
  const imports = []
  walk(ast, {
    visit: 'Atrule',
    enter(node) {
      if (node.name.toLowerCase() === 'import') {
        imports.push(generate(node.prelude))
      }
    },
  })
  return imports
}

function validateCore(ast, failures) {
  const selectors = selectorTexts(ast)
  for (const selector of selectors) {
    if (!selector.startsWith(ROOT_SELECTOR)) {
      failures.push(`core selector is not namespaced: ${selector}`)
    }
  }

  for (const fragment of REQUIRED_SELECTOR_FRAGMENTS) {
    if (!selectors.some((selector) => selector.includes(fragment))) {
      failures.push(`core is missing documented selector ${fragment}`)
    }
  }

  const customProperties = collectCustomProperties(ast)
  for (const property of REQUIRED_CUSTOM_PROPERTIES) {
    if (!customProperties.has(property)) {
      failures.push(`core is missing documented custom property ${property}`)
    }
  }

  let hasPanY = false
  walk(ast, {
    enter(node) {
      if (node.type === 'HexColor') {
        failures.push('core contains a forbidden visual declaration: hex color')
      }
      if (
        node.type === 'Function' &&
        ['rgb', 'rgba'].includes(node.name.toLowerCase())
      ) {
        failures.push('core contains a forbidden visual declaration: rgb color')
      }
      if (node.type === 'Declaration') {
        if (
          !CORE_DECLARATIONS.has(node.property) &&
          !node.property.startsWith('--swipe-actions-')
        ) {
          failures.push(
            `core contains a forbidden visual declaration: ${node.property}`,
          )
        }
        if (
          node.property === 'touch-action' &&
          generate(node.value).trim() === 'pan-y'
        ) {
          hasPanY = true
        }
      }
    },
  })

  if (!hasPanY) {
    failures.push('core is missing touch-action: pan-y')
  }
}

function validateTheme(ast, failures) {
  for (const selector of selectorTexts(ast)) {
    if (!selector.startsWith(ROOT_SELECTOR)) {
      failures.push(`theme selector is not namespaced: ${selector}`)
    }
  }

  for (const declaration of parsedDeclarations(ast)) {
    if (THEME_MECHANICAL_DECLARATIONS.has(declaration.property)) {
      failures.push(
        `theme contains a mechanical declaration: ${declaration.property}`,
      )
    }
  }
}

function validateAggregate(ast, failures) {
  const imports = collectImports(ast)
  for (const name of ['core.css', 'theme.css']) {
    if (!imports.some((value) => value.includes(name))) {
      failures.push(`styles.css must import ${name}`)
    }
  }
}

export async function validateCssContract(paths = defaultPaths()) {
  const styles = new Map()
  for (const input of paths) {
    const path = asPath(input)
    const name = basename(path)
    if (!REQUIRED_STYLE_NAMES.includes(name)) {
      throw new Error(`Unexpected stylesheet: ${path}`)
    }
    if (styles.has(name)) {
      throw new Error(`Duplicate stylesheet: ${name}`)
    }
    styles.set(name, {
      path,
      ast: parseStylesheet(path, await readFile(path, 'utf8')),
    })
  }

  const failures = []
  for (const name of REQUIRED_STYLE_NAMES) {
    if (!styles.has(name)) {
      failures.push(`missing stylesheet: ${name}`)
    }
  }
  if (failures.length > 0) {
    throw new Error(`CSS contract failed:\n${failures.join('\n')}`)
  }

  validateCore(styles.get('core.css').ast, failures)
  validateTheme(styles.get('theme.css').ast, failures)
  validateAggregate(styles.get('styles.css').ast, failures)

  if (failures.length > 0) {
    throw new Error(`CSS contract failed:\n${failures.join('\n')}`)
  }
}

if (import.meta.main) {
  const paths = process.argv.slice(2)
  await validateCssContract(paths.length === 0 ? defaultPaths() : paths)
}
