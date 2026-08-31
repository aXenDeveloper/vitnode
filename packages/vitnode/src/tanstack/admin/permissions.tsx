"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import type {
  PermissionsStaffArgs,
  StaffPermissionSet,
} from "@/api/lib/permission-staff";

import {
  AdminStaffPermissionGate,
  AdminStaffPermissionProvider,
  useAdminStaffPermission,
  useAdminStaffPermissions,
} from "@/components/staff-permission/provider";

import type { AdminAccessState, AdminSessionApi } from "./session-api";

import { adminSessionQueryOptions } from "./session-query";
import { adminPermissionsOf, hasAdminPermission } from "./state";

/**
 * The AdminCP's permission UI, fed from the one admin session query.
 *
 *     Hono /admin/session  ->  ["vitnode","admin-session"]  ->  this provider
 *                                                                    |
 *                              AdminStaffPermissionGate, useAdminStaffPermission
 *
 * One server truth, one browser query state, one React context. The context is
 * the *existing* one from `components/staff-permission/provider` rather than a
 * second of its own, which is what keeps every screen written against
 * `AdminStaffPermissionGate` and `useAdminStaffPermission` working unchanged -
 * and means there is no moment where two permission states exist and can
 * disagree.
 *
 * That provider is a rendering adapter and nothing more. It holds no state of
 * its own, it cannot be written to, and it is not authorization: `api/config.ts`
 * puts `globalAdminMiddleware()` in front of every admin API path and each
 * handler re-checks the staff tables, so editing this value in devtools reveals
 * a button and buys nothing behind it.
 */

/**
 * Mounts the admin permission context for everything under the AdminCP shell.
 *
 * Reads the canonical query rather than taking a prop, which is what makes it a
 * bridge instead of a second store: there is no way to mount this with a
 * permission set that did not come from the API.
 *
 * ## It does not suspend in practice, and cannot below itself
 *
 * `useSuspenseQuery` is the one suspension point in the chain, and `_admin`'s
 * `beforeLoad` has already filled the entry through `ensureAdminAccess` before
 * any of this renders - so on the first paint the data is there. (A later
 * *refetch* does not suspend either: `useSuspenseQuery` serves the previous
 * value while an invalidated entry refreshes, so bringing permissions back in
 * step never blanks the sidebar.)
 *
 * Below this, nothing can suspend at all: the resolved set goes into the context
 * as a plain value, and `useAdminStaffPermissions` returns it directly rather
 * than unwrapping a promise. That is what lets a pure function like
 * `buildAdminNav` be called straight out of a hook.
 *
 * ## A failed read never reaches here
 *
 * The query rejects on a `429`, a `500` or an unreachable API, so this component
 * is not rendered at all in those cases and the route's error boundary owns the
 * screen. What that means for the value below is precise and worth stating: an
 * empty permission set here is always `denied` - the API was asked and said this
 * browser holds no admin session - and never "we could not find out". The two
 * would look identical to a gate, which is exactly why they are kept apart
 * upstream.
 */
export const AdminPermissionsProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { data } = useSuspenseQuery(adminSessionQueryOptions());

  return (
    <AdminStaffPermissionProvider value={adminPermissionsOf(data)}>
      {children}
    </AdminStaffPermissionProvider>
  );
};

/**
 * The admin access decision, in a component.
 *
 * The identical `adminSessionQueryOptions` object the loader warmed, so this
 * reads the entry the guard filled rather than starting a second one. A route
 * whose loader and component reach for different options objects warms a cache
 * entry the component never sees - which is the failure this shape exists to
 * make impossible.
 */
export const useAdminAccess = (): AdminAccessState =>
  useSuspenseQuery(adminSessionQueryOptions()).data;

/**
 * The signed-in administrator, or `null` when this browser holds no admin
 * session.
 *
 * `null` rather than a throw, because the pieces that call this - the user bar,
 * an avatar - render inside a shell that has already decided access. The guard
 * is what turns "no admin session" into a redirect; a component's job is only to
 * render nothing.
 */
export const useAdminUser = (): AdminSessionApi["user"] | null => {
  const access = useAdminAccess();

  return access.status === "granted" ? access.session.user : null;
};

/**
 * The current administrator's effective permission set.
 *
 * Re-exported through this module so an AdminCP screen has one import to reach
 * for, and so the underlying context stays an implementation detail that can
 * follow the Next.js surface out of the codebase.
 */
export const useAdminPermissions: () => StaffPermissionSet =
  useAdminStaffPermissions;

/**
 * Whether the current administrator holds a permission.
 *
 * `plugin` is required here, exactly as it is on the underlying hook: a plugin's
 * screen must name its own `pluginId`, because a permission granted under core
 * does not open a plugin's page. {@link hasAdminPermission} in `./state` is the
 * variant that defaults it, for the core screens that would otherwise write
 * `@vitnode/core` a hundred times.
 */
export const useAdminPermission: (args: PermissionsStaffArgs) => boolean =
  useAdminStaffPermission;

/**
 * Renders `children` only for an administrator holding the permission.
 *
 * The existing gate, re-exported unchanged. It is the AdminCP's established way
 * of hiding a control, and it stays that way: a TanStack screen and a Next.js
 * screen gate a "delete" button with the same component, so the two cannot drift
 * apart while both exist.
 */
export { AdminStaffPermissionGate as AdminPermissionGate };

export { hasAdminPermission };
