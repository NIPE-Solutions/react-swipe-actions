import { useState } from 'react'

export function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="code-block">
      <div className="code-block__bar">
        <span>{label}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(code)
            setCopied(true)
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre tabIndex={0} aria-label={`${label} code`}>
        <code>{code}</code>
      </pre>
    </div>
  )
}
