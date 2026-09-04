import type { ReactNode } from 'react'

import { sections } from '../content'

export function DocsShell({ children }: { children: ReactNode }) {
  return (
    <div className="docs-shell">
      <a className="skip-link" href="#introduction">
        Skip to documentation
      </a>
      <aside className="docs-rail">
        <a
          className="wordmark"
          href="#introduction"
          aria-label="React Swipe Actions home"
        >
          <span className="wordmark__mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            React
            <strong>Swipe Actions</strong>
          </span>
        </a>
        <nav aria-label="Documentation sections">
          <ol>
            {sections.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ol>
        </nav>
        <p className="rail-note">Alpha 0.1 · React 18.3 and 19</p>
      </aside>
      <main>{children}</main>
    </div>
  )
}
