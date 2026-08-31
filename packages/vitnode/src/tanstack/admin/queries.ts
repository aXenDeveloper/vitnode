import type { QueryClient } from "@tanstack/react-query";

import { ADMIN_SEARCH_USERS_QUERY_KEY } from "@/views/admin/layouts/search/search-users";
import { ADMIN_QUERY_ROOT } from "@/views/admin/table/query";

import { removeAdminSession } from "./state";

/**
 * Every cache entry the AdminCP shell owns, dropped.
 *
 * The canonical list, and the only one: nothing else in VitNode enumerates the
 * privileged AdminCP query roots. Callers that mean "this browser is now a
 * different person" want {@link removeAdminIdentityQueries} below, which is this
 * plus the session entry.
 *
 * Kept separate from `removeAdminSession` because the two answer to different
 * owners: the session entry belongs to the admin auth layer, and these belong to
 * the shell, which is the only thing that knows it has them.
 *
 * **Removed, not invalidated**, and the distinction is the whole point.
 * Invalidation keeps the value and marks it stale, so a second administrator
 * signing in on the same tab would be rendered the first one's user-lookup
 * results until a refetch returned. Removal deletes them, so the next reader has
 * nothing to render from.
 *
 * `ADMIN_QUERY_ROOT` is the second entry, and it covers every AdminCP *screen*
 * at once - the cron list, the queue, uploaded files, the system log, the search
 * index, the integrations board and the dashboard layout. None of it is
 * per-identity in the way a user lookup is, but all of it is privileged: it is
 * the operational state of the installation, readable only by an administrator
 * holding the right permission, and leaving it in a browser after a sign-out is
 * a copy of that state outliving the session that was allowed to see it. One
 * prefix rather than a list per screen, so a screen added later is collected
 * without anybody having to remember this file.
 *
 * It is not a prefix of `["vitnode", "admin-session"]`: Query matches keys
 * element by element, and `"admin"` is not `"admin-session"`. The session entry
 * has its own removal, `removeAdminSession`, and keeping the two apart is what
 * lets a screen invalidate its own rows without touching the permission set the
 * shell is rendering from.
 *
 * Anything the shell caches per-identity in future belongs on this list. It is
 * deliberately a list of *prefixes* rather than a `queryClient.clear()`: the
 * public session, the message catalogues and a plugin's own entries are not this
 * function's to throw away, and clearing them would turn a sign-out into a
 * full-cache eviction that re-fetches the whole application.
 */
export const removeAdminShellQueries = (queryClient: QueryClient): void => {
  queryClient.removeQueries({ queryKey: ADMIN_SEARCH_USERS_QUERY_KEY });
  queryClient.removeQueries({ queryKey: ADMIN_QUERY_ROOT });
};

/**
 * Everything privileged this browser holds about *the previous administrator*,
 * dropped - the admin session and every AdminCP screen entry, in one call.
 *
 * What an **identity boundary** calls: a successful admin sign-in, either
 * sign-out, a public sign-in, a finished SSO exchange, a verified sign-up. Each
 * of those is a moment where the person at the keyboard may have changed, and
 * the correct response is to re-derive everything privileged from the cookie the
 * browser now holds rather than to reuse the last answer.
 *
 * ## A sign-in is an identity boundary too, and that was the bug
 *
 * `removeAdminSession` alone was not enough. It drops
 * `["vitnode","admin-session"]` - the permission set - and leaves every AdminCP
 * *screen* entry where it was: the user-lookup results the palette cached, the
 * file table, the cron list, the dashboard layout. So Admin A could use the
 * panel, have their session expire or be revoked without ever signing out, and
 * Admin B could sign in on that same tab and be handed A's screens from memory.
 * The dashboard is the sharpest case, because its stored layout is
 * administrator-specific and its key is not scoped by identity.
 *
 * ## Removal, and before the navigation
 *
 * `removeQueries` throughout, never `invalidateQueries`. Invalidation keeps the
 * value and marks it stale, so the next render still paints the previous
 * administrator's data until a refetch returns. The whole point is that Admin B
 * must not see Admin A's cached value for even one frame, so the value has to be
 * gone rather than doubted.
 *
 * And it runs *before* whatever navigates. The AdminCP's guard reads the session
 * entry in `beforeLoad`; dropping it first is what makes that guard perform a
 * real read instead of deciding on what was already there.
 *
 * ## What it does not touch
 *
 * A list of AdminCP-owned prefixes, deliberately, and never
 * `queryClient.clear()`. The public session, the message catalogues and a
 * plugin's own entries are not this function's to throw away, and clearing them
 * would turn a sign-in into a full-cache eviction that re-fetches the whole
 * application. The public session has its own lifecycle in `tanstack/auth`,
 * which is the layer that knows what a public identity change means.
 */
export const removeAdminIdentityQueries = (queryClient: QueryClient): void => {
  removeAdminSession(queryClient);
  removeAdminShellQueries(queryClient);
};
