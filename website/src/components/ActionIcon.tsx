interface ActionIconProps {
  name: 'archive' | 'delete' | 'flag' | 'snooze'
}

const paths = {
  archive: (
    <>
      <path d="M3 5.5h14M5 5.5v10h10v-10M8 9h4" />
      <path d="M2.5 2.5h15v3h-15z" />
    </>
  ),
  delete: (
    <>
      <path d="M3.5 5h13M8 2.5h4l1 2.5M6 5l.7 12h6.6L14 5M8.5 8v6M11.5 8v6" />
    </>
  ),
  flag: <path d="M5 18V3m0 1h9l-1.5 3L14 10H5" />,
  snooze: (
    <>
      <circle cx="10" cy="11" r="6.5" />
      <path d="M10 7.5V11l2.5 1.5M5 2.5 2.5 5M15 2.5 17.5 5" />
    </>
  ),
} as const

export function ActionIcon({ name }: ActionIconProps) {
  return (
    <svg
      aria-hidden="true"
      className="action-icon"
      fill="none"
      focusable="false"
      viewBox="0 0 20 20"
    >
      {paths[name]}
    </svg>
  )
}
