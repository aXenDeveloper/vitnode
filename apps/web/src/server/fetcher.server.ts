import '@tanstack/react-start/server-only'
import {
  getRequestHeaders,
  getRequestIP,
  getRequestUrl,
  setCookie,
} from '@tanstack/react-start/server'
import { CONFIG } from '@vitnode/core/lib/config'
import { coreFetcher } from '@vitnode/core/lib/fetcher/core'
import { buildForwardedHeaders } from '@vitnode/core/lib/fetcher/request-context'
import { parseSetCookies } from '@vitnode/core/lib/fetcher/set-cookie'
import { config } from 'dotenv'

/**
 * `.env` into `process.env`, for anything that still reads it: the browser
 * bundle's inlined `NEXT_PUBLIC_*` values, the database and Redis URLs the
 * mounted API needs, and `resolveApiOrigin`'s fallback below.
 *
 * Vite's config already does this for `vite dev` and `vite build`. This covers
 * `node .output/server/index.mjs`, where Vite is not involved, the same way
 * `apps/api` does it. dotenv does not overwrite what is already set, so a
 * platform that injects real environment variables still wins.
 */
config({ quiet: true })

/**
 * The origin to call `/api/*` on.
 *
 * This app *serves* the API, so the answer is not configuration - it is
 * whichever origin the request being rendered arrived on. Taking it from the
 * request is what makes a preview deployment work: its hostname is generated
 * per branch, so no `NEXT_PUBLIC_API_URL` could name it, and the old default of
 * `http://localhost:3000` names a completely different app in development (this
 * one is on 3001) or nothing at all in production.
 *
 * `getRequestUrl()` reads the `Host` header the request arrived with and honours
 * `x-forwarded-proto`, so a TLS-terminating proxy in front of a plain-HTTP
 * server still yields an `https:` origin. `x-forwarded-host` is deliberately
 * *not* honoured: it is a header a visitor can set, and these calls carry that
 * visitor's cookies, so trusting it would let a request point this server's
 * API calls at a host of the caller's choosing.
 *
 * Outside a request - boot, a script, a cron job - there is nothing to read and
 * `getRequestUrl()` throws, so `NEXT_PUBLIC_API_URL` remains the fallback.
 *
 * The browser reaches the same conclusion on its own: with nothing configured,
 * `CONFIG.api` reads the origin the document was served from, so a client-side
 * call stays on this app too. `NEXT_PUBLIC_API_URL` is therefore optional here
 * rather than load-bearing - set it only to point at a separate API server.
 */
export const resolveApiOrigin = (): string => {
  try {
    return getRequestUrl().origin
  } catch {
    return CONFIG.api.origin
  }
}

/**
 * The request state this app forwards to the API, read off the request being
 * rendered.
 *
 * The API derives who is asking from `Cookie`, the device record from
 * `user-agent`, and the rate-limit key and audit IP from `x-forwarded-for`. Send
 * none of it and every SSR render is answered as an anonymous visitor sharing a
 * single rate-limit bucket - so this is the difference between signed-in HTML and
 * signed-out HTML, not a nicety.
 *
 * The allowlist itself lives in `@vitnode/core` because Next's `fetcher()` sends
 * exactly the same set; only the reading differs. Nothing else is copied
 * across: `host` and `content-length` describe the page request rather than the
 * API call, and `origin`, `referer` and `authorization` are values the API
 * trusts, so forwarding whatever a visitor put in them would hand them state
 * they should not control.
 */
export const getForwardedApiHeaders = ({
  captchaToken,
}: { captchaToken?: string } = {}): Record<string, string> => {
  const headers = getRequestHeaders()

  return buildForwardedHeaders({
    captchaToken,
    cookie: headers.get('cookie'),
    // The header first, verbatim, chain included: that is what the API stores
    // and what Next's `fetcher()` sends, and re-deriving it would log this
    // server's hop as the visitor's IP. `getRequestIP()` is the fallback for a
    // directly-exposed server, where there is no proxy to have written one -
    // better than the `0.0.0.0` the header's absence would otherwise mean.
    forwardedFor: headers.get('x-forwarded-for') ?? getRequestIP(),
    userAgent: headers.get('user-agent'),
  })
}

/**
 * `coreFetcher` with this request's context attached - the TanStack Start
 * equivalent of `@vitnode/core/lib/fetcher`, which reads the same state through
 * `next/headers` and is unusable here.
 *
 * Typed as `typeof coreFetcher` so route literals, methods and response schemas
 * keep inferring exactly as they do everywhere else in VitNode.
 *
 * Server-side only, and only inside a request: the headers come from the request
 * currently being handled, so a module-scope call has nothing to read. In
 * TanStack Start that means a `createServerFn` handler or a server route - not a
 * route `loader`, which also runs in the browser on client-side navigation.
 */
export const fetcherServer: typeof coreFetcher = async (
  moduleReturn,
  options,
) =>
  coreFetcher(moduleReturn, {
    ...options,
    additionalHeaders: {
      ...getForwardedApiHeaders(),
      ...options.additionalHeaders,
    },
    // Same-origin by construction, and ahead of `NEXT_PUBLIC_API_URL` - which
    // an explicit `origin` on the call can still override.
    origin: options.origin ?? resolveApiOrigin(),
  })

/**
 * Copies the cookies the API just minted onto this response - the counterpart of
 * `allowSaveCookies` on Next's `fetcher()`.
 *
 * Sign-in, sign-up, sign-out and the SSO callback all answer with a
 * `Set-Cookie`, and so does any first call from a browser with no device cookie.
 * Those land on the API's response to *this server*, which the browser never
 * sees, so without this the visitor is signed in for exactly one render.
 *
 * Call it only for a response you meant to trust: it writes every cookie the
 * response carries.
 */
export const saveApiCookies = (response: Response): void => {
  for (const { name, options, value } of parseSetCookies(
    response.headers.getSetCookie(),
  )) {
    setCookie(name, value, options)
  }
}
