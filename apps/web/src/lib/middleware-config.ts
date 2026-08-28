import type { middlewareModule } from '@vitnode/core/api/modules/middleware/middleware.module'
import type { routeMiddlewareSchema } from '@vitnode/core/api/modules/middleware/route'
import type { SSOProvider } from '@vitnode/core/views/auth/sso/providers'
import type { z } from 'zod'

import { queryOptions } from '@tanstack/react-query'
import { createIsomorphicFn } from '@tanstack/react-start'
import { clientModule, fetcherClient } from '@vitnode/core/lib/fetcher-client'
import { normalizeSSOProviders } from '@vitnode/core/views/auth/sso/providers'

import { fetchMiddlewareConfigOnServer } from '#/server/middleware-config.server'

/**
 * What the auth screens need to know about *this installation*: which SSO
 * adapters are registered, whether an email adapter exists to send a
 * reset-password link, and the public captcha key.
 *
 * Derived from `vitnode.api.config.ts`, so it is the same answer for every
 * visitor and only changes on deploy - which is what makes it a public,
 * anonymous read rather than anything session-shaped.
 */
export type MiddlewareConfig = z.infer<typeof routeMiddlewareSchema>

/**
 * The configuration, plus the one thing the configuration itself cannot say:
 * whether it was actually read.
 *
 * A single flag rather than a wrapper, and that is a decision about the four
 * consumers. `/login`, `/register` and the SSO callback all want the *fields* -
 * `config.captcha`, `config.isEmail`, `ssoProvidersOf(config)` - and are
 * indifferent to where they came from; only password recovery has to tell the
 * two apart. Wrapping the config in a `{ status, config }` result would make all
 * four unwrap it to serve one, so the flag rides alongside the fields and the
 * screens that do not care never mention it.
 *
 * ## Why the distinction has to exist at all
 *
 * A failed read degrades to {@link UNKNOWN_MIDDLEWARE_CONFIG}, which says
 * `isEmail: false` - and for `/login` that is exactly right, a reduced form
 * rather than no form. But `isEmail: false` is also what a deployment with no
 * email adapter genuinely looks like, and `/login/reset-password` answers that
 * with `notFound()`. Collapsed together, an API outage made password recovery
 * return **404**: the app claiming a route does not exist because it could not
 * reach its own API. See `passwordRecoveryAvailability`.
 */
export interface MiddlewareConfigState extends MiddlewareConfig {
  /**
   * `true` when these fields are the API's answer, `false` when they are the
   * fallback below.
   *
   * Not part of the API schema - it is this app's record of whether the read
   * succeeded, so a consumer can distinguish "configured off" from "unknown".
   */
  isKnown: boolean
}

/**
 * What a screen renders when the configuration cannot be read: the email and
 * password fields, and nothing that depends on a configured adapter.
 *
 * Shared by both transports so a failure looks the same during SSR and after
 * hydration, rather than the page changing shape when it rehydrates.
 *
 * `isKnown: false` is the load-bearing field. Every other value here is a
 * *guess* chosen to degrade safely, and a consumer that must not guess reads
 * this one first.
 *
 * ## What it costs the screens that need a captcha
 *
 * `captcha` is absent here, and it cannot be otherwise - a widget needs a site
 * key, and the read that would have supplied one is the read that failed. So on
 * a deployment *with* a captcha configured, a registration or reset-password
 * form rendered from this fallback shows no widget, submits an empty token, and
 * the API answers `400` - which reaches the visitor as the internal-error toast
 * rather than as a silent success. Degraded, but not wrong: nothing is created
 * and nothing is claimed to have been. The alternative would be inventing a
 * configuration, which is how a form ends up looking solved when it is not.
 */
export const UNKNOWN_MIDDLEWARE_CONFIG: MiddlewareConfigState = Object.freeze({
  isEmail: false,
  isKnown: false,
  sso: [],
})

/** The API's answer, marked as one. */
export const knownMiddlewareConfig = (
  config: MiddlewareConfig,
): MiddlewareConfigState => ({ ...config, isKnown: true })

const middleware = clientModule<typeof middlewareModule>('@vitnode/core')

/**
 * The same read from the browser, for a client-side navigation into `/login`.
 *
 * Core's own browser fetcher, which is what the Next.js app's client components
 * use - so a hydrated page and a Next.js page make the identical request.
 */
const fetchMiddlewareConfigInBrowser =
  async (): Promise<MiddlewareConfigState> => {
    try {
      const response = await fetcherClient(middleware, {
        method: 'get',
        module: 'middleware',
        path: '/',
      })

      if (response.status !== 200) return UNKNOWN_MIDDLEWARE_CONFIG

      return knownMiddlewareConfig(await response.json())
    } catch {
      return UNKNOWN_MIDDLEWARE_CONFIG
    }
  }

/**
 * The transport boundary, and the reason one query definition works in a loader
 * and in a component.
 *
 * Deliberately no `createServerFn` in between: this is a public, anonymous read
 * that the API is already the boundary for, so routing it through a `POST` back
 * to this app would cost two round trips instead of one. The same call the
 * Discover feed makes, for the same reason.
 *
 * `createIsomorphicFn` is what makes that safe rather than merely tidy: the
 * Start compiler keeps only the branch belonging to the bundle it is building
 * and drops the other's import with it, so `middleware-config.server.ts` - and
 * the `server-only` marker in it - never reaches the browser.
 */
const fetchMiddlewareConfig = createIsomorphicFn()
  .server(fetchMiddlewareConfigOnServer)
  .client(fetchMiddlewareConfigInBrowser)

/** Everything a middleware-configuration cache entry's key starts with. */
const MIDDLEWARE_QUERY_KEY = ['vitnode', 'middleware'] as const

/**
 * How long a cached copy is trusted.
 *
 * Deployment configuration changes on deploy and not otherwise, so this is
 * generous on purpose: the login page and the SSO callback both read it, and
 * navigating between them should not re-ask. It is not `Infinity` only so a
 * long-lived tab eventually notices a deploy.
 *
 * No locale in the key: provider ids and names are configuration, not copy.
 */
const MIDDLEWARE_STALE_TIME = 300_000

export const middlewareConfigQueryOptions = () =>
  queryOptions({
    queryFn: async () => await fetchMiddlewareConfig(),
    queryKey: MIDDLEWARE_QUERY_KEY,
    staleTime: MIDDLEWARE_STALE_TIME,
  })

/**
 * The registered SSO providers, made safe to render.
 *
 * Core's own normaliser - the one the Next.js provider row uses - so a provider
 * missing a name, or listed twice, produces the same button row in both
 * frameworks.
 *
 * Takes the bare {@link MiddlewareConfig}, so it reads a
 * {@link MiddlewareConfigState} without caring which one it is: an unread
 * configuration has no providers, and an empty provider row is the correct
 * degraded rendering. Nothing here needs to know the difference.
 */
export const ssoProvidersOf = (config: MiddlewareConfig): SSOProvider[] =>
  normalizeSSOProviders(config.sso)
