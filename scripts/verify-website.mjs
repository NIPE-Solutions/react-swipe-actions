import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { chromium } from '@playwright/test'

const repositoryRoot = path.resolve(import.meta.dirname, '..')
const websiteRoot = path.join(repositoryRoot, 'website')
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

const server = createStaticServer(buildRoot)
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})

const address = server.address()
assert.ok(address && typeof address === 'object')
const baseUrl = `http://127.0.0.1:${address.port}`
const browser = await chromium.launch()

try {
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  })
  const page = await desktopContext.newPage()
  await page.goto(baseUrl, { waitUntil: 'networkidle' })

  const sectionIds = await page
    .locator('main section[id]')
    .evaluateAll((nodes) => nodes.map((node) => node.id))
  assert.deepEqual(
    sectionIds,
    approvedSections,
    'Rendered documentation sections differ from the approved inventory',
  )

  const unresolvedLinks = await page
    .locator('a[href^="#"]')
    .evaluateAll((links) =>
      links.flatMap((link) => {
        const hash = link.getAttribute('href')
        return hash && document.querySelector(hash) === null ? [hash] : []
      }),
    )
  assert.deepEqual(
    unresolvedLinks,
    [],
    'Every internal documentation link resolves',
  )

  const exampleIds = await page
    .locator('[data-example-id]')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-example-id')),
    )
  assert.deepEqual(
    exampleIds,
    approvedExamples,
    'Rendered examples differ from the representative inventory',
  )

  const renderedText = (await page.locator('body').innerText()).toLowerCase()
  const foundPhrases = prohibitedPhrases.filter((phrase) =>
    renderedText.includes(phrase),
  )
  assert.deepEqual(
    foundPhrases,
    [],
    'Prohibited marketing phrases were rendered',
  )

  await verifyOpeningGeometry(page, { width: 1440, height: 1000 })

  await verifyPrimaryDemo(page)
  await verifyCustomStyling(page)

  const accessibility = await new AxeBuilder({ page }).analyze()
  assert.deepEqual(
    accessibility.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      nodes: nodes.length,
    })),
    [],
    'The rendered documentation page has no axe violations',
  )
  await desktopContext.close()

  const tabletViewport = { width: 1024, height: 768 }
  const tabletContext = await browser.newContext({ viewport: tabletViewport })
  const tablet = await tabletContext.newPage()
  await tablet.goto(baseUrl, { waitUntil: 'networkidle' })
  await verifyOpeningGeometry(tablet, tabletViewport)
  await tabletContext.close()

  const mobileViewport = { width: 390, height: 844 }
  const mobileContext = await browser.newContext({ viewport: mobileViewport })
  const mobile = await mobileContext.newPage()
  await mobile.goto(baseUrl, { waitUntil: 'networkidle' })
  await verifyOpeningGeometry(mobile, mobileViewport)
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    'The website does not overflow a 390px viewport',
  )
  for (const target of [
    mobile.locator('.docs-rail nav a').first(),
    mobile.locator('.install-command button'),
    mobile.locator('[data-testid="canonical-code"] button'),
  ]) {
    const box = await target.boundingBox()
    assert.ok(
      box && box.height >= 40,
      'Compact navigation and copy targets are at least 40px tall',
    )
  }
  await mobileContext.close()

  await verifyPerformanceLink(browser, baseUrl)

  console.log(
    `Website verified (${approvedSections.length} sections, ${approvedExamples.length} examples, public package imports, desktop/mobile layout, live demo)`,
  )
} finally {
  await browser.close()
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
}

async function verifySourceBoundaries() {
  const sourceRoot = path.join(websiteRoot, 'src')
  assert.equal(
    await pathExists(sourceRoot),
    true,
    'Website source directory exists',
  )
  const sourceFiles = await collectFiles(sourceRoot, (file) =>
    /\.(ts|tsx)$/.test(file),
  )
  assert.ok(sourceFiles.length > 0, 'Website source files exist')

  const exampleRoot = path.join(sourceRoot, 'examples')
  const exampleFiles = await collectFiles(exampleRoot, (file) =>
    file.endsWith('.tsx'),
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

async function verifyPrimaryDemo(page) {
  const rows = page.locator('[data-demo-row]')
  assert.ok((await rows.count()) >= 2, 'Primary demo renders a grouped inbox')

  const first = rows.nth(0)
  const second = rows.nth(1)
  await drag(first, -118)
  assert.equal(
    await waitFor(
      () => first.getAttribute('data-state'),
      (state) => state === 'open',
    ),
    'open',
    'A partial swipe reveals trailing actions',
  )

  await drag(second, -118)
  assert.deepEqual(
    await waitFor(
      async () => [
        await first.getAttribute('data-state'),
        await second.getAttribute('data-state'),
      ],
      (states) => states[0] === 'closed' && states[1] === 'open',
    ),
    ['closed', 'open'],
    'Opening a grouped row closes its peer',
  )

  const rowTwoSnapshot = await second.evaluate((root) => {
    const style = getComputedStyle(root)
    return {
      offset: Number.parseFloat(
        style.getPropertyValue('--swipe-actions-offset'),
      ),
      progress: Number.parseFloat(
        style.getPropertyValue('--swipe-actions-progress'),
      ),
      state: root.getAttribute('data-state'),
    }
  })
  const visibleSnapshot = {
    activeRoot: await page.getByTestId('diagnostic-active-root').textContent(),
    offset: Number.parseFloat(
      (await page.getByTestId('diagnostic-offset').textContent()) ?? '',
    ),
    progress: Number.parseFloat(
      (await page.getByTestId('diagnostic-progress').textContent()) ?? '',
    ),
    velocity: Number.parseFloat(
      (await page.getByTestId('diagnostic-velocity').textContent()) ?? '',
    ),
    owner: await page.getByTestId('diagnostic-owner').textContent(),
    state: await page.getByTestId('diagnostic-open-state').textContent(),
  }
  assert.equal(
    visibleSnapshot.activeRoot,
    'Row 2',
    'Visualizer follows the most recently interacted inbox root',
  )
  assert.ok(
    Math.abs(visibleSnapshot.offset - rowTwoSnapshot.offset) < 0.6,
    'Visualizer offset comes from the open second row',
  )
  assert.ok(
    Math.abs(visibleSnapshot.progress - rowTwoSnapshot.progress) < 0.011,
    'Visualizer progress comes from the open second row',
  )
  assert.ok(rowTwoSnapshot.progress > 0.95, 'Second row is meaningfully open')
  assert.ok(
    Number.isFinite(visibleSnapshot.velocity) && visibleSnapshot.velocity < 0,
    'Visualizer keeps the second-row pointer velocity',
  )
  assert.equal(
    visibleSnapshot.owner,
    'swipe',
    'Visualizer keeps the second-row pointer owner',
  )
  assert.equal(
    visibleSnapshot.state,
    rowTwoSnapshot.state,
    'Visualizer open state comes from the open second row',
  )

  const deleteCount = page.getByTestId('demo-delete-count')
  assert.equal(await deleteCount.textContent(), '0')
  await second.press('Escape')
  await waitFor(
    () => second.getAttribute('data-state'),
    (state) => state === 'closed',
  )
  await drag(second, -310)
  assert.equal(
    await waitFor(
      () => deleteCount.textContent(),
      (count) => count === '1',
    ),
    '1',
    'A full swipe invokes the designated action',
  )

  await first.focus()
  await page.keyboard.press('ArrowLeft')
  await waitFor(
    () => first.getAttribute('data-state'),
    (state) => state === 'open',
  )
  const focusedAction = page.locator('[data-swipe-actions-action]:focus')
  assert.equal(
    await focusedAction.count(),
    1,
    'Keyboard opening focuses a revealed action',
  )
  const focusStyle = await focusedAction.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      outlineWidth: Number.parseFloat(style.outlineWidth),
      outlineOffset: Number.parseFloat(style.outlineOffset),
    }
  })
  assert.ok(
    focusStyle.outlineWidth >= 2,
    'The revealed action has a visible focus stroke',
  )
  assert.ok(
    focusStyle.outlineOffset < 0,
    'The revealed action focus stroke stays inside the clipped row boundary',
  )
}

async function verifyOpeningGeometry(page, viewport) {
  for (const testId of [
    'hero-description',
    'install-command',
    'inbox-demo',
    'canonical-code',
  ]) {
    const box = await page.getByTestId(testId).boundingBox()
    assert.ok(box, `${testId} is rendered at ${viewport.width}px`)
    assert.ok(
      box.x >= 0,
      `${testId} begins inside the ${viewport.width}px viewport`,
    )
    assert.ok(
      box.x + box.width <= viewport.width + 0.5,
      `${testId} ends inside the ${viewport.width}px viewport`,
    )
    assert.ok(box.y >= 0, `${testId} begins inside the opening viewport`)
    assert.ok(
      box.y + box.height <= viewport.height + 0.5,
      `${testId} stays inside ${viewport.width}×${viewport.height} (bottom ${(box.y + box.height).toFixed(1)}px)`,
    )
  }

  const visibleDemoRows = await page
    .getByTestId('inbox-demo')
    .locator('[data-demo-row]')
    .evaluateAll(
      (rows) =>
        rows.filter((row) => {
          const box = row.getBoundingClientRect()
          return box.width > 0 && box.height > 0
        }).length,
    )
  assert.ok(
    visibleDemoRows >= 1,
    'Opening viewport contains a usable swipe row',
  )
}

async function verifyCustomStyling(page) {
  const example = page.locator('[data-example-id="custom-styling"]')
  await example.scrollIntoViewIfNeeded()
  const root = example.locator('[data-swipe-actions-root]')
  const surface = root.locator('[data-swipe-actions-content]')
  const surfaceStyle = await surface.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      backgroundColor: style.backgroundColor,
      borderRadius: style.borderRadius,
    }
  })
  assert.notEqual(
    surfaceStyle.backgroundColor,
    'rgb(255, 255, 255)',
    'Custom styling example owns its content surface color',
  )
  assert.ok(
    Number.parseFloat(surfaceStyle.borderRadius) >= 10,
    'Custom styling example changes the row shape',
  )

  await drag(root, 100)
  await root.locator('[data-swipe-actions-action]').click()
  assert.equal(
    await page.getByTestId('custom-styling-output').textContent(),
    'Priority raised',
    'Custom styling example remains a live package interaction',
  )
}

async function verifyPerformanceLink(browser, baseUrl) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  })
  const page = await context.newPage()
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  const href = await page
    .getByRole('link', { name: 'Open the 1,000-row fixture' })
    .getAttribute('href')
  assert.ok(href, 'Performance fixture query link is rendered')
  await page.goto(new URL(href, baseUrl).href)
  await page.locator('body[data-performance-ready]').waitFor()
  assert.equal(
    await page.getByRole('heading', { name: '1,000 swipe rows' }).count(),
    1,
    'Performance query link renders the fixture',
  )

  const visible = await page.evaluate(() => ({
    rows: Number(
      document.querySelector('[data-testid="performance-row-count"]')
        ?.textContent,
    ),
    mountMs: Number.parseFloat(
      document.querySelector('[data-testid="performance-mount-ms"]')
        ?.textContent ?? '',
    ),
    resizeObservers: Number(
      document.querySelector('[data-testid="performance-resize-observers"]')
        ?.textContent,
    ),
    globalPointerListeners: Number(
      document.querySelector(
        '[data-testid="performance-global-pointer-listeners"]',
      )?.textContent,
    ),
    pendingFrames: Number(
      document.querySelector('[data-testid="performance-pending-frames"]')
        ?.textContent,
    ),
    rowRenders: Number(
      document.querySelector('[data-testid="performance-row-renders"]')
        ?.textContent,
    ),
  }))
  const backing = await page.evaluate(() => ({
    ...window.__swipePerformance__,
  }))
  assert.equal(visible.rows, 1000)
  assert.ok(visible.mountMs > 0, 'Visible mount measurement is finalized')
  assert.ok(
    Math.abs(visible.mountMs - backing.mountMs) < 0.11,
    'Visible mount time matches instrumentation',
  )
  assert.equal(visible.resizeObservers, backing.resizeObservers)
  assert.ok(visible.resizeObservers >= 1000, 'Observer count is nonzero')
  assert.equal(visible.globalPointerListeners, backing.globalPointerListeners)
  assert.equal(visible.pendingFrames, backing.pendingFrames)
  assert.equal(visible.pendingFrames, 0, 'No animation frame remains pending')
  assert.equal(visible.rowRenders, backing.rowRenders)
  assert.ok(visible.rowRenders >= 1000, 'Visible row render count is nonzero')
  await context.close()
}

async function drag(locator, deltaX) {
  const box = await locator.boundingBox()
  assert.ok(box, 'Swipe row is visible')
  const startX = box.x + box.width * 0.72
  const y = box.y + box.height / 2
  await locator.page().mouse.move(startX, y)
  await locator.page().mouse.down()
  await locator.page().mouse.move(startX + deltaX, y, { steps: 8 })
  await locator.page().waitForTimeout(32)
  await locator.page().mouse.up()
}

function createStaticServer(root) {
  return createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://localhost')
      const requestedPath =
        requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname
      const relativePath = decodeURIComponent(requestedPath).replace(/^\/+/, '')
      const filePath = path.resolve(root, relativePath)
      if (!filePath.startsWith(`${path.resolve(root)}${path.sep}`)) {
        response.writeHead(403).end('Forbidden')
        return
      }

      const body = await readFile(filePath)
      response.writeHead(200, { 'content-type': contentType(filePath) })
      response.end(body)
    } catch {
      response.writeHead(404).end('Not found')
    }
  })
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

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8'
  if (file.endsWith('.css')) return 'text/css; charset=utf-8'
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (file.endsWith('.svg')) return 'image/svg+xml'
  return 'application/octet-stream'
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function waitFor(read, accepts, timeoutMs = 1500) {
  const deadline = Date.now() + timeoutMs
  let value = await read()
  while (!accepts(value) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25))
    value = await read()
  }
  return value
}

async function pathExists(file) {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}
