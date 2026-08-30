/**
 * Cache keys for the AdminCP screens whose answer depends on *who is asking*.
 *
 * `adminQueryRoot("cron")` is enough for the operational screens: a cron job's
 * schedule is the same fact for every administrator who is allowed to read it,
 * and a sign-out drops the whole `["vitnode", "admin"]` prefix anyway.
 *
 * The permission-sensitive screens are not like that. What comes back from the
 * users, roles and staff endpoints is *shaped by the reader's own permissions* -
 * `users:can_edit_admin` decides whether a row may be edited, `self` on a staff
 * entry is computed against the caller's own roles, and `users:can_view` decides
 * whether there is a list at all. Two administrators asking the same question
 * get two different answers, so they must not share a cache entry.
 *
 * The dashboard is here for a different reason, and it is worth stating because
 * the two look alike and are not. Its layout is not *shaped* by permissions - it
 * is simply somebody's property. `core_admin_dashboard` holds one row per
 * administrator under a `UNIQUE` constraint on `userId`, and the handler scopes
 * the read to the session's own id, so the answer is not a different view of one
 * fact but a different fact entirely. That makes it the sharpest case on this
 * list rather than the mildest: a shared key does not merely risk showing the
 * wrong emphasis, it shows another person's board - and a save from that board
 * writes their widget ids into the reader's row.
 *
 *     ["vitnode", "admin", "users", 7, "list", { first: "10" }]
 *      \______________________________/  |  \__________________/
 *            the AdminCP root           |      the request
 *                          the identity it was read for
 *
 * ## Both mechanisms, not one
 *
 * - **Partitioning** stops a second identity *reading* the first one's entry.
 *   It works immediately and without anything having to run: a different admin
 *   means a different key, and a different key means a fetch.
 * - **Removal** stops it being in memory at all. `removeAdminShellQueries` drops
 *   `["vitnode", "admin"]` on sign-out, and because every key below starts with
 *   that prefix it collects these too - no list to extend, nothing to remember.
 *
 * ## The id never leaves the browser
 *
 * It is a *cache* concern and never a request one. The AdminCP API derives who
 * is asking from the `vitnode_auth_admin` cookie on every single request, so a
 * user id in a query string would be a second, weaker answer to a question the
 * cookie already settles - and one the caller controls. It appears in a key and
 * nowhere near a fetcher.
 */

import { adminQueryRoot } from "@/views/admin/table/query";

/**
 * `null` is a real partition rather than a missing one.
 *
 * It is the key a read performed with no granted admin session would use - the
 * sign-in screen's tolerant prefetch, a failed session read - and it must not
 * collide with any administrator's.
 */
export type AdminIdentity = null | number;

/**
 * The whole of one screen's cache, for one administrator.
 *
 * What a mutation invalidates: every page, sort and filter of the list it
 * changed, for the admin looking at it, and nothing belonging to anyone else.
 */
export const adminScopedQueryRoot = (
  screen: string,
  adminUserId: AdminIdentity,
) => [...adminQueryRoot(screen), adminUserId] as const;

/** One cache entry under that root - a list page, or a single record. */
export const adminScopedQueryKey = (
  screen: string,
  adminUserId: AdminIdentity,
  ...rest: readonly unknown[]
) => [...adminScopedQueryRoot(screen, adminUserId), ...rest] as const;

/** The screen names used below, so a typo is a compile error rather than a miss. */
export const ADMIN_USERS_SCREEN = "users";
export const ADMIN_ROLES_SCREEN = "roles";
export const ADMIN_STAFF_SCREEN = "staff";
export const ADMIN_DASHBOARD_SCREEN = "dashboard";
