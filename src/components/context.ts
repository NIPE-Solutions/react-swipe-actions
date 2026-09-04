import { createContext } from 'react'

export interface GroupRegistry {
  register(id: string, close: () => void): () => void
  notifyOpen(id: string): void
}

export const GroupContext = createContext<GroupRegistry | null>(null)
