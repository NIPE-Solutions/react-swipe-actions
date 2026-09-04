import { useRef } from 'react'
import type { SwipeActionsGroupProps } from '../public-types'
import { GroupContext } from './context'
import type { GroupRegistry } from './context'

export function Group({ children }: SwipeActionsGroupProps) {
  const closeCallbacksRef = useRef(new Map<string, () => void>())
  const openIdRef = useRef<string | null>(null)
  const registryRef = useRef<GroupRegistry | null>(null)

  if (registryRef.current === null) {
    registryRef.current = {
      register(id, close) {
        closeCallbacksRef.current.set(id, close)

        return () => {
          if (closeCallbacksRef.current.get(id) !== close) {
            return
          }

          closeCallbacksRef.current.delete(id)

          if (openIdRef.current === id) {
            openIdRef.current = null
          }
        }
      },
      notifyOpen(id) {
        const previousId = openIdRef.current

        if (previousId === id) {
          return
        }

        if (previousId !== null) {
          closeCallbacksRef.current.get(previousId)?.()
        }

        openIdRef.current = id
      },
    }
  }

  return (
    <GroupContext.Provider value={registryRef.current}>
      {children}
    </GroupContext.Provider>
  )
}
