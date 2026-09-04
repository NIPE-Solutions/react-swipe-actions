import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useControllableOpenSide } from '../../src/state/controllable'
import type { SwipeActionsOpenSide } from '../../src/public-types'

interface HarnessProps {
  value?: SwipeActionsOpenSide
  defaultValue?: SwipeActionsOpenSide
  onChange?: (side: SwipeActionsOpenSide) => void
}

function Harness({ value, defaultValue, onChange }: HarnessProps) {
  const [side, requestSide] = useControllableOpenSide({
    value,
    defaultValue,
    onChange,
  })

  return (
    <>
      <button type="button" onClick={() => requestSide('leading')}>
        Request leading
      </button>
      <output>{side ?? 'closed'}</output>
    </>
  )
}

describe('useControllableOpenSide', () => {
  it('updates uncontrolled state and reports the requested side once', () => {
    const onChange = vi.fn()

    render(<Harness defaultValue={null} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Request leading' }))

    expect(screen.getByRole('status')).toHaveTextContent('leading')
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('leading')
  })

  it('keeps controlled state at its prop while requesting a change', () => {
    const onChange = vi.fn()
    const { rerender } = render(<Harness value={null} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Request leading' }))

    expect(screen.getByRole('status')).toHaveTextContent('closed')
    expect(onChange).toHaveBeenCalledExactlyOnceWith('leading')

    rerender(<Harness value="leading" onChange={onChange} />)

    expect(screen.getByRole('status')).toHaveTextContent('leading')
  })

  it('does not report an identical controlled request twice', () => {
    const onChange = vi.fn()

    render(<Harness value={null} onChange={onChange} />)

    const requestLeading = screen.getByRole('button', {
      name: 'Request leading',
    })
    fireEvent.click(requestLeading)
    fireEvent.click(requestLeading)

    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('leading')
  })
})
