import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import type { AdminAccessState } from "./session-api";

import { useAdminAccess } from "./permissions";

/**
 * Which administrator a cached read belongs to.
 *
 * The permission-sensitive AdminCP screens - users, roles, both staff lists -
 * answer differently depending on who is asking: `users:can_edit_admin` decides
 * whether a row may be edited, and `self` on a staff entry is computed against
 * the caller's own roles. Two administrators must not share a cache entry for
 * one request, so every one of those keys carries this.
 *
 * ## It is a cache concern, and only a cache concern
 *
 * The id never reaches a fetcher. The AdminCP API derives who is asking from the
 * `vitnode_auth_admin` cookie on every request, so a user id in a query string
 * would be a second, weaker answer to a question the cookie already settles -
 * and one a caller controls. See `views/admin/views/core/shared/admin-scope.ts`.
 *
 * `null` for a denial is a real partition rather than a missing one: it is the
 * key a read with no granted session would use, and it must not collide with any
 * administrator's.
 */
export const adminIdentityOf = (access: AdminAccessState): AdminIdentity =>
  access.status === "granted" ? access.session.user.id : null;

/**
 * The same answer, for a component.
 *
 * Reads the one `["vitnode","admin-session"]` entry the guard already filled, so
 * a component and the loader above it cannot disagree about whose cache entry
 * they are looking at.
 */
export const useAdminIdentity = (): AdminIdentity =>
  adminIdentityOf(useAdminAccess());

export type { AdminIdentity };
