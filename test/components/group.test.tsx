import { act, render } from '@testing-library/react'
import { useContext } from 'react'
import type { ContextType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Action, Content, Leading, Root } from '../../src'
import { GroupContext } from '../../src/components/context'
import { Group } from '../../src/components/group'
import type { SwipeActionsOpenSide } from '../../src/public-types'
import { resizeObserverMock } from '../setup'

type GroupRegistry = NonNullable<ContextType<typeof GroupContext>>

function RegistryReader({
  onRegistry,
}: {
  onRegistry: (registry: GroupRegistry) => void
}) {
  const registry = useContext(GroupContext)

  if (registry === null) {
    throw new Error('RegistryReader must be rendered inside Group')
  }

  onRegistry(registry)

  return <span data-testid="registry-reader">registry reader</span>
}

function createFrameLoop() {
  let time = 0
  let identifier = 0
  const callbacks = new Map<number, FrameRequestCallback>()

  return {
    install() {
      vi.stubGlobal(
        'requestAnimationFrame',
        (callback: FrameRequestCallback) => {
          identifier += 1
          callbacks.set(identifier, callback)
          return identifier
        },
      )
      vi.stubGlobal('cancelAnimationFrame', (frame: number) => {
        callbacks.delete(frame)
      })
      vi.spyOn(performance, 'now').mockImplementation(() => time)
    },
    advance(milliseconds: number) {
      time += milliseconds
      const current = [...callbacks.values()]
      callbacks.clear()
      act(() => current.forEach((callback) => callback(time)))
    },
  }
}

function dispatchPointer(
  target: Element,
  type: string,
  clientX: number,
  timeStamp: number,
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'touch' },
    isPrimary: { value: true },
    button: { value: 0 },
    clientX: { value: clientX },
    clientY: { value: 0 },
    timeStamp: { value: timeStamp },
  })
  act(() => target.dispatchEvent(event))
}

async function renderRows(controlledSecond: boolean) {
  const firstChange = vi.fn()
  const secondChange = vi.fn()
  const rendered = render(
    <Group>
      <Root
        defaultOpenSide="leading"
        onOpenSideChange={firstChange}
        data-testid="first-root"
      >
        <Leading data-testid="first-leading">
          <Action onAction={() => undefined}>Archive first</Action>
        </Leading>
        <Content data-testid="first-content">First</Content>
      </Root>
      <Root
        {...(controlledSecond
          ? { openSide: null as SwipeActionsOpenSide }
          : {})}
        onOpenSideChange={secondChange}
        data-testid="second-root"
      >
        <Leading data-testid="second-leading">
          <Action onAction={() => undefined}>Archive second</Action>
        </Leading>
        <Content data-testid="second-content">Second</Content>
      </Root>
    </Group>,
  )

  const firstContent = rendered.getByTestId('first-content')
  const secondContent = rendered.getByTestId('second-content')
  for (const content of [firstContent, secondContent]) {
    Object.assign(content, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    })
  }
  act(() => {
    resizeObserverMock.emit(firstContent, 320)
    resizeObserverMock.emit(secondContent, 320)
    resizeObserverMock.emit(rendered.getByTestId('first-leading'), 80)
    resizeObserverMock.emit(rendered.getByTestId('second-leading'), 80)
  })
  await act(() => Promise.resolve())

  return {
    ...rendered,
    firstChange,
    secondChange,
    firstRoot: rendered.getByTestId('first-root'),
    secondRoot: rendered.getByTestId('second-root'),
    secondContent,
  }
}

describe('Group', () => {
  const frames = createFrameLoop()

  beforeEach(() => frames.install())
  afterEach(() => vi.unstubAllGlobals())

  it('closes the previously open registered row', () => {
    let registry: GroupRegistry | undefined
    const closed: string[] = []

    render(
      <Group>
        <RegistryReader onRegistry={(value) => (registry = value)} />
      </Group>,
    )

    registry!.register('a', () => closed.push('a'))
    registry!.register('b', () => closed.push('b'))
    registry!.notifyOpen('a')
    registry!.notifyOpen('b')

    expect(closed).toEqual(['a'])
  })

  it('does not retain a close callback after its row unregisters', () => {
    let registry: GroupRegistry | undefined
    let closes = 0

    render(
      <Group>
        <RegistryReader onRegistry={(value) => (registry = value)} />
      </Group>,
    )

    const unregisterA = registry!.register('a', () => {
      closes += 1
    })
    registry!.register('b', () => undefined)
    registry!.notifyOpen('a')
    registry!.notifyOpen('b')
    unregisterA()
    registry!.notifyOpen('a')
    registry!.notifyOpen('b')

    expect(closes).toBe(1)
  })

  it('keeps registry consumers from rerendering when rows notify', () => {
    let registry: GroupRegistry | undefined
    let renders = 0

    const { container } = render(
      <Group>
        <RegistryReader
          onRegistry={(value) => {
            renders += 1
            registry = value
          }}
        />
      </Group>,
    )

    registry!.notifyOpen('a')
    registry!.notifyOpen('b')

    expect(renders).toBe(1)
    expect(container.innerHTML).toBe(
      '<span data-testid="registry-reader">registry reader</span>',
    )
  })

  it('closes the previous row when a dragged opening commits, before settle completes', async () => {
    // Catches group ownership waiting for the successor's settled openSide update.
    const rows = await renderRows(false)

    dispatchPointer(rows.secondContent, 'pointerdown', 0, 1)
    dispatchPointer(rows.secondContent, 'pointermove', 50, 10)

    expect(rows.secondRoot).toHaveAttribute('data-state', 'dragging')
    expect(rows.firstRoot).toHaveAttribute('data-state', 'open')
    expect(rows.firstChange).not.toHaveBeenCalled()

    dispatchPointer(rows.secondContent, 'pointerup', 50, 200)

    expect(rows.secondRoot).toHaveAttribute('data-state', 'settling')
    expect(rows.firstRoot).toHaveAttribute('data-state', 'settling')
    expect(rows.firstRoot).toHaveStyle('--swipe-actions-offset: 80px')
    expect(rows.firstChange).not.toHaveBeenCalled()

    frames.advance(60)
    expect(rows.firstRoot).toHaveAttribute('data-state', 'settling')
    expect(
      Number.parseFloat(
        rows.firstRoot.style.getPropertyValue('--swipe-actions-offset'),
      ),
    ).toBeGreaterThan(0)
    expect(
      Number.parseFloat(
        rows.firstRoot.style.getPropertyValue('--swipe-actions-offset'),
      ),
    ).toBeLessThan(80)

    frames.advance(400)
    await act(() => Promise.resolve())

    expect(rows.firstRoot).toHaveAttribute('data-state', 'closed')
    expect(rows.secondRoot).toHaveAttribute('data-state', 'open')
    expect(rows.secondChange).toHaveBeenCalledExactlyOnceWith('leading')
    expect(rows.firstChange).toHaveBeenCalledTimes(1)
  })

  it('coordinates a controlled opening intent once while the prop stays authoritative', async () => {
    // Catches controlled successors skipping early coordination or duplicating peer closes.
    const rows = await renderRows(true)

    dispatchPointer(rows.secondContent, 'pointerdown', 0, 1)
    dispatchPointer(rows.secondContent, 'pointermove', 50, 10)
    expect(rows.firstRoot).toHaveAttribute('data-state', 'open')

    dispatchPointer(rows.secondContent, 'pointerup', 50, 200)

    expect(rows.secondRoot).toHaveAttribute('data-state', 'settling')
    expect(rows.firstRoot).toHaveAttribute('data-state', 'settling')
    expect(rows.firstChange).not.toHaveBeenCalled()
    expect(rows.secondChange).not.toHaveBeenCalled()

    frames.advance(400)
    await act(() => Promise.resolve())

    expect(rows.secondChange).toHaveBeenCalledExactlyOnceWith('leading')
    expect(rows.secondRoot).toHaveAttribute('data-state', 'open')
    expect(rows.secondRoot).toHaveStyle('--swipe-actions-offset: 80px')

    await act(() => new Promise((resolve) => setTimeout(resolve, 60)))
    expect(rows.secondRoot).toHaveAttribute('data-state', 'settling')
    frames.advance(400)
    await act(() => Promise.resolve())

    expect(rows.secondRoot).toHaveAttribute('data-state', 'closed')
    expect(rows.firstRoot).toHaveAttribute('data-state', 'closed')
    expect(rows.firstChange).toHaveBeenCalledExactlyOnceWith(null)
  })
})
