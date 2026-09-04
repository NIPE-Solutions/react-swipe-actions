import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

export type SwipeActionsSide = 'leading' | 'trailing'

export type SwipeActionsOpenSide = SwipeActionsSide | null

export type SwipeActionsDirection = 'ltr' | 'rtl'

export interface SwipeActionsHandle {
  open(side: SwipeActionsSide): void
  close(): void
}

export interface SwipeActionsRootProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children'
> {
  children?: ReactNode
  openSide?: SwipeActionsOpenSide
  defaultOpenSide?: SwipeActionsOpenSide
  onOpenSideChange?: (side: SwipeActionsOpenSide) => void
  disabled?: boolean
  direction?: SwipeActionsDirection
  openThreshold?: number
  fullSwipeThreshold?: number
}

export type SwipeActionsContentProps = HTMLAttributes<HTMLDivElement>

export type SwipeActionsSideProps = HTMLAttributes<HTMLDivElement>

export interface SwipeActionsActionProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick' | 'type'
> {
  onAction: () => unknown
  destructive?: boolean
  fullSwipe?: boolean
}

export interface SwipeActionsGroupProps {
  children?: ReactNode
}
