import { createServerFn } from '@tanstack/react-start'
import {
  changePasswordInputSchema,
  passwordResetRequestInputSchema,
  setAuthTransport,
  signInInputSchema,
  signOutInputSchema,
  signUpInputSchema,
  ssoCallbackInputSchema,
  ssoStartInputSchema,
} from '@vitnode/core/tanstack/auth'
import {
  changePasswordFromResetOnApi,
  completeSsoOnApi,
  readSessionOnApi,
  requestPasswordResetOnApi,
  signInOnApi,
  signOutOnApi,
  signUpOnApi,
  startSsoOnApi,
} from '@vitnode/core/tanstack/auth/server'

export const readSessionFn = createServerFn().handler(
  async () => await readSessionOnApi(),
)

export const signInFn = createServerFn({ method: 'POST' })
  .validator(signInInputSchema)
  .handler(async ({ data }) => await signInOnApi(data))

export const signOutFn = createServerFn({ method: 'POST' })
  .validator(signOutInputSchema)
  .handler(async ({ data }) => await signOutOnApi(data))

export const startSsoFn = createServerFn({ method: 'POST' })
  .validator(ssoStartInputSchema)
  .handler(async ({ data }) => await startSsoOnApi(data))

export const completeSsoFn = createServerFn({ method: 'POST' })
  .validator(ssoCallbackInputSchema)
  .handler(async ({ data }) => await completeSsoOnApi(data))

export const signUpFn = createServerFn({ method: 'POST' })
  .validator(signUpInputSchema)
  .handler(async ({ data }) => await signUpOnApi(data))

export const requestPasswordResetFn = createServerFn({ method: 'POST' })
  .validator(passwordResetRequestInputSchema)
  .handler(async ({ data }) => await requestPasswordResetOnApi(data))

export const changePasswordFromResetFn = createServerFn({ method: 'POST' })
  .validator(changePasswordInputSchema)
  .handler(async ({ data }) => await changePasswordFromResetOnApi(data))

setAuthTransport({
  changePasswordFromReset: async (input) =>
    await changePasswordFromResetFn({ data: input }),
  completeSso: async (input) => await completeSsoFn({ data: input }),
  readSession: async () => await readSessionFn(),
  requestPasswordReset: async (input) =>
    await requestPasswordResetFn({ data: input }),
  signIn: async (input) => await signInFn({ data: input }),
  signOut: async (input) => await signOutFn({ data: input }),
  signUp: async (input) => await signUpFn({ data: input }),
  startSso: async (input) => await startSsoFn({ data: input }),
})
