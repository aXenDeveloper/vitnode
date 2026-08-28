import { describe, expect, it } from 'vitest'

import {
  changePasswordFormResult,
  passwordResetFormResult,
  signUpFormResult,
} from '#/lib/auth/screens'

/**
 * The registration and recovery contracts translated into the vocabulary
 * `@vitnode/core`'s shared forms speak. Total functions over finite unions, so
 * every outcome the API can produce is checked here rather than in a browser.
 */

describe('signUpFormResult', () => {
  it('says nothing for a verified account, which is how the form knows the caller is leaving', () => {
    expect(
      signUpFormResult({
        email: 'test@test.com',
        emailVerified: true,
        ok: true,
      }),
    ).toBeUndefined()
  })

  it('asks for the confirmation screen when the account is not verified', () => {
    // The visitor is *not* signed in here, and this is the shape that says so:
    // the form swaps itself for "check your email" instead of standing down.
    expect(
      signUpFormResult({
        email: 'test@test.com',
        emailVerified: false,
        ok: true,
      }),
    ).toEqual({ emailConfirmation: 'test@test.com' })
  })

  it.each([
    ['email_exists', 'email_exists'],
    ['name_exists', 'name_exists'],
  ] as const)(
    'passes %s through so the right field is marked',
    (reason, message) => {
      expect(signUpFormResult({ ok: false, reason })).toEqual({ message })
    },
  )

  it.each(['conflict', 'invalid', 'rate_limited', 'server_error'] as const)(
    'renders %s as the internal-error toast',
    (reason) => {
      // Deliberate collapse: a visitor cannot act on the difference between a
      // 409 whose field we could not name, a refused captcha and a rate limit.
      // The distinctions survive in the server log.
      expect(signUpFormResult({ ok: false, reason })).toEqual({
        message: 'Internal Server Error',
      })
    },
  )

  it('never returns a shape that both stands down and asks for the confirmation screen', () => {
    const unverified = signUpFormResult({
      email: 'test@test.com',
      emailVerified: false,
      ok: true,
    })

    expect(unverified).toBeDefined()
    expect(unverified?.message).toBeUndefined()
  })
})

describe('passwordResetFormResult', () => {
  it('says nothing for an accepted request', () => {
    expect(passwordResetFormResult({ ok: true })).toBeUndefined()
  })

  it.each(['invalid', 'rate_limited', 'server_error'] as const)(
    'renders %s as the internal-error toast',
    (reason) => {
      expect(passwordResetFormResult({ ok: false, reason })).toEqual({
        message: 'Internal Server Error',
      })
    },
  )
})

describe('changePasswordFormResult', () => {
  it('says nothing on success - the form raises its own toast and leaves', () => {
    expect(changePasswordFormResult({ ok: true })).toBeUndefined()
  })

  it('keeps an unusable link as itself, because the visitor can act on it', () => {
    expect(
      changePasswordFormResult({ ok: false, reason: 'invalid_token' }),
    ).toEqual({ message: 'invalid_token' })
  })

  it.each(['rate_limited', 'server_error'] as const)(
    'renders %s as the generic failure',
    (reason) => {
      expect(changePasswordFormResult({ ok: false, reason })).toEqual({
        message: 'internal_server_error',
      })
    },
  )
})
