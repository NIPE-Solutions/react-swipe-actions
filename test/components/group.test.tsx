import { render } from '@testing-library/react'
import { useContext } from 'react'
import type { ContextType } from 'react'
import { describe, expect, it } from 'vitest'
import { GroupContext } from '../../src/components/context'
import { Group } from '../../src/components/group'

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

describe('Group', () => {
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
})
