const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  '[contenteditable]:not([contenteditable="false"])',
].join(',')

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[tabindex]',
  '[contenteditable]:not([contenteditable="false"])',
].join(',')

const EDITABLE_SELECTOR = [
  'input',
  'select',
  'textarea',
  '[contenteditable]:not([contenteditable="false"])',
].join(',')

const originalAriaHidden = new WeakMap<HTMLElement, string | null>()
const originalTabIndexes = new WeakMap<
  HTMLElement,
  Map<HTMLElement, string | null>
>()

export function isInteractiveTarget(target: EventTarget | null): boolean {
  const element = targetElement(target)
  return element?.closest(INTERACTIVE_SELECTOR) !== null
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

export function setSubtreeInert(element: HTMLElement, inert: boolean): void {
  ;(element as HTMLElement & { inert: boolean }).inert = inert

  if (inert) {
    if (!originalAriaHidden.has(element)) {
      originalAriaHidden.set(element, element.getAttribute('aria-hidden'))
    }
    element.setAttribute('aria-hidden', 'true')

    const tabIndexes = originalTabIndexes.get(element) ?? new Map()
    originalTabIndexes.set(element, tabIndexes)

    const candidates = [
      ...(element.matches(FOCUSABLE_SELECTOR) ? [element] : []),
      ...element.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ]
    for (const candidate of candidates) {
      if (tabIndexes.has(candidate)) {
        candidate.setAttribute('tabindex', '-1')
        continue
      }
      if (candidate.tabIndex < 0) {
        continue
      }

      tabIndexes.set(candidate, candidate.getAttribute('tabindex'))
      candidate.setAttribute('tabindex', '-1')
    }
    return
  }

  restoreAriaHidden(element)
  restoreTabIndexes(element)
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

function restoreAriaHidden(element: HTMLElement) {
  if (!originalAriaHidden.has(element)) {
    return
  }

  const value = originalAriaHidden.get(element)
  originalAriaHidden.delete(element)

  if (value === null || value === undefined) {
    element.removeAttribute('aria-hidden')
  } else {
    element.setAttribute('aria-hidden', value)
  }
}

function restoreTabIndexes(element: HTMLElement) {
  const tabIndexes = originalTabIndexes.get(element)
  if (tabIndexes === undefined) {
    return
  }

  originalTabIndexes.delete(element)
  for (const [candidate, value] of tabIndexes) {
    if (value === null) {
      candidate.removeAttribute('tabindex')
    } else {
      candidate.setAttribute('tabindex', value)
    }
  }
}
