import type { AnyRoute } from "@tanstack/react-router";

import type { ContentFrontendRegistry } from "../../content/admin/registry";
import type { LocaleRouting } from "../../lib/i18n/locale-routing";
import type { RouteHeadOptions, RouteHeadResult } from "../metadata";

export type CorePageHead = (options?: RouteHeadOptions) => RouteHeadResult;

/** What a core route is built with. */
export interface CoreRouteContext {
  /** The host's `pageHead`, so every title ends with the site's own name. */
  pageHead: CorePageHead;
  /**
   * The route this screen hangs from - always a **pathless** container, so a
   * screen's `path` is its full public URL and nothing prefixes it.
   */
  parentRoute: AnyRoute;
}

export type CoreRouteFactory<
  TContext extends CoreRouteContext = CoreRouteContext,
> = (context: TContext) => AnyRoute;

/** What the Content Engine's splat needs beyond the usual two. */
export interface CoreAdminRouteContext extends CoreRouteContext {
  loadContentRegistry: () => Promise<ContentFrontendRegistry>;
}

export const routeSearch = <TSearch>(search: unknown): TSearch =>
  search as TSearch;

/** See {@link routeSearch}. */
export const routeContext = <TContext>(context: unknown): TContext =>
  context as TContext;

export interface CoreAuthRouteContext extends CoreRouteContext {
  localeRouting: Pick<LocaleRouting, "deLocalizeUrl">;
}

/** One screen that navigates on the visitor's behalf. */
export type CoreAuthRouteFactory = CoreRouteFactory<CoreAuthRouteContext>;
