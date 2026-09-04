import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  symlink,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import test from 'node:test'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const repositoryRoot = path.resolve(import.meta.dirname, '..')
const isNestedCheck = process.env.SWIPE_ACTIONS_CLEAN_CHECK_CHILD === '1'
const installsDependencies =
  process.env.SWIPE_ACTIONS_CLEAN_CHECK_INSTALL === '1'

test(
  'npm run check passes from a tracked snapshot without dist',
  { skip: isNestedCheck ? 'already inside the clean-check snapshot' : false },
  async () => {
    const snapshot = await mkdtemp(path.join(tmpdir(), 'swipe-clean-check-'))

    try {
      const emptyBrowserCache = path.join(snapshot, 'empty-browser-cache')
      await mkdir(emptyBrowserCache)
      const [{ stdout: trackedOutput }, { stdout: deletedOutput }] =
        await Promise.all([
          execFileAsync(
            'git',
            ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
            { cwd: repositoryRoot },
          ),
          execFileAsync('git', ['ls-files', '--deleted', '-z'], {
            cwd: repositoryRoot,
          }),
        ])
      const deletedFiles = new Set(deletedOutput.split('\0').filter(Boolean))
      const trackedFiles = trackedOutput
        .split('\0')
        .filter((file) => file && !deletedFiles.has(file))

      for (const relativePath of trackedFiles) {
        const destination = path.join(snapshot, relativePath)
        await mkdir(path.dirname(destination), { recursive: true })
        await copyFile(path.join(repositoryRoot, relativePath), destination)
      }

      await assert.rejects(access(path.join(snapshot, 'dist')), {
        code: 'ENOENT',
      })
      if (installsDependencies) {
        await execFileAsync('npm', ['ci'], {
          cwd: snapshot,
          maxBuffer: 20 * 1024 * 1024,
        })
      } else {
        await symlink(
          path.join(repositoryRoot, 'node_modules'),
          path.join(snapshot, 'node_modules'),
          'dir',
        )
      }

      const childEnvironment = {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: emptyBrowserCache,
        SWIPE_ACTIONS_CLEAN_CHECK_CHILD: '1',
      }
      delete childEnvironment.NODE_TEST_CONTEXT

      const { stdout, stderr } = await execFileAsync('npm', ['run', 'check'], {
        cwd: snapshot,
        env: childEnvironment,
        maxBuffer: 20 * 1024 * 1024,
      })

      assert.equal(stderr, '')
      assert.match(stdout, /Public API verified \(16 exports\)/)
      assert.match(
        stdout,
        /Website structure verified \(24 sections, 14 examples/,
      )
      assert.deepEqual(
        await readdir(emptyBrowserCache),
        [],
        'the browser-free quality gate must not install into its empty cache',
      )
    } finally {
      await rm(snapshot, { recursive: true, force: true })
    }
  },
)
