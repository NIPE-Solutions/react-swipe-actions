export const packageName = '@nipe-solutions/react-swipe-actions'

export const sections = [
  ['introduction', 'Introduction'],
  ['installation', 'Installation'],
  ['quick-start', 'Quick start'],
  ['anatomy', 'Anatomy'],
  ['actions', 'Actions'],
  ['leading-trailing', 'Leading and trailing'],
  ['full-swipe', 'Full swipe'],
  ['controlled-state', 'Controlled state'],
  ['groups', 'Groups'],
  ['gestures', 'Gestures'],
  ['scroll-interaction', 'Scroll interaction'],
  ['accessibility', 'Accessibility'],
  ['keyboard', 'Keyboard'],
  ['rtl', 'RTL'],
  ['styling', 'Styling'],
  ['css-variables', 'CSS variables'],
  ['data-attributes', 'Data attributes'],
  ['performance', 'Performance'],
  ['ssr', 'SSR'],
  ['api-reference', 'API reference'],
  ['examples', 'Examples'],
  ['faq', 'FAQ'],
  ['migration', 'Migration'],
  ['contributing', 'Contributing'],
] as const

export const installCommand = `npm install ${packageName}`

export const canonicalCode = `import { SwipeActions } from '${packageName}'
import '${packageName}/core.css'

<SwipeActions.Root>
  <SwipeActions.Leading>
    <SwipeActions.Action onAction={archive}>
      Archive
    </SwipeActions.Action>
  </SwipeActions.Leading>
  <SwipeActions.Content>Quarterly planning</SwipeActions.Content>
  <SwipeActions.Trailing>
    <SwipeActions.Action destructive fullSwipe onAction={remove}>
      Delete
    </SwipeActions.Action>
  </SwipeActions.Trailing>
</SwipeActions.Root>`

export const controlledCode = `import { Root, type SwipeActionsOpenSide } from '${packageName}'

const [openSide, setOpenSide] = useState<
  SwipeActionsOpenSide
>(null)

<Root openSide={openSide} onOpenSideChange={setOpenSide}>
  {/* sides and content */}
</Root>`

export const groupCode = `import { Group } from '${packageName}'

<Group>
  {messages.map((message) => (
    <MessageRow key={message.id} message={message} />
  ))}
</Group>`

export const ssrCode = `import { renderToString } from 'react-dom/server'
import { Root, Content } from '${packageName}'

const html = renderToString(
  <Root><Content>Server-rendered row</Content></Root>,
)`

export const apiRows = [
  [
    'Root',
    'Owns gesture state, thresholds, direction, and imperative control.',
  ],
  ['Content', 'The foreground surface people drag or activate.'],
  ['Leading', 'Logical actions revealed from the inline start edge.'],
  ['Trailing', 'Logical actions revealed from the inline end edge.'],
  [
    'Action',
    'A native button with optional destructive and full-swipe semantics.',
  ],
  ['Group', 'Coordinates rows so opening one closes the previous row.'],
] as const
