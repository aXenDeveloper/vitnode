import type { QueryClient } from "@tanstack/react-query";

import { ADMIN_SEARCH_USERS_QUERY_KEY } from "@/views/admin/layouts/search/search-users";
import { ADMIN_QUERY_ROOT } from "@/views/admin/table/query";

/**
 * Every cache entry the AdminCP shell owns, dropped.
 *
 * Called on sign-out, alongside - not instead of - the canonical
 * `removeAdminSession`. The two are separate because they answer to different
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
