import type { LocaleRouting } from "../../../lib/i18n/locale-routing";
import type { CoreRouteContext, CoreRouteFactory } from "../types";

/**
 * What a route with no shell above it is built with.
 *
 * One field more than the others, and it is the reason these screens were the
 * last to move: a sign-in performs a navigation nobody clicked, to a path a
 * *visitor* supplied through `?returnTo=`. Deciding what the router should be
 * handed means stripping the locale prefix the route tree does not carry - and
 * which languages exist is the installation's, not this package's.
 *
 * So the app's own locale rule is injected, exactly as `pageHead` and
 * `contentRegistry` are, and `createAuthNavigation` builds both halves of the
 * navigation from it. See `@vitnode/core/tanstack/auth`.
 */
export interface CoreRootRouteContext extends CoreRouteContext {
  localeRouting: Pick<LocaleRouting, "deLocalizeUrl">;
}

/** One screen with no shell above it. */
export type CoreRootRouteFactory = CoreRouteFactory<CoreRootRouteContext>;
