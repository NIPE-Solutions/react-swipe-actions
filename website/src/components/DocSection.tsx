import type { ReactNode } from 'react'

export function DocSection({
  id,
  title,
  intro,
  children,
}: {
  id: string
  title: string
  intro: string
  children?: ReactNode
}) {
  return (
    <section id={id} className="doc-section">
      <header className="doc-section__heading">
        <h2>{title}</h2>
        <p>{intro}</p>
      </header>
      {children}
    </section>
  )
}
