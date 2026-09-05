import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@nipe-solutions/react-swipe-actions/core.css'

import { CodeBlock } from './components/CodeBlock'
import { DocsShell } from './components/DocsShell'
import { DocSection } from './components/DocSection'
import { InboxDemo } from './components/InboxDemo'
import {
  apiRows,
  canonicalCode,
  completeCanonicalCode,
  controlledCode,
  groupCode,
  installCommand,
  packageName,
  siteLinks,
  siteMetadata,
  ssrCode,
} from './content'
import { ContainerExamples } from './examples/ContainerExamples'
import { CoreExamples } from './examples/CoreExamples'
import { PatternExamples } from './examples/PatternExamples'
import { StateExamples } from './examples/StateExamples'
import {
  installPerformanceInstrumentation,
  PerformanceFixture,
} from './performance-fixture'
import './site.css'

const search = new URLSearchParams(window.location.search)
const performanceRows = search.get('rows') === '1000' ? 1000 : 100
const isPerformanceFixture = search.get('fixture') === 'performance'

if (isPerformanceFixture) installPerformanceInstrumentation()

const root = document.getElementById('root')
if (root === null) throw new Error('Website root element is missing')

createRoot(root).render(
  <StrictMode>
    {isPerformanceFixture ? (
      <PerformanceFixture rows={performanceRows} />
    ) : (
      <Website />
    )}
  </StrictMode>,
)

function Website() {
  return (
    <DocsShell>
      <div className="opening">
        <div className="opening__copy">
          <section
            id="introduction"
            className="intro"
            data-testid="hero-description"
          >
            <p className="status-line">
              <span className="status-line__dot" />
              <span className="status-line__copy">
                Composable swipe actions for React
              </span>
              <small>{siteMetadata.statusLabel}</small>
            </p>
            <h1>Swipe actions that feel native. State that stays yours.</h1>
            <p className="intro__lede">
              Accessible reveal, full swipe, grouping, keyboard control, and RTL
              in a small compound-component API.
            </p>
            <div className="intro__links">
              <a href="#quick-start">Start with the code</a>
              <a href="#accessibility">Read the interaction model</a>
            </div>
          </section>

          <section id="installation" className="install-panel">
            <h2>Installation</h2>
            <div className="install-command" data-testid="install-command">
              <code>{installCommand}</code>
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard?.writeText(installCommand)
                }
              >
                Copy
              </button>
            </div>
            <p>
              React and React DOM remain peer dependencies. No gesture runtime
              is added.
            </p>
          </section>
        </div>
        <InboxDemo />
        <section id="quick-start" className="quick-start">
          <div data-testid="canonical-code">
            <div className="quick-start__heading">
              <h2>Quick start</h2>
              <a className="quick-start__more" href="#complete-example">
                View complete example
              </a>
            </div>
            <CodeBlock code={canonicalCode} label="MessageRow excerpt" />
          </div>
        </section>
      </div>

      <DocSection
        id="anatomy"
        title="Anatomy"
        intro="The DOM stays explicit: action sides sit behind one draggable content layer."
      >
        <div id="complete-example" className="complete-example">
          <div className="complete-example__heading">
            <h3>Complete message row</h3>
            <p>Copy this version when starting a real row.</p>
          </div>
          <CodeBlock code={completeCanonicalCode} label="MessageRow.tsx" />
        </div>
        <div className="anatomy-diagram" aria-label="Swipe row DOM layers">
          <div>
            <span>Root</span>
            <p>Gesture, state, direction, thresholds</p>
          </div>
          <div className="anatomy-diagram__layers">
            <div>
              <span>Leading</span>
              <small>Action buttons</small>
            </div>
            <div className="anatomy-diagram__content">
              <span>Content</span>
              <small>Foreground drag surface</small>
            </div>
            <div>
              <span>Trailing</span>
              <small>Action buttons</small>
            </div>
          </div>
        </div>
        <p>
          <code>Root</code> provides context. <code>Leading</code> and{' '}
          <code>Trailing</code> use logical sides. <code>Content</code> is the
          only translated layer, while each <code>Action</code> remains a native
          button.
        </p>
      </DocSection>

      <DocSection
        id="actions"
        title="Actions"
        intro="Action labels, effects, loading, confirmation, and removal belong to the application."
      >
        <div className="split-notes">
          <div>
            <h3>Use native behavior</h3>
            <p>
              <code>Action</code> renders a button, preserving disabled, Enter,
              Space, and focus semantics.
            </p>
          </div>
          <div>
            <h3>Keep effects explicit</h3>
            <p>
              <code>onAction</code> runs once for a committed activation.
              Exceptions are not swallowed.
            </p>
          </div>
        </div>
      </DocSection>

      <DocSection
        id="leading-trailing"
        title="Leading and trailing"
        intro="Logical sides survive RTL and keep state independent from physical screen edges."
      >
        <table>
          <thead>
            <tr>
              <th>Direction</th>
              <th>Leading</th>
              <th>Trailing</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>LTR</td>
              <td>Left edge</td>
              <td>Right edge</td>
            </tr>
            <tr>
              <td>RTL</td>
              <td>Right edge</td>
              <td>Left edge</td>
            </tr>
          </tbody>
        </table>
      </DocSection>

      <DocSection
        id="full-swipe"
        title="Full swipe"
        intro="Mark one enabled action on a side as the full-swipe claimant."
      >
        <p>
          Crossing the full-swipe threshold arms that action. A small internal
          hysteresis band keeps the state stable near that boundary; deliberate
          reversal disarms it. The application still decides whether an invoked
          action removes a row, shows undo, or waits for a server response.
        </p>
        <CodeBlock
          label="Destructive trailing action"
          code={`import { Action } from '${packageName}'\n\n<Action destructive fullSwipe onAction={remove}>\n  Delete\n</Action>`}
        />
      </DocSection>

      <DocSection
        id="controlled-state"
        title="Controlled state"
        intro="Use openSide when a store, route, or parent must own row disclosure."
      >
        <CodeBlock code={controlledCode} label="ControlledRow.tsx" />
        <p>
          A controlled row requests changes through{' '}
          <code>onOpenSideChange</code>. It does not display the requested side
          until the prop changes.
        </p>
      </DocSection>

      <DocSection
        id="groups"
        title="Groups"
        intro="Group coordinates open rows without making the list renderer part of the package."
      >
        <CodeBlock code={groupCode} label="MessageList.tsx" />
        <p>
          The registry holds close callbacks, not row data. Opening a row closes
          only the previously open peer; mounting and virtualization stay with
          the app.
        </p>
      </DocSection>

      <DocSection
        id="gestures"
        title="Gestures"
        intro="Pointer input moves through pending, dragging, settling, and resting phases."
      >
        <ol className="lifecycle">
          <li>
            <strong>Pending</strong>
            <span>
              Track a primary pointer without blocking vertical movement.
            </span>
          </li>
          <li>
            <strong>Dragging</strong>
            <span>
              Claim horizontal intent, capture the pointer, and update offset.
            </span>
          </li>
          <li>
            <strong>Settling</strong>
            <span>
              Resolve distance and recent velocity to a measured target.
            </span>
          </li>
          <li>
            <strong>Resting</strong>
            <span>
              Expose closed or open state and release transient resources.
            </span>
          </li>
        </ol>
      </DocSection>

      <DocSection
        id="scroll-interaction"
        title="Scroll interaction"
        intro="The content layer declares pan-y so vertical lists continue to scroll naturally."
      >
        <p>
          The controller waits for an axis decision. Vertical intent releases
          the gesture to scrolling; horizontal intent captures it. Multi-touch
          and non-primary pointers do not start a row gesture.
        </p>
      </DocSection>

      <DocSection
        id="accessibility"
        title="Accessibility"
        intro="Closed actions leave the accessibility tree and tab order until their side opens."
      >
        <ul className="check-list">
          <li>Give each root an action-oriented accessible label.</li>
          <li>Keep visible action text specific: Archive, Snooze, Delete.</li>
          <li>Use native disabled semantics instead of intercepting clicks.</li>
          <li>Return focus safely when a side closes.</li>
          <li>
            Test closed, open, grouped, disabled, and reduced-motion states.
          </li>
        </ul>
      </DocSection>

      <DocSection
        id="keyboard"
        title="Keyboard"
        intro="Every disclosure and action remains available without a swipe gesture."
      >
        <div className="key-grid">
          <kbd>ArrowLeft</kbd>
          <span>Open the physical left edge.</span>
          <kbd>ArrowRight</kbd>
          <span>Open the physical right edge.</span>
          <kbd>Escape</kbd>
          <span>Close and restore focus when needed.</span>
          <kbd>Enter / Space</kbd>
          <span>Activate the focused native action button.</span>
        </div>
      </DocSection>

      <DocSection
        id="rtl"
        title="RTL"
        intro="Direction may be explicit or inherited from the mounted DOM."
      >
        <p>
          Set <code>direction="rtl"</code> for deterministic control, or let the
          root resolve computed direction. A runtime direction change cancels
          transient motion and preserves the same logical open side where
          possible.
        </p>
      </DocSection>

      <DocSection
        id="styling"
        title="Styling"
        intro="Import core.css for mechanics, then style the public attributes in your own layer."
      >
        <CodeBlock
          label="app.css"
          code={`@import '${packageName}/core.css';\n\n.message-row [data-swipe-actions-content] {\n  background: white;\n}\n\n.message-row [data-destructive] {\n  background: #b42318;\n  color: white;\n}`}
        />
        <p>
          Import <code>theme.css</code> after core for neutral defaults, or{' '}
          <code>styles.css</code> for both files together. This site imports
          only core.
        </p>
      </DocSection>

      <DocSection
        id="css-variables"
        title="CSS variables"
        intro="Motion writes a small observable CSS contract on the root and armed action."
      >
        <table>
          <thead>
            <tr>
              <th>Variable</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>--swipe-actions-offset</code>
              </td>
              <td>Current physical x offset in pixels.</td>
            </tr>
            <tr>
              <td>
                <code>--swipe-actions-progress</code>
              </td>
              <td>Reveal progress for the active side, clamped to 0–1.</td>
            </tr>
            <tr>
              <td>
                <code>--swipe-actions-leading-progress</code>
              </td>
              <td>Leading-side reveal progress.</td>
            </tr>
            <tr>
              <td>
                <code>--swipe-actions-trailing-progress</code>
              </td>
              <td>Trailing-side reveal progress.</td>
            </tr>
            <tr>
              <td>
                <code>--swipe-actions-action-progress</code>
              </td>
              <td>Reveal progress for each individual action.</td>
            </tr>
            <tr>
              <td>
                <code>--swipe-actions-action-width</code>
              </td>
              <td>Measured width written on each action.</td>
            </tr>
            <tr>
              <td>
                <code>--swipe-actions-full-swipe-progress</code>
              </td>
              <td>Armed action expansion progress.</td>
            </tr>
          </tbody>
        </table>
      </DocSection>

      <DocSection
        id="data-attributes"
        title="Data attributes"
        intro="Attributes expose stable styling states without publishing gesture internals."
      >
        <table>
          <thead>
            <tr>
              <th>Attribute</th>
              <th>Values or presence</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>data-state</code>
              </td>
              <td>closed, open, dragging, settling, activating</td>
            </tr>
            <tr>
              <td>
                <code>data-side</code>
              </td>
              <td>leading or trailing</td>
            </tr>
            <tr>
              <td>
                <code>data-revealing-side</code>
              </td>
              <td>Current logical side during motion</td>
            </tr>
            <tr>
              <td>
                <code>data-active</code>
              </td>
              <td>Present on the open side or armed full-swipe action</td>
            </tr>
            <tr>
              <td>
                <code>data-full-swipe</code>
              </td>
              <td>Present on an action that is eligible for full swipe</td>
            </tr>
            <tr>
              <td>
                <code>data-full-swipe-expanding</code>
              </td>
              <td>Present on a claimant while expansion geometry is written</td>
            </tr>
            <tr>
              <td>
                <code>data-destructive</code>
              </td>
              <td>Present when destructive is true</td>
            </tr>
            <tr>
              <td>
                <code>data-disabled</code>
              </td>
              <td>Present on a disabled root or action</td>
            </tr>
          </tbody>
        </table>
      </DocSection>

      <DocSection
        id="performance"
        title="Performance"
        intro="Large-list evidence is measured in the packaged website fixture, not estimated."
      >
        <p>
          The fixture records mount time, live ResizeObserver instances, global
          pointer listeners, idle animation frames, and row commits while a
          group transfers ownership. See <code>docs/performance.md</code> for
          values and method.
        </p>
        <a className="text-link" href="?fixture=performance&rows=1000">
          Open the 1,000-row fixture
        </a>
      </DocSection>

      <DocSection
        id="ssr"
        title="SSR"
        intro="The package imports without a browser global and preserves configured initial state."
      >
        <CodeBlock code={ssrCode} label="server.tsx" />
        <p>
          Measurement and direction observation begin after mount. Avoid
          choosing a client-only default open side during hydration unless
          server markup matches it.
        </p>
      </DocSection>

      <DocSection
        id="api-reference"
        title="API reference"
        intro="The package exports six runtime components, one namespace object, and public types."
      >
        <div className="api-list">
          {apiRows.map(([name, description]) => (
            <div key={name}>
              <code>{name}</code>
              <p>{description}</p>
            </div>
          ))}
        </div>
        <p>
          Root supports <code>openSide</code>, <code>defaultOpenSide</code>,{' '}
          <code>onOpenSideChange</code>, <code>disabled</code>,{' '}
          <code>direction</code>, <code>openThreshold</code>, and{' '}
          <code>fullSwipeThreshold</code>. Its ref exposes{' '}
          <code>open(side)</code> and <code>close()</code>.
        </p>
      </DocSection>

      <DocSection
        id="examples"
        title="Examples"
        intro="These fixtures use the public package entry and leave product effects to React state."
      >
        <div className="example-workbench">
          <CoreExamples />
          <StateExamples />
          <ContainerExamples />
          <PatternExamples />
        </div>
      </DocSection>

      <DocSection
        id="faq"
        title="FAQ"
        intro="Boundaries are intentional: this package owns row interaction, not list policy."
      >
        <div className="faq-list">
          <details>
            <summary>Does an action remove its row?</summary>
            <p>
              No. Update application data in <code>onAction</code>, with any
              confirmation or undo your product needs.
            </p>
          </details>
          <details>
            <summary>Can rows be virtualized?</summary>
            <p>
              Yes. The virtualizer owns mounting. Group registrations clean up
              when rows unmount.
            </p>
          </details>
          <details>
            <summary>Can roots be nested?</summary>
            <p>
              No. Nested swipe roots are outside the alpha contract and may
              compete for a pointer.
            </p>
          </details>
          <details>
            <summary>Does it depend on a Bottom Sheet package?</summary>
            <p>
              No. Compose rows inside the sheet's content area and keep vertical
              pan ownership intact.
            </p>
          </details>
        </div>
      </DocSection>

      <DocSection
        id="migration"
        title="Migration"
        intro="Move from physical offsets and click overlays to logical state and native actions."
      >
        <ol className="migration-list">
          <li>
            Replace left/right state with <code>leading</code> and{' '}
            <code>trailing</code>.
          </li>
          <li>
            Wrap row content and action sides in <code>Root</code>.
          </li>
          <li>
            Move effects into <code>Action onAction</code> callbacks.
          </li>
          <li>
            Import core mechanics, then map existing product tokens to the data
            attributes.
          </li>
          <li>
            Verify keyboard, scroll competition, reduced motion, and RTL before
            rollout.
          </li>
        </ol>
      </DocSection>

      <DocSection
        id="contributing"
        title="Contributing"
        intro="Changes should preserve package boundaries and include evidence at the affected layer."
      >
        <p>
          Run <code>npm run check</code> for formatting, lint, types, unit
          tests, package consumers, budgets, and this website. Browser
          interaction coverage runs through <code>npm run test:e2e</code>.
          Document manual device results separately.
        </p>
        <a className="text-link" href={siteLinks.github}>
          Repository and issue tracker
        </a>
      </DocSection>

      <footer className="site-footer">
        <div className="site-footer__identity">
          <strong>React Swipe Actions</strong>
          <span>
            Composable swipe actions for React · {siteMetadata.statusLabel}
          </span>
        </div>
        <nav className="site-footer__links" aria-label="Footer">
          <div>
            <h2>Project</h2>
            <a href={siteLinks.github}>GitHub</a>
            <a href={siteLinks.changelog}>Changelog</a>
            <a href={siteLinks.security}>Security</a>
            <a href={siteLinks.license}>MIT License</a>
          </div>
          <div>
            <h2>NIPE</h2>
            <a href={siteLinks.nipeOpenSource}>NIPE Open Source</a>
          </div>
          <div>
            <h2>Legal</h2>
            <a href={siteLinks.imprint}>Imprint</a>
            <a href={siteLinks.privacy}>Privacy</a>
          </div>
        </nav>
      </footer>
    </DocsShell>
  )
}
