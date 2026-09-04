import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { SwipeActions } from '@nipe-solutions/react-swipe-actions'
import '@nipe-solutions/react-swipe-actions/styles.css'

const row = createElement(
  SwipeActions.Root,
  { 'aria-label': 'Packed Vite row' },
  createElement(SwipeActions.Content, null, 'Bundled consumer'),
)

createRoot(document.getElementById('root')).render(row)
