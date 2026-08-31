import { notFound } from "@tanstack/react-router";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import type { AdminLoaderContext } from "./intl";
import type { AdminAccessState } from "./session-api";

import { hasAdminPermission } from "./state";

/**
 * What an AdminCP *screen* - as opposed to the shell - reads out of its route
 * context, and the one decision every one of them makes before it fetches
 * anything.
 */

/**
 * The narrowest slice of a route's context an AdminCP screen loader reads.
 *
 * `adminAccess` is `_admin`'s own `beforeLoad` return, already narrowed to the
 * decision the API actually gave and already used to admit the navigation. A
 * screen therefore never re-reads the session: there is exactly one answer per
 * navigation, and no way for a loader to decide something the guard did not.
 */
export interface AdminScreenContext extends AdminLoaderContext {
  adminAccess: AdminAccessState;
}

/**
 * The screen's own permission, on top of holding an admin session at all.
 *
 * An administrator without the permission gets the AdminCP's 404, not a redirect
 * and not an empty table - a redirect tells them where they are not allowed to
 * be, and an empty table reads as "no records". `notFound()` is TanStack
 * Router's own control-flow signal, and the guard route's `notFoundComponent`
 * answers it, rendering `AdminNotFound` inside the shell it mounts. See the note
 * on `AdminNotFound` for why the shell has to be mounted there rather than
 * inherited.
 *
 * ## It is not the security boundary, and must never be treated as one
 *
 * `api/config.ts` puts `globalAdminMiddleware()` in front of every request whose
 * path contains `/admin/`, and each route below declares its own
 * `adminStaffPermission`, re-checked against the staff tables on every request.
 * This runs on a permission set derived from a response the browser can read, so
 * it decides what to *render*. An administrator who edits that set in devtools
 * reaches a screen whose every request the API still refuses - which is what
 * {@link AdminRequestError} turns into a failed query rather than an empty page.
 *
 * ## Why it runs in the loader rather than in the component
 *
 * Called at the top of a screen's loader, before the reads it guards, so a
 * request the API is going to refuse is never sent - and no admin markup is
 * streamed for a screen that is about to be replaced. The Next.js version could
 * not do that: `AdminPermissionRequired` is a Server Component wrapping the
 * table, so the heading above it renders first and the 404 arrives afterwards.
 *
 * `plugin` defaults to `@vitnode/core`, exactly as `hasAdminPermission` does, so
 * a core screen names two fields. A plugin's own screen passes its `pluginId` -
 * a permission granted under core must not open a plugin's page.
 */
export const requireAdminPermission = (
  access: AdminAccessState,
  args: Omit<PermissionsStaffArgs, "plugin"> & { plugin?: string },
): void => {
  if (hasAdminPermission(access, args)) return;

  // TanStack Router's own control-flow signal - a typed value the router catches
  // and turns into the nearest `notFoundComponent`. Throwing it is what stops
  // the loader.
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw notFound();
};
