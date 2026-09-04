import { describe, expect, it } from 'vitest'

import {
  focusFirstEnabled,
  isInteractiveTarget,
  isKeyboardInteractiveTarget,
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

describe('isKeyboardInteractiveTarget', () => {
  it('recognizes focusable custom controls, disclosure controls, and media controls', () => {
    // Catches keyboard exclusions leaking into the narrower pointer control classifier.
    document.body.innerHTML = `
      <div role="slider" tabindex="0"><span id="slider-child">Volume</span></div>
      <details><summary id="summary">Details</summary></details>
      <audio id="audio" controls></audio>
      <video id="video" controls></video>
      <section id="root" tabindex="0"><span id="plain">Plain text</span></section>
    `

    for (const selector of ['#slider-child', '#summary', '#audio', '#video']) {
      const target = document.querySelector(selector)
      expect(isKeyboardInteractiveTarget(target)).toBe(true)
      expect(isInteractiveTarget(target)).toBe(false)
    }
    const root = document.querySelector('#root')!
    const plain = document.querySelector('#plain')
    expect(isKeyboardInteractiveTarget(plain, root)).toBe(false)
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

  it('restores consumer tabindex changes made while the subtree is inert', async () => {
    // Catches the forced -1 masking newer implicit-to--1 and explicit-value updates.
    document.body.innerHTML = `
      <section id="actions">
        <button id="implicit">Implicit</button>
        <a id="explicit" href="#destination" tabindex="2">Explicit</a>
      </section>
    `
    const container = document.querySelector<HTMLElement>('#actions')!
    const implicit = document.querySelector<HTMLElement>('#implicit')!
    const explicit = document.querySelector<HTMLElement>('#explicit')!
    setSubtreeInert(container, true)

    implicit.setAttribute('tabindex', '-1')
    explicit.setAttribute('tabindex', '3')
    await Promise.resolve()

    expect(implicit).toHaveAttribute('tabindex', '-1')
    expect(explicit).toHaveAttribute('tabindex', '-1')
    setSubtreeInert(container, false)

    expect(implicit).toHaveAttribute('tabindex', '-1')
    expect(explicit).toHaveAttribute('tabindex', '3')
    expect(focusFirstEnabled(container)).toBe(true)
    expect(document.activeElement).toBe(explicit)
  })

  it('suppresses focusable descendants inserted after the subtree becomes inert', async () => {
    // Catches a closed side exposing controls added without a React rerender.
    document.body.innerHTML = '<section id="actions"></section>'
    const container = document.querySelector<HTMLElement>('#actions')!
    setSubtreeInert(container, true)

    const button = document.createElement('button')
    button.textContent = 'Late action'
    container.append(button)
    await Promise.resolve()

    expect(button).toHaveAttribute('tabindex', '-1')
    setSubtreeInert(container, false)
    expect(button).not.toHaveAttribute('tabindex')
  })

  it('suppresses descendants made focusable while inert and preserves their attributes', async () => {
    // Catches href, contenteditable, input type, and media controls mutations entering the tab order.
    document.body.innerHTML = `
      <section id="actions">
        <a id="link">Link</a>
        <div id="editable" contenteditable="false">Editable</div>
        <input id="input" type="hidden" />
        <audio id="audio"></audio>
      </section>
    `
    const container = document.querySelector<HTMLElement>('#actions')!
    const link = document.querySelector<HTMLElement>('#link')!
    const editable = document.querySelector<HTMLElement>('#editable')!
    const input = document.querySelector<HTMLElement>('#input')!
    const audio = document.querySelector<HTMLElement>('#audio')!
    setSubtreeInert(container, true)

    link.setAttribute('href', '#destination')
    editable.setAttribute('contenteditable', 'true')
    input.setAttribute('type', 'text')
    audio.setAttribute('controls', '')
    await Promise.resolve()

    for (const candidate of [link, editable, input, audio]) {
      expect(candidate).toHaveAttribute('tabindex', '-1')
    }

    setSubtreeInert(container, false)
    for (const candidate of [link, editable, input, audio]) {
      expect(candidate).not.toHaveAttribute('tabindex')
    }
    expect(link).toHaveAttribute('href', '#destination')
    expect(editable).toHaveAttribute('contenteditable', 'true')
    expect(input).toHaveAttribute('type', 'text')
    expect(audio).toHaveAttribute('controls')
  })

  it('releases moved descendants without overwriting later consumer tabindex changes', async () => {
    // Catches the inert session continuing to own controls after they leave its subtree.
    document.body.innerHTML = `
      <section id="actions">
        <button id="unchanged" tabindex="2">Unchanged</button>
        <button id="changed" tabindex="3">Changed</button>
      </section>
      <main id="content"></main>
    `
    const actions = document.querySelector<HTMLElement>('#actions')!
    const content = document.querySelector<HTMLElement>('#content')!
    const unchanged = document.querySelector<HTMLElement>('#unchanged')!
    const changed = document.querySelector<HTMLElement>('#changed')!
    setSubtreeInert(actions, true)

    content.append(unchanged, changed)
    changed.setAttribute('tabindex', '4')
    await Promise.resolve()

    expect(unchanged).toHaveAttribute('tabindex', '2')
    expect(changed).toHaveAttribute('tabindex', '4')

    setSubtreeInert(actions, false)
    expect(unchanged).toHaveAttribute('tabindex', '2')
    expect(changed).toHaveAttribute('tabindex', '4')
  })
})
