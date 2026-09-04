import type { ReactNode } from 'react'

import { navigationGroups, siteLinks, siteMetadata } from '../content'

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
          {navigationGroups.map(({ label, entries }) => (
            <div className="rail-group" key={label}>
              <p className="rail-group__label">{label}</p>
              <ol>
                {entries.map(([id, entryLabel]) => (
                  <li key={id}>
                    <a href={`#${id}`}>{entryLabel}</a>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </nav>
        <nav className="rail-utilities" aria-label="Project links">
          <a href={siteLinks.github}>GitHub</a>
          <a href={siteLinks.changelog}>Changelog</a>
          <a href={siteLinks.nipeOpenSource}>NIPE Open Source</a>
        </nav>
        <p className="rail-note">
          {siteMetadata.statusLabel} · {siteMetadata.reactCompatibility}
        </p>
      </aside>
      <main>{children}</main>
    </div>
  )
}
