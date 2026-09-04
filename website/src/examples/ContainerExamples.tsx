import {
  Action,
  Content,
  Root,
  Trailing,
} from '@nipe-solutions/react-swipe-actions'

export function ContainerExamples() {
  return (
    <>
      <article className="example" data-example-id="scroll-container">
        <div className="example__copy">
          <h3>Scroll container</h3>
          <p>
            Vertical movement remains scroll-owned while horizontal intent
            reveals actions.
          </p>
        </div>
        <div className="example__stage scroll-example" tabIndex={0}>
          {['Roadmap', 'Receipts', 'Research', 'Reading list'].map((label) => (
            <Root key={label} aria-label={`${label} actions`}>
              <Content className="example-row">{label}</Content>
              <Trailing className="example-side example-side--danger">
                <Action destructive onAction={() => undefined}>
                  Delete
                </Action>
              </Trailing>
            </Root>
          ))}
        </div>
      </article>

      <article className="example" data-example-id="bottom-sheet">
        <div className="example__copy">
          <h3>Bottom Sheet-compatible</h3>
          <p>
            Place rows inside a sheet body. No runtime integration package is
            required.
          </p>
        </div>
        <div
          className="example__stage sheet-example"
          role="dialog"
          aria-label="Saved places"
        >
          <span className="sheet-example__handle" aria-hidden="true" />
          <h4>Saved places</h4>
          <Root aria-label="Saved place actions">
            <Content className="example-row">Vienna Westbahnhof</Content>
            <Trailing className="example-side example-side--danger">
              <Action destructive onAction={() => undefined}>
                Remove
              </Action>
            </Trailing>
          </Root>
        </div>
      </article>
    </>
  )
}
