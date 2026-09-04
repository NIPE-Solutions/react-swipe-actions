export type SwipeActionsSide = 'leading' | 'trailing'

export type SwipeActionsOpenSide = SwipeActionsSide | null

export type SwipeActionsDirection = 'ltr' | 'rtl'

export interface SwipeActionsHandle {
  open(side: SwipeActionsSide): void
  close(): void
}
