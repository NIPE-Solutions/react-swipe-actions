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

export const canonicalCode = `import { SwipeActions as S } from
  '${packageName}'
import
  '${packageName}/core.css'

const archive = () => {}

<S.Root>
  <S.Leading>
    <S.Action onAction={archive}>Archive</S.Action>
  </S.Leading>
  <S.Content>Quarterly planning</S.Content>
</S.Root>`

export const completeCanonicalCode = `import {
  Action,
  Content,
  Leading,
  Root,
  Trailing,
} from '${packageName}'
import '${packageName}/core.css'

interface MessageRowProps {
  onArchive: () => void
  onRemove: () => void
}

export function MessageRow({ onArchive, onRemove }: MessageRowProps) {
  return (
    <Root aria-label="Quarterly planning actions">
      <Leading>
        <Action onAction={onArchive}>Archive</Action>
      </Leading>
      <Content>Quarterly planning</Content>
      <Trailing>
        <Action destructive fullSwipe onAction={onRemove}>
          Delete
        </Action>
      </Trailing>
    </Root>
  )
}`

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
