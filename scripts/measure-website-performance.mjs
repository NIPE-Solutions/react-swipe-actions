import assert from 'node:assert/strict'
import console from 'node:console'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { chromium } from '@playwright/test'

const buildRoot = path.resolve(import.meta.dirname, '../website/dist')
const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost')
    const requestedPath =
      requestUrl.pathname === '/' ? 'index.html' : requestUrl.pathname.slice(1)
    const file = path.resolve(buildRoot, decodeURIComponent(requestedPath))
    assert.ok(file.startsWith(`${buildRoot}${path.sep}`))
    const body = await readFile(file)
    response.writeHead(200, { 'content-type': contentType(file) })
    response.end(body)
  } catch {
    response.writeHead(404).end('Not found')
  }
})

await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})
const address = server.address()
assert.ok(address && typeof address === 'object')
const baseUrl = `http://127.0.0.1:${address.port}`
const browser = await chromium.launch()
const measurements = []

try {
  for (const rows of [100, 1000]) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    })
    await page.goto(`${baseUrl}/?fixture=performance&rows=${rows}`, {
      waitUntil: 'networkidle',
    })
    await page.waitForFunction(
      () => window.__swipePerformance__?.mountMs > 0,
      undefined,
      { timeout: 15_000 },
    )
    await page.waitForTimeout(250)

    const mounted = await readMetrics(page)
    const listenerAttribution = await readWindowPointerListeners(page)
    assert.equal(mounted.resizeObservers, rows * 5)
    assert.equal(listenerAttribution.pageOwned, 0)
    assert.equal(mounted.pendingFrames, 0)

    const roots = page.locator('[data-performance-row]')
    assert.equal(await roots.count(), rows)
    const first = roots.nth(0)
    const second = roots.nth(1)

    const beforeFirstOpen = (await readMetrics(page)).rowRenders
    await first.focus()
    await page.keyboard.press('ArrowLeft')
    await first.waitFor({ state: 'visible' })
    await waitForState(first, 'open')
    const firstOpenRenders =
      (await readMetrics(page)).rowRenders - beforeFirstOpen

    const beforeTransfer = (await readMetrics(page)).rowRenders
    await second.focus()
    await page.keyboard.press('ArrowLeft')
    await waitForState(second, 'open')
    await waitForState(first, 'closed')
    const transferRenders =
      (await readMetrics(page)).rowRenders - beforeTransfer

    await second.press('Escape')
    await waitForState(second, 'closed')
    await page.evaluate(() => {
      window.__traceFrames__ = []
      let frame = 0
      const sample = (time) => {
        window.__traceFrames__.push(time)
        frame = requestAnimationFrame(sample)
        window.__traceFrameId__ = frame
      }
      window.__traceFrameId__ = requestAnimationFrame(sample)
    })
    await drag(first, -118)
    await waitForState(first, 'open')
    const frameTimes = await page.evaluate(() => {
      cancelAnimationFrame(window.__traceFrameId__)
      return window.__traceFrames__
    })
    const frameDeltas = frameTimes
      .slice(1)
      .map((time, index) => time - frameTimes[index])
    const idle = await waitForIdle(page)

    measurements.push({
      rows,
      mountMs: mounted.mountMs,
      resizeObservers: mounted.resizeObservers,
      idlePendingFrames: mounted.pendingFrames,
      rawWindowPointerListeners: listenerAttribution.total,
      automationPointerListeners: listenerAttribution.automation,
      packagePointerListeners: listenerAttribution.pageOwned,
      initialRowRenders: mounted.rowRenders,
      firstOpenRenders,
      transferRenders,
      dragTrace: summarize(frameDeltas),
      postInteractionPendingFrames: idle.pendingFrames,
    })
    await page.close()
  }

  console.log(
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        browser: `Chromium ${browser.version()}`,
        node: process.version,
        viewport: '1440x1000',
        measurements,
      },
      null,
      2,
    ),
  )
} finally {
  await browser.close()
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
}

async function readMetrics(page) {
  return page.evaluate(() => ({ ...window.__swipePerformance__ }))
}

async function readWindowPointerListeners(page) {
  const session = await page.context().newCDPSession(page)
  await session.send('Debugger.enable')
  const evaluation = await session.send('Runtime.evaluate', {
    expression: 'window',
  })
  const objectId = evaluation.result.objectId
  assert.ok(objectId)
  const result = await session.send('DOMDebugger.getEventListeners', {
    objectId,
  })
  const listeners = result.listeners.filter((listener) =>
    listener.type.startsWith('pointer'),
  )
  let automation = 0
  for (const listener of listeners) {
    const source = await session.send('Debugger.getScriptSource', {
      scriptId: listener.scriptId,
    })
    if (source.scriptSource.includes('_setupHitTargetInterceptors')) {
      automation += 1
    }
  }
  await session.detach()
  return {
    total: listeners.length,
    automation,
    pageOwned: listeners.length - automation,
  }
}

async function waitForState(locator, state) {
  await locator.evaluate(
    (element, expected) =>
      new Promise((resolve, reject) => {
        const deadline = performance.now() + 2_000
        const check = () => {
          if (element.getAttribute('data-state') === expected) {
            resolve(undefined)
          } else if (performance.now() >= deadline) {
            reject(new Error(`Timed out waiting for data-state=${expected}`))
          } else {
            requestAnimationFrame(check)
          }
        }
        check()
      }),
    state,
  )
}

async function waitForIdle(page) {
  let snapshot = await readMetrics(page)
  for (
    let attempt = 0;
    attempt < 80 && snapshot.pendingFrames !== 0;
    attempt += 1
  ) {
    await page.waitForTimeout(25)
    snapshot = await readMetrics(page)
  }
  return snapshot
}

async function drag(locator, deltaX) {
  const box = await locator.boundingBox()
  assert.ok(box)
  const startX = box.x + box.width * 0.7
  const y = box.y + box.height / 2
  await locator.page().mouse.move(startX, y)
  await locator.page().mouse.down()
  await locator.page().mouse.move(startX + deltaX, y, { steps: 12 })
  await locator.page().mouse.up()
}

function summarize(values) {
  const sorted = [...values].sort((left, right) => left - right)
  return {
    frames: values.length,
    medianMs: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted.at(-1) ?? 0,
  }
}

function percentile(sorted, ratio) {
  if (sorted.length === 0) return 0
  return Number(
    sorted[
      Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))
    ].toFixed(2),
  )
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8'
  if (file.endsWith('.css')) return 'text/css; charset=utf-8'
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8'
  return 'application/octet-stream'
}
