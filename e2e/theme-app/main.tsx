import { createRoot } from 'react-dom/client'

import { Action, Content, Leading, Root } from '../../src'
import '../../src/styles/styles.css'
import './styles.css'

function ThemeFixture() {
  return (
    <main>
      <Root aria-label="Theme motion fixture" data-testid="theme-root">
        <Leading>
          <Action onAction={() => undefined}>Archive</Action>
        </Leading>
        <Content data-testid="theme-content">Direct motion</Content>
      </Root>
      <span hidden data-testid="fixture-ready">
        ready
      </span>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<ThemeFixture />)
