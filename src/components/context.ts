import { createContext } from 'react'
import type {
  SwipeActionsDirection,
  SwipeActionsOpenSide,
  SwipeActionsSide,
} from '../public-types'

export interface GroupRegistry {
  register(id: string, close: () => void): () => void
  notifyOpen(id: string): void
}

export const GroupContext = createContext<GroupRegistry | null>(null)

export interface RootContextValue {
  direction: SwipeActionsDirection
  openSide: SwipeActionsOpenSide
  openThreshold: number
  fullSwipeThreshold: number
  registerContent(id: symbol): () => void
  updateContentWidth(id: symbol, width: number): void
  registerSide(side: SwipeActionsSide, id: symbol): () => void
  updateSideWidth(side: SwipeActionsSide, id: symbol, width: number): void
  registerAction(
    side: SwipeActionsSide,
    containerId: symbol,
    id: symbol,
    action: RegisteredAction,
  ): () => void
  updateActionWidth(side: SwipeActionsSide, id: symbol, width: number): void
  configurationChanged(): void
  measurements(): MeasurementSnapshot
}

export interface SideContextValue {
  side: SwipeActionsSide
  containerId: symbol
}

export interface RegisteredAction {
  element: HTMLButtonElement | null
  width: number
  fullSwipe: boolean
  disabled: boolean
  invoke: () => void
}

export interface RegisteredActionEntry {
  containerId: symbol
  action: RegisteredAction
}

export interface SideMeasurementSnapshot {
  width: number
  fullSwipeAction: RegisteredAction | null
}

export interface MeasurementSnapshot {
  contentWidth: number
  leading: SideMeasurementSnapshot
  trailing: SideMeasurementSnapshot
}

export const RootContext = createContext<RootContextValue | null>(null)
export const SideContext = createContext<SideContextValue | null>(null)
