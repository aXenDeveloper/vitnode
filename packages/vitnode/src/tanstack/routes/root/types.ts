import type { CoreAuthRouteContext, CoreRouteFactory } from "../types";

/**
 * What a route with no shell above it is built with.
 *
 * The same shape a route under the main shell that navigates on the visitor's
 * behalf needs, and deliberately the same *type*: `/admin` and `/login` both
 * send a browser to a path a visitor supplied through `?returnTo=`, both have to
 * strip a locale prefix the route tree does not carry, and there must not be two
 * answers to that. The definition lives in `../types` beside `pageHead`, which
 * is injected for the same reason.
 */
export type CoreRootRouteContext = CoreAuthRouteContext;

/** One screen with no shell above it. */
export type CoreRootRouteFactory = CoreRouteFactory<CoreRootRouteContext>;
