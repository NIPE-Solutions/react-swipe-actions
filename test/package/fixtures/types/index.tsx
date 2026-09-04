import { createRef } from 'react'
import {
  Action,
  Content,
  Group,
  Leading,
  Root,
  SwipeActions,
  Trailing,
  type SwipeActionsActionProps,
  type SwipeActionsContentProps,
  type SwipeActionsDirection,
  type SwipeActionsGroupProps,
  type SwipeActionsHandle,
  type SwipeActionsOpenSide,
  type SwipeActionsRootProps,
  type SwipeActionsSide,
  type SwipeActionsSideProps,
} from '@nipe-solutions/react-swipe-actions'

const side: SwipeActionsSide = 'leading'
const openSide: SwipeActionsOpenSide = side
const direction: SwipeActionsDirection = 'ltr'
const handle = createRef<SwipeActionsHandle>()
const rootProps: SwipeActionsRootProps = { direction, openSide }
const contentProps: SwipeActionsContentProps = { children: 'Content' }
const sideProps: SwipeActionsSideProps = { children: 'Actions' }
const actionProps: SwipeActionsActionProps = { onAction: () => undefined }
const groupProps: SwipeActionsGroupProps = { children: null }

export const fixture = (
  <Group {...groupProps}>
    <Root {...rootProps} ref={handle}>
      <Leading {...sideProps} />
      <Content {...contentProps} />
      <Trailing {...sideProps}>
        <Action {...actionProps}>Delete</Action>
      </Trailing>
    </Root>
    <SwipeActions.Root>
      <SwipeActions.Content />
    </SwipeActions.Root>
  </Group>
)
