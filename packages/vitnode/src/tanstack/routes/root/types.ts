import type { CoreAuthRouteContext, CoreRouteFactory } from "../types";

export type CoreRootRouteContext = CoreAuthRouteContext;

/** One screen with no shell above it. */
export type CoreRootRouteFactory = CoreRouteFactory<CoreRootRouteContext>;
