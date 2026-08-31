/**
 * The user half of the AdminCP command palette, as types only.
 *
 * Separate from `search-users.action.server.ts` because that module is a
 * `"use server"` boundary: importing it pulls `@/lib/fetcher` - and with it
 * `server-only` and `next/headers` - into whatever imports it. The shared dialog
 * needs the *shape* and the *signature*, never the implementation, so those live
 * here and each framework supplies its own reader.
 */

/** One user, as the palette renders them. */
export interface AdminSearchUser {
  avatarColor: string;
  email: string;
  id: number;
  name: string;
  nameCode: string;
}

/**
 * How the palette looks a user up.
 *
 * A prop rather than an import, and the reason is the same one the sign-out
 * button has: Next.js answers this with a Server Action, and a TanStack Start
 * host with a server function its own compiler can see. Neither may be named
 * inside a shared component.
 *
 * The contract is deliberately narrow: it is called only when the admin holds
 * `users:can_view` and the query is long enough, and a failure is expected to
 * resolve to an empty list rather than reject - a palette that cannot reach the
 * user index should still show the pages it matched.
 */
export type AdminUserSearch = (query: string) => Promise<AdminSearchUser[]>;

/**
 * The palette's user-lookup cache, as one key prefix.
 *
 * Named rather than written inline at the one `useQuery` because it also has to
 * be *removed*: results are a previous identity's private data, and a React
 * Query cache outlives a sign-out. A second administrator signing in on the same
 * tab, without a reload, would otherwise be served the first one's matches from
 * memory. See `removeAdminShellQueries`.
 */
export const ADMIN_SEARCH_USERS_QUERY_KEY = [
  "vitnode",
  "admin-search-users",
] as const;

/** One query's key: the prefix above, plus the trimmed search term. */
export const adminSearchUsersQueryKey = (query: string): unknown[] => [
  ...ADMIN_SEARCH_USERS_QUERY_KEY,
  query,
];
