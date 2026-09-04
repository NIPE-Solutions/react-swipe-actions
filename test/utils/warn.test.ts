import { afterEach, describe, expect, it } from 'vitest'

import { warnOnce } from '../../src/utils/warn'

const originalWarn = console.warn
const originalNodeEnv = process.env.NODE_ENV

afterEach(() => {
  console.warn = originalWarn
  process.env.NODE_ENV = originalNodeEnv
})

describe('warnOnce', () => {
  it('emits one development warning for a duplicate key', () => {
    // Catches duplicate configuration warnings flooding the development console.
    const messages: string[] = []
    process.env.NODE_ENV = 'development'
    console.warn = (message: unknown) => {
      messages.push(String(message))
    }

    warnOnce('task-3-duplicate-warning', 'Keep the first action only.')
    warnOnce('task-3-duplicate-warning', 'Keep the first action only.')

    expect(messages).toEqual(['Keep the first action only.'])
  })

  it('does not emit warnings in production', () => {
    // Catches development diagnostics leaking into production consumers.
    const messages: string[] = []
    process.env.NODE_ENV = 'production'
    console.warn = (message: unknown) => {
      messages.push(String(message))
    }

    warnOnce('task-3-production-warning', 'This must remain silent.')

    expect(messages).toEqual([])
  })
})
