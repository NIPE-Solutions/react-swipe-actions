const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  '[contenteditable]:not([contenteditable="false"])',
].join(',')

const KEYBOARD_INTERACTIVE_SELECTOR = [
  INTERACTIVE_SELECTOR,
  'summary',
  'audio[controls]',
  'video[controls]',
  '[tabindex]',
].join(',')

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  'audio[controls]',
  'video[controls]',
  '[tabindex]',
  '[contenteditable]:not([contenteditable="false"])',
].join(',')

const EDITABLE_SELECTOR = [
  'input',
  'select',
  'textarea',
  '[contenteditable]:not([contenteditable="false"])',
].join(',')

interface InertRestoration {
  ariaHidden?: string | null
  inert?: boolean
}

interface InertState {
  ariaHidden: string | null
  inert: boolean
  tabIndexes: Map<HTMLElement, string | null>
  observer: MutationObserver | null
}

const inertStates = new WeakMap<HTMLElement, InertState>()

export function isInteractiveTarget(target: EventTarget | null): boolean {
  const element = targetElement(target)
  return element?.closest(INTERACTIVE_SELECTOR) !== null
}

export function isKeyboardInteractiveTarget(
  target: EventTarget | null,
  boundary?: Element,
): boolean {
  const element = targetElement(target)
  const interactive = element?.closest(KEYBOARD_INTERACTIVE_SELECTOR)
  if (interactive === null || interactive === undefined) {
    return false
  }

  return boundary === undefined
    ? true
    : interactive !== boundary && boundary.contains(interactive)
}

export function isEditableTarget(target: EventTarget | null): boolean {
  const element = targetElement(target)
  return element?.closest(EDITABLE_SELECTOR) !== null
}

export function focusFirstEnabled(container: HTMLElement): boolean {
  const candidates = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)

  for (const candidate of candidates) {
    if (candidate.tabIndex < 0 || isDisabled(candidate)) {
      continue
    }

    candidate.focus()
    if (candidate.ownerDocument.activeElement === candidate) {
      return true
    }
  }

  return false
}

export function setSubtreeInert(
  element: HTMLElement,
  inert: boolean,
  restoration?: InertRestoration,
): void {
  if (inert) {
    let state = inertStates.get(element)
    if (state === undefined) {
      state = createInertState(element, restoration)
      inertStates.set(element, state)
    } else {
      recordTabIndexChanges(state, state.observer?.takeRecords() ?? [])
      releaseDetachedCandidates(element, state)
      updateRestoration(state, restoration)
    }

    ;(element as HTMLElement & { inert: boolean }).inert = true
    element.setAttribute('aria-hidden', 'true')
    trackFocusableCandidates(element, state)
    forceTrackedTabIndexes(state)
    state.observer?.takeRecords()
    return
  }

  const state = inertStates.get(element)
  if (state === undefined) {
    ;(element as HTMLElement & { inert: boolean }).inert =
      restoration?.inert ?? false
    return
  }

  recordTabIndexChanges(state, state.observer?.takeRecords() ?? [])
  releaseDetachedCandidates(element, state)
  updateRestoration(state, restoration)
  state.observer?.disconnect()
  inertStates.delete(element)

  ;(element as HTMLElement & { inert: boolean }).inert = state.inert
  restoreAriaHidden(element, state.ariaHidden)
  restoreTabIndexes(state.tabIndexes)
}

function createInertState(
  element: HTMLElement,
  restoration: InertRestoration | undefined,
): InertState {
  const state: InertState = {
    ariaHidden:
      restoration?.ariaHidden === undefined
        ? element.getAttribute('aria-hidden')
        : restoration.ariaHidden,
    inert:
      restoration?.inert ??
      Boolean((element as HTMLElement & { inert?: boolean }).inert),
    tabIndexes: new Map(),
    observer: null,
  }
  const MutationObserverConstructor =
    element.ownerDocument.defaultView?.MutationObserver ??
    (typeof MutationObserver === 'undefined' ? null : MutationObserver)
  if (MutationObserverConstructor === null) {
    return state
  }

  const observer = new MutationObserverConstructor((records) => {
    recordTabIndexChanges(state, records)
    releaseDetachedCandidates(element, state)
    trackFocusableCandidates(element, state)
    forceTrackedTabIndexes(state)
    observer.takeRecords()
  })
  observer.observe(element, {
    attributes: true,
    attributeFilter: [
      'tabindex',
      'href',
      'contenteditable',
      'type',
      'controls',
    ],
    childList: true,
    subtree: true,
  })
  state.observer = observer
  return state
}

function updateRestoration(
  state: InertState,
  restoration: InertRestoration | undefined,
) {
  if (restoration?.ariaHidden !== undefined) {
    state.ariaHidden = restoration.ariaHidden
  }
  if (restoration?.inert !== undefined) {
    state.inert = restoration.inert
  }
}

function trackFocusableCandidates(element: HTMLElement, state: InertState) {
  const candidates = [
    ...(element.matches(FOCUSABLE_SELECTOR) ? [element] : []),
    ...element.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ]
  for (const candidate of candidates) {
    if (state.tabIndexes.has(candidate)) {
      continue
    }

    state.tabIndexes.set(candidate, candidate.getAttribute('tabindex'))
  }
}

function recordTabIndexChanges(state: InertState, records: MutationRecord[]) {
  for (const record of records) {
    if (record.type !== 'attributes' || record.attributeName !== 'tabindex') {
      continue
    }

    const candidate = record.target as HTMLElement
    if (state.tabIndexes.has(candidate)) {
      state.tabIndexes.set(candidate, candidate.getAttribute('tabindex'))
    }
  }
}

function forceTrackedTabIndexes(state: InertState) {
  for (const candidate of state.tabIndexes.keys()) {
    if (candidate.getAttribute('tabindex') !== '-1') {
      candidate.setAttribute('tabindex', '-1')
    }
  }
}

function releaseDetachedCandidates(element: HTMLElement, state: InertState) {
  for (const [candidate, value] of state.tabIndexes) {
    if (element.contains(candidate)) {
      continue
    }

    state.tabIndexes.delete(candidate)
    if (candidate.getAttribute('tabindex') === '-1') {
      restoreTabIndex(candidate, value)
    }
  }
}

function targetElement(target: EventTarget | null): Element | null {
  if (target === null || typeof target !== 'object') {
    return null
  }

  const node = target as Node
  return node.nodeType === 1 ? (node as Element) : (node.parentElement ?? null)
}

function isDisabled(element: HTMLElement): boolean {
  return (
    element.matches(':disabled') ||
    element.getAttribute('aria-disabled') === 'true'
  )
}

function restoreAriaHidden(element: HTMLElement, value: string | null) {
  if (value === null || value === undefined) {
    element.removeAttribute('aria-hidden')
  } else {
    element.setAttribute('aria-hidden', value)
  }
}

function restoreTabIndexes(tabIndexes: Map<HTMLElement, string | null>) {
  for (const [candidate, value] of tabIndexes) {
    restoreTabIndex(candidate, value)
  }
}

function restoreTabIndex(candidate: HTMLElement, value: string | null) {
  if (value === null) {
    candidate.removeAttribute('tabindex')
  } else {
    candidate.setAttribute('tabindex', value)
  }
}
