export function ProjectMark() {
  return (
    <svg
      className="wordmark__mark"
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" rx="15" fill="#10213d" />
      <rect
        data-mark-part="action"
        x="7"
        y="18"
        width="21"
        height="28"
        rx="7"
        fill="#1f63d6"
      />
      <circle cx="17.5" cy="32" r="3" fill="#ffffff" />
      <rect
        data-mark-part="content"
        x="20"
        y="11"
        width="37"
        height="42"
        rx="10"
        fill="#ffffff"
      />
      <rect x="28" y="23" width="21" height="5" rx="2.5" fill="#9aabc0" />
      <rect x="28" y="35" width="14" height="5" rx="2.5" fill="#d2dbe6" />
    </svg>
  )
}
