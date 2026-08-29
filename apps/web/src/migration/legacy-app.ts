import { localizeHref } from '@vitnode/core/tanstack/i18n'

import type { Locale } from '#/lib/i18n/shared'

/**
 * Where the half of VitNode that has not moved yet is actually served.
 *
 * Temporary migration infrastructure, and deliberately this app's own rather
 * than `@vitnode/core`'s `CONFIG`: "there is a second, older application" is
 * true for the length of this migration and false before and after it, so it
 * does not belong in the permanent configuration every VitNode install carries.
 * It is expected to be deleted with the last legacy route.
 *
 * It is *not* `NEXT_PUBLIC_WEB_URL`, which already means "this application's own
 * public origin" and is stamped into cookies, SSO callbacks, password-reset
 * links and every email VitNode sends. Reusing it here would point all of those
 * at the wrong app.
 *
 * Read through a getter rather than captured at module load, matching how
 * `CONFIG` reads its own values: the browser gets this inlined at build time
 * (`vitNodeEnv({ clientEnv: [...] })` in `vite.config.ts` - the one key this app
 * adds to the package's list) and the server reads the live environment, so a
 * built server can be repointed by its host.
 */
export const legacyWebOrigin = (): string | undefined => {
  const configured = process.env.NEXT_PUBLIC_LEGACY_WEB_URL

  if (!configured) return undefined

  try {
    return new URL(configured).origin
  } catch {
    // A typo in a public env var should not blank a page. Falling through to
    // `undefined` degrades to a same-origin link, which is wrong in exactly the
    // deployment that got the value wrong and harmless in the one that has no
    // second origin at all.
    return undefined
  }
}

/**
 * A link to a route the legacy application still owns.
 *
 * Pure, so the two decisions it makes are testable without a router or a DOM:
 *
 * 1. **Localize.** `localizeHref` is Stage 3's own rule - idempotent, and a
 *    no-op for the default locale and for paths outside the localized URL space
 *    (`/admin`). Nothing here concatenates a prefix, so `/pl/pl/...` is not a
 *    shape this can produce.
 * 2. **Re-origin.** With `legacyOrigin` set, the localized path is resolved
 *    against it, which is what turns a document navigation into one that
 *    actually leaves this server. The query string and hash ride along.
 *
 * With no `legacyOrigin` the result stays relative - the pre-existing behaviour,
 * and the right one when a proxy in front of both apps routes by path. VitNode
 * ships no such proxy today, which is why `.env.example` sets the variable.
 */
export const buildLegacyHref = ({
  href,
  legacyOrigin,
  locale,
}: {
  href: string
  legacyOrigin?: string
  locale: Locale
}): string => {
  const localized = localizeHref(href, locale)

  if (!legacyOrigin) return localized

  return new URL(localized, legacyOrigin).href
}
