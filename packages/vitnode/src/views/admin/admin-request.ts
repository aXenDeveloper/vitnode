import type { BaseBuildModuleReturn } from "@/api/lib/module";

import { CONFIG_PLUGIN } from "@/config";
import { clientModule } from "@/lib/fetcher-client";

/**
 * What every AdminCP screen read has in common: how it names the API module it
 * talks to, and what it does when the API refuses.
 *
 * Two things, both of which used to be re-invented per screen and both of which
 * are wrong in the same way when they are.
 */

/**
 * An admin API module as a value the fetchers can carry without pulling the API
 * into either bundle.
 *
 * The module is imported as a **type** only, so route literals, methods and
 * response schemas all still infer; this supplies the one field the fetcher
 * reads at runtime. Every AdminCP module is core's, so the plugin id is not a
 * parameter - a plugin's own admin screen builds its own reference with
 * `clientModule` and its own id.
 *
 *     const cronAdminModuleRef = adminModuleRef<typeof cronAdminModule>();
 */
export const adminModuleRef = <T extends BaseBuildModuleReturn>(): T =>
  clientModule<T>(CONFIG_PLUGIN.pluginId);

/** The `name` every {@link AdminRequestError} carries. See below. */
const ADMIN_REQUEST_ERROR = "AdminRequestError";

/**
 * An AdminCP read was refused, and this is what it was refused with.
 *
 * A thrown error rather than a returned one, because the alternative is the bug
 * this class exists to prevent: the fetchers hand non-2xx responses back rather
 * than throwing on them, and `json()` would happily parse a `401` or a `429`
 * body. Read as a page it has no `edges`, so the table renders empty - a failure
 * that looks exactly like an installation with nothing in it, which is the one
 * thing an operational screen must never look like. TanStack Query can only
 * retry, report, or keep the last good page if the promise actually rejects.
 *
 * `status` is on the error rather than folded into the message so a caller can
 * tell the finite cases apart without parsing English. `401` and `403` mean the
 * admin session ended or never allowed this - the route guard is a navigation
 * rule, not the boundary, so this is the *authorization* answer and it can
 * arrive on a page the guard already let through. `429` is the rate limiter. A
 * `500` never reaches here at all: `rawApiFetch` throws on those with the body
 * attached.
 *
 * Recognised by `name` rather than by `instanceof`: `@vitnode/core` is imported
 * from `dist` by the apps and from `src` by its own tests, so two copies of this
 * class can exist in one process and `instanceof` would answer `false` across
 * them.
 */
export class AdminRequestError extends Error {
  constructor(status: number, screen: string, detail?: string) {
    super(
      `The admin API answered ${status} for ${screen}${detail ? ` (${detail})` : ""}.`,
    );
    this.name = ADMIN_REQUEST_ERROR;
    this.screen = screen;
    this.status = status;
  }

  /** Which screen was asking - the first question anyone reading a log has. */
  readonly screen: string;

  readonly status: number;
}

export const isAdminRequestError = (
  error: unknown,
): error is AdminRequestError =>
  error instanceof Error && error.name === ADMIN_REQUEST_ERROR;

/**
 * The parameters a failed request was carrying, for its message.
 *
 * Its own function because an error message is the only trace a production
 * failure leaves, and "which page was it asking for" is the first thing anyone
 * reading one wants.
 */
export const describeAdminParams = (params: object): string =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(", ") || "no filters";
