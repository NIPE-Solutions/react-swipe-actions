import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { SwipeActions } from '@nipe-solutions/react-swipe-actions'

const tree = createElement(
  'div',
  { dir: 'rtl' },
  createElement(
    SwipeActions.Root,
    { defaultOpenSide: 'leading', 'aria-label': 'Server row actions' },
    createElement(
      SwipeActions.Leading,
      null,
      createElement(
        SwipeActions.Action,
        { onAction: () => undefined },
        'Archive',
      ),
    ),
    createElement(SwipeActions.Content, null, 'Server rendered'),
  ),
)
const html = renderToString(tree)

assert.match(html, /data-swipe-actions-root=""/)
assert.match(html, /data-swipe-actions-content=""/)
assert.match(html, /Server rendered/)
assert.match(html, /data-state="open"/)

const dom = new JSDOM(`<div id="app">${html}</div>`, {
  pretendToBeVisual: true,
  url: 'https://consumer.example/',
})
const previousGlobals = new Map()
for (const [name, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node,
  MutationObserver: dom.window.MutationObserver,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
})) {
  previousGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  })
}

const recoverableErrors = []
const { hydrateRoot } = await import('react-dom/client')
const container = dom.window.document.getElementById('app')
const root = hydrateRoot(container, tree, {
  onRecoverableError: (error) => recoverableErrors.push(error),
})

const deadline = Date.now() + 1_000
while (
  container
    .querySelector('[data-swipe-actions-root]')
    ?.getAttribute('tabindex') !== '0' &&
  Date.now() < deadline
) {
  await new Promise((resolve) => setTimeout(resolve, 10))
}

assert.deepEqual(recoverableErrors, [])
assert.equal(
  container
    .querySelector('[data-swipe-actions-root]')
    ?.getAttribute('data-state'),
  'open',
)
assert.equal(
  container
    .querySelector('[data-swipe-actions-root]')
    ?.getAttribute('tabindex'),
  '0',
)

root.unmount()
await new Promise((resolve) => setImmediate(resolve))
dom.window.close()
for (const [name, descriptor] of previousGlobals) {
  if (descriptor === undefined) {
    delete globalThis[name]
  } else {
    Object.defineProperty(globalThis, name, descriptor)
  }
}

console.log('SSR render and hydration passed')
