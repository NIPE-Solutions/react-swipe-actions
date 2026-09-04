import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Content, Leading, Trailing } from '../../src'

describe('SwipeActions context warnings', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development'
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => vi.restoreAllMocks())

  it('warns once when Content is rendered outside Root', async () => {
    // Catches a disconnected drag surface failing silently or warning per render.
    const { rerender } = render(<Content>Message</Content>)
    rerender(<Content>Updated message</Content>)

    await waitFor(() => expect(console.warn).toHaveBeenCalledOnce())
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/Content.*inside.*Root.*Move/i),
    )
  })

  it.each([
    ['Leading', Leading],
    ['Trailing', Trailing],
  ] as const)(
    'warns once when %s is rendered outside Root',
    async (name, Side) => {
      // Catches an unregistered side container failing silently or warning per render.
      const { rerender } = render(<Side>Actions</Side>)
      rerender(<Side>Updated actions</Side>)

      await waitFor(() => expect(console.warn).toHaveBeenCalledOnce())
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`${name}.*inside.*Root.*Move`, 'i')),
      )
    },
  )
})
