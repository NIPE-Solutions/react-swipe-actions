import assert from 'node:assert/strict'
import console from 'node:console'
import { access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import * as api from '@nipe-solutions/react-swipe-actions'

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
  const resolved = import.meta.resolve(
    `@nipe-solutions/react-swipe-actions/${cssExport}`,
  )
  await access(fileURLToPath(resolved))
}

await assert.rejects(
  import('@nipe-solutions/react-swipe-actions/src/index.ts'),
  (error) => error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
)

console.log(JSON.stringify(expectedExports))
