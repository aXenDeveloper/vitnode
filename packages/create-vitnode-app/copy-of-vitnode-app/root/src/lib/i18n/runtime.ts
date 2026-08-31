import { createServerFn } from "@tanstack/react-start";
import { configureIntl, validateIntlInput } from "@vitnode/core/tanstack/i18n";
import { IntlProvider } from "use-intl";

import { i18n } from "#/i18n";
import { loadIntlMessages } from "#/server/messages.server";

/**
 * One language's messages for one set of namespaces, fetched on the server.
 *
 * The one piece of the i18n runtime that cannot live in `@vitnode/core`, and the
 * reason is the compiler rather than the code. A server function has to be
 * transformed by the Start plugin in *both* bundles; the package is externalised
 * from this app's SSR pass, so its modules reach the server un-compiled and a
 * `createServerFn` declared there resolves to `undefined` during SSR with no
 * error. See `packages/vitnode/src/tanstack/boundary.test.ts`.
 *
 * So the wrapper is here and the body is not: `validateIntlInput` is core's, and
 * `loadIntlMessages` delegates to core's loading engine. Start strips the
 * handler - and `#/server/messages.server` with it - out of the client build.
 */
export const getIntlMessages = createServerFn()
  .validator(validateIntlInput)
  .handler(async ({ data }) => await loadIntlMessages(data));

/**
 * This app's languages, handed to the package once.
 *
 * Everything in `@vitnode/core/tanstack/i18n` reads what this registers, so a
 * route file imports `RouteMessages` and `intlQueryOptions` straight from the
 * package. What must not happen is a route running before this module has been
 * evaluated - so the two framework entry points, `src/router.tsx` and
 * `src/start.ts`, both import from here, and `src/tests/intl-runtime.test.ts`
 * fails if either stops doing so.
 *
 * The registration is at module scope but reads `getIntlMessages` above only by
 * reference, so the order within this file does not matter: the validator and
 * the fetcher are both called per request, long after it has finished
 * evaluating.
 */
export const {
  defaultLocale,
  isLocale: isSupportedLocale,
  localeRouting,
} = configureIntl({
  fetchMessages: async input => await getIntlMessages({ data: input }),
  /**
   * This app's own `use-intl`, handed over so `RouteMessages` can provide it.
   *
   * `@vitnode/core` is external to this app's SSR pass (`vite.config.ts`), so
   * under `vite dev` Node loads the package and Vite loads this app, and the two
   * resolve `use-intl` to two different files - two `createContext` calls, two
   * React contexts. Everything the package renders reads its own; anything this
   * app renders with its own `useTranslations` - `routes/_main/index.tsx` does -
   * reads this one, and nothing inside the package can import it.
   *
   * So it is registered rather than imported, and `RouteMessages` mounts it
   * outermost. A production build resolves `use-intl` once and the providers
   * collapse into one, which is why leaving this out is a dev-only failure: the
   * route's server render throws "No intl context found", React quietly falls
   * back to client rendering, and the page still appears.
   */
  hostIntlProvider: IntlProvider,
  i18n,
});

/**
 * The router's half of locale routing, bound to this app's languages.
 *
 * Re-exported from here rather than imported straight from the package by
 * `src/router.tsx`: it is the router entry's only i18n import, and routing it
 * through this module is what makes `configureIntl` above run before the router
 * - and therefore before any route, loader or component - exists.
 */
export { createLocaleRewrite } from "@vitnode/core/tanstack/i18n";
