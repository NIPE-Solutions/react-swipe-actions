import { describe, expect, it } from 'vitest'

import {
  focusFirstEnabled,
  isInteractiveTarget,
  setSubtreeInert,
} from '../../src/utils/dom'

describe('isInteractiveTarget', () => {
  it('recognizes interactive elements and their descendants', () => {
    // Catches pointer handling taking ownership from native controls.
    document.body.innerHTML = `
      <button><span id="button-child">Button</span></button>
      <a href="#destination"><span id="link-child">Link</span></a>
      <input id="input" />
      <select id="select"><option>One</option></select>
      <textarea id="textarea"></textarea>
      <div contenteditable="true"><span id="editable-child">Edit</span></div>
    `

    for (const selector of [
      '#button-child',
      '#link-child',
      '#input',
      '#select',
      '#textarea',
      '#editable-child',
    ]) {
      expect(isInteractiveTarget(document.querySelector(selector))).toBe(true)
    }
  })

  it('leaves ordinary content eligible for dragging', () => {
    // Catches treating non-interactive row content as a native control.
    document.body.innerHTML = '<span id="plain">Plain text</span>'

    expect(isInteractiveTarget(document.querySelector('#plain'))).toBe(false)
  })
})

describe('focusFirstEnabled', () => {
  it('focuses the first enabled descendant and reports success', () => {
    // Catches disabled controls blocking the focus handoff to the next action.
    document.body.innerHTML = `
      <section id="actions">
        <button disabled>Disabled</button>
        <button id="enabled">Enabled</button>
      </section>
    `
    const container = document.querySelector<HTMLElement>('#actions')

    expect(container).not.toBeNull()
    expect(focusFirstEnabled(container as HTMLElement)).toBe(true)
    expect(document.activeElement).toBe(document.querySelector('#enabled'))
  })

  it('reports failure when no enabled descendant can receive focus', () => {
    // Catches claiming that focus moved when an action side has no usable control.
    document.body.innerHTML =
      '<section id="actions"><button disabled>Disabled</button></section>'
    const container = document.querySelector<HTMLElement>('#actions')

    expect(focusFirstEnabled(container as HTMLElement)).toBe(false)
  })
})

describe('setSubtreeInert', () => {
  it('combines inert and aria-hidden while restoring only changed tab indexes', () => {
    // Catches hidden action controls remaining in tab order or losing their original order.
    document.body.innerHTML = `
      <section id="actions" aria-hidden="false">
        <button id="implicit">Action</button>
        <a id="explicit" href="#destination" tabindex="2">Link</a>
        <input id="already-hidden" tabindex="-1" />
      </section>
    `
    const container = document.querySelector<HTMLElement>('#actions')
    const implicit = document.querySelector<HTMLElement>('#implicit')
    const explicit = document.querySelector<HTMLElement>('#explicit')
    const alreadyHidden = document.querySelector<HTMLElement>('#already-hidden')

    expect(container).not.toBeNull()
    setSubtreeInert(container as HTMLElement, true)
    setSubtreeInert(container as HTMLElement, true)

    expect((container as HTMLElement & { inert: boolean }).inert).toBe(true)
    expect(container).toHaveAttribute('aria-hidden', 'true')
    expect(implicit).toHaveAttribute('tabindex', '-1')
    expect(explicit).toHaveAttribute('tabindex', '-1')
    expect(alreadyHidden).toHaveAttribute('tabindex', '-1')

    setSubtreeInert(container as HTMLElement, false)

    expect((container as HTMLElement & { inert: boolean }).inert).toBe(false)
    expect(container).toHaveAttribute('aria-hidden', 'false')
    expect(implicit).not.toHaveAttribute('tabindex')
    expect(explicit).toHaveAttribute('tabindex', '2')
    expect(alreadyHidden).toHaveAttribute('tabindex', '-1')
  })
})
