import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('package metadata has the approved identity and dependency policy', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'))
  assert.equal(pkg.name, '@nipe-solutions/react-swipe-actions')
  assert.equal(pkg.version, '0.1.0-alpha.0')
  assert.equal(pkg.type, 'module')
  assert.deepEqual(pkg.peerDependencies, {
    react: '^18.3.0 || ^19.0.0',
    'react-dom': '^18.3.0 || ^19.0.0',
  })
  assert.deepEqual(pkg.dependencies ?? {}, {})
  assert.equal(pkg.engines.node, '>=24 <25')
})
