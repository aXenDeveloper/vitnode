import {
  MAX_NAMESPACE_DEPTH,
  MAX_NAMESPACE_LENGTH,
  MAX_NAMESPACES,
  validateIntlInput,
} from '@vitnode/core/tanstack/i18n'
import { afterEach, describe, expect, it } from 'vitest'

// Imported for its module-scope `configureIntl`, which is what teaches the
// package which languages *this* app serves - the whole subject of the locale
// cases below. In the running app the router entry does it; here the import is
// the equivalent, and without it every call throws rather than answering.
import '#/lib/i18n/runtime'
import { loadIntlMessages } from '#/server/messages.server'

const validate = (input: unknown) => validateIntlInput(input)

/**
 * The message server function is a public `POST` endpoint once this app is
 * built, and its second argument is a list of paths that a shared utility then
 * walks through an object. That is the shape of a prototype-pollution bug, so
 * the boundary is tested as one.
 *
 * `validateIntlInput` is called directly rather than through the server
 * function: Start refuses to run one outside a request scope, and the guard is
 * the thing under test either way.
 */
describe('the intl serverFn rejects malformed input', () => {
  it.each([undefined, null, 'core.global', 42, []])(
    'refuses %s in place of an object',
    (input) => {
      expect(() => validate(input)).toThrow()
    },
  )

  it('requires a string locale', () => {
    expect(() => validate({ locale: 42, namespaces: [] })).toThrow(
      /locale must be a string/,
    )
    expect(() => validate({ namespaces: [] })).toThrow(
      /locale must be a string/,
    )
  })

  it('requires namespaces to be an array', () => {
    expect(() => validate({ locale: 'en', namespaces: 'core.global' })).toThrow(
      /must be an array/,
    )
    expect(() => validate({ locale: 'en' })).toThrow(/must be an array/)
  })

  it('requires every entry to be a non-empty string', () => {
    expect(() => validate({ locale: 'en', namespaces: [42] })).toThrow(
      /namespaces\[0\] must be a string/,
    )
    expect(() =>
      validate({ locale: 'en', namespaces: ['core.global', null] }),
    ).toThrow(/namespaces\[1\] must be a string/)
    expect(() => validate({ locale: 'en', namespaces: [''] })).toThrow(
      /must not be empty/,
    )
  })

  it('refuses an over-long namespace', () => {
    const tooLong = 'a'.repeat(MAX_NAMESPACE_LENGTH + 1)

    expect(() => validate({ locale: 'en', namespaces: [tooLong] })).toThrow(
      /at most 128 characters/,
    )
  })

  it('refuses an over-deep namespace', () => {
    const tooDeep = Array.from(
      { length: MAX_NAMESPACE_DEPTH + 1 },
      () => 'a',
    ).join('.')

    expect(() => validate({ locale: 'en', namespaces: [tooDeep] })).toThrow(
      /at most 8 segments/,
    )
  })

  it('refuses more namespaces than any page needs', () => {
    const tooMany = Array.from(
      { length: MAX_NAMESPACES + 1 },
      (_, index) => `core.ns${index}`,
    )

    expect(() => validate({ locale: 'en', namespaces: tooMany })).toThrow(
      /At most 16 namespaces/,
    )
  })

  it('refuses a hole in a sparse array', () => {
    // Not reachable over JSON, which has no holes - but `Array.prototype.map`
    // skips one, which would let it through unvalidated, and this is a
    // boundary. Built rather than written as a literal so it is a hole and not
    // an explicit `undefined`.
    const sparse = new Array<string>(2)
    sparse[1] = 'core.global'

    expect(() => validate({ locale: 'en', namespaces: sparse })).toThrow(
      /namespaces\[0\] must be a string/,
    )
  })

  it('refuses an empty segment', () => {
    for (const malformed of ['core..global', '.core', 'core.']) {
      expect(() => validate({ locale: 'en', namespaces: [malformed] })).toThrow(
        /empty segment/,
      )
    }
  })
})

describe('the intl serverFn rejects prototype-pollution paths', () => {
  afterEach(() => {
    delete (Object.prototype as Record<string, unknown>).polluted
  })

  it.each([
    '__proto__',
    '__proto__.polluted',
    'constructor',
    'constructor.prototype.polluted',
    'prototype',
    'core.__proto__.polluted',
    'core.global.constructor',
  ])('refuses %s outright', (namespace) => {
    // Rejected rather than filtered away: a request asking for `__proto__` is
    // not a request with a typo in it, and silently serving it a trimmed list
    // would hide the fact that something is sending them.
    expect(() => validate({ locale: 'en', namespaces: [namespace] })).toThrow(
      /forbidden segment/,
    )

    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('refuses the whole request, not just the offending entry', () => {
    expect(() =>
      validate({ locale: 'en', namespaces: ['core.global', '__proto__'] }),
    ).toThrow(/forbidden segment/)
  })

  it('leaves Object.prototype untouched even end to end', async () => {
    // The belt to the validator's braces: `pickMessages` refuses the same
    // segments, so even a caller that skipped validation cannot pollute.
    await loadIntlMessages({
      locale: 'en',
      namespaces: ['__proto__.polluted', 'constructor.prototype.polluted'],
    })

    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})

describe('the intl serverFn accepts what the app actually sends', () => {
  it('passes a single namespace through', () => {
    expect(validate({ locale: 'en', namespaces: ['core.global'] })).toEqual({
      locale: 'en',
      namespaces: ['core.global'],
    })
  })

  it('sorts and de-duplicates a multi-namespace request', () => {
    expect(
      validate({
        locale: 'pl',
        namespaces: ['core.search', 'core.global', 'core.search'],
      }),
    ).toEqual({ locale: 'pl', namespaces: ['core.global', 'core.search'] })
  })

  it('accepts a plugin namespace, slashes and all', () => {
    expect(
      validate({
        locale: 'en',
        namespaces: ['@vitnode/blog.someNamespace'],
      }),
    ).toEqual({ locale: 'en', namespaces: ['@vitnode/blog.someNamespace'] })
  })

  it('accepts an empty list', () => {
    expect(validate({ locale: 'en', namespaces: [] })).toEqual({
      locale: 'en',
      namespaces: [],
    })
  })

  it('degrades an unknown locale to the default rather than failing', () => {
    // A stale link to a language that has since been removed should render the
    // page, not 500 - which is the one place strictness would cost more than it
    // buys.
    expect(validate({ locale: 'xx', namespaces: [] }).locale).toBe('en')
  })
})

describe('hardening did not change what a valid request returns', () => {
  it('still resolves messages, and still falls back per key', async () => {
    const { locale, messages } = await loadIntlMessages({
      locale: 'pl',
      namespaces: ['core.global'],
    })

    expect(locale).toBe('pl')
    expect(messages).toHaveProperty('core.global.close', 'Zamknij')
    // `toggle_sidebar` is AdminCP copy the Polish override does not carry.
    expect(messages).toHaveProperty(
      'core.global.toggle_sidebar',
      'Toggle Sidebar',
    )
  })

  it('still ships only the namespaces that were asked for', async () => {
    const { messages } = await loadIntlMessages({
      locale: 'en',
      namespaces: ['core.global', 'core.search'],
    })
    const core = (messages as { core: Record<string, unknown> }).core

    expect(Object.keys(messages)).toEqual(['core'])
    expect(Object.keys(core).sort()).toEqual(['global', 'search'])
  })
})
