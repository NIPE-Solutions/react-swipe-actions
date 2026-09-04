import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { SwipeActions } from '@nipe-solutions/react-swipe-actions'

const html = renderToString(
  createElement(
    SwipeActions.Root,
    null,
    createElement(SwipeActions.Content, null, 'Server rendered'),
  ),
)

assert.match(html, /data-swipe-actions-root=""/)
assert.match(html, /data-swipe-actions-content=""/)
assert.match(html, /Server rendered/)
