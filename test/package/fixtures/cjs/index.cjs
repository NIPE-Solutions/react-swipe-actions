/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const console = require('node:console')
const { accessSync } = require('node:fs')
const api = require('@nipe-solutions/react-swipe-actions')

const expectedExports = [
  'Action',
  'Content',
  'Group',
  'Leading',
  'Root',
  'SwipeActions',
  'Trailing',
]

assert.deepEqual(Object.keys(api).sort(), expectedExports)
assert.equal(api.SwipeActions.Root, api.Root)
assert.equal(api.SwipeActions.Content, api.Content)
assert.equal(api.SwipeActions.Leading, api.Leading)
assert.equal(api.SwipeActions.Trailing, api.Trailing)
assert.equal(api.SwipeActions.Action, api.Action)
assert.equal(api.SwipeActions.Group, api.Group)

for (const cssExport of ['core.css', 'theme.css', 'styles.css']) {
  accessSync(
    require.resolve(`@nipe-solutions/react-swipe-actions/${cssExport}`),
  )
}

assert.throws(
  () => require('@nipe-solutions/react-swipe-actions/src/index.ts'),
  (error) => error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
)

console.log(JSON.stringify(expectedExports))
