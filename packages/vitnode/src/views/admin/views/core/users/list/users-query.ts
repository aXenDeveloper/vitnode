import { queryOptions } from "@tanstack/react-query";

import type { adminModule } from "@/api/modules/admin/admin.module";
import type {
  AdminTableContract,
  AdminTablePage,
  AdminTableParams,
  RawAdminTableParams,
} from "@/views/admin/table/params";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { fetcherClient } from "@/lib/fetcher-client";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import {
  AdminRequestError,
  adminModuleRef as buildAdminModuleRef,
  describeAdminParams,
} from "@/views/admin/admin-request";
import { normalizeAdminTableParams } from "@/views/admin/table/params";
import {
  ADMIN_USERS_SCREEN,
  adminScopedQueryKey,
  adminScopedQueryRoot,
} from "@/views/admin/views/core/shared/admin-scope";

/**
 * The AdminCP users list, as one query definition.
 *
 * `GET /api/@vitnode/core/admin/users/list`, behind
 * `adminStaffPermission: { module: "users", permission: "can_view" }` - re-checked
 * against the staff tables on every request, so nothing in this file authorizes
 * anything. What lives here is *what* to ask for: the page, the sort, the search
 * term and the role filter, normalised once so the Next.js Server Component and
 * the TanStack Start loader send the same request rather than two that look
 * alike.
 *
 * The transport is not fixed - a loader on a server and a component in a browser
 * cannot reach the API the same way - so {@link adminUsersQueryOptions} takes a
 * `fetchPage` and defaults it to the browser's.
 */

/**
 * Every AdminCP module hangs off the one root `adminModule`, so the reference is
 * the root's and the module is named per request (`admin/users`). Imported as a
 * *type*, so route literals and response schemas still infer while the browser
 * bundle carries only a plugin id.
 */
export const adminModuleRef = buildAdminModuleRef<typeof adminModule>();

/** The columns `listUsersAdminRoute` sorts by. Anything else is a `400`. */
export const ADMIN_USERS_ORDER_BY = ["createdAt", "name"] as const;
export type AdminUsersOrderBy = (typeof ADMIN_USERS_ORDER_BY)[number];

/** What the table shows when the URL asks for no particular order. */
export const ADMIN_USERS_DEFAULT_ORDER = {
  column: "createdAt",
  order: "desc",
} as const;

/** Sortable by two columns, searchable, and - uniquely - filtered by role. */
export const ADMIN_USERS_TABLE_CONTRACT: AdminTableContract<AdminUsersOrderBy> =
  {
    orderBy: ADMIN_USERS_ORDER_BY,
    search: true,
  };

/**
 * The users list's request.
 *
 * `AdminTableParams` plus the one parameter no other admin table has: `roleId`,
 * a comma-separated set of primary-role ids written by the filter dropdown.
 * Extended here rather than added to the shared contract because it is this
 * screen's, and a shared type that grows a field per screen stops describing
 * anything.
 */
export interface AdminUsersParams extends AdminTableParams<AdminUsersOrderBy> {
  roleId?: string;
}

export type RawAdminUsersParams = RawAdminTableParams & {
  roleId?: null | string | string[] | undefined;
};

/** The first value for a key, since only one can reach the API. */
const readOne = (value: null | string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? "";

  return value ?? "";
};

/**
 * The role filter, reduced to ids that could be ids.
 *
 * The dropdown writes `?roleId=2,5`; a hand-edited `?roleId=abc` would reach
 * `Number()` in the handler and filter by `NaN`, which matches nothing and looks
 * exactly like "there are no users with that role". Duplicates and order are
 * normalised for the same reason the queue's status filter is: `?roleId=5,2` and
 * `?roleId=2,5` are one query and must be one cache entry.
 *
 * `undefined` for an empty selection, so the parameter is *absent* - an empty
 * `?roleId=` is not the same request as no filter at all.
 */
export const normalizeAdminRoleFilter = (
  value: null | string | string[] | undefined,
): string | undefined => {
  const ids = [
    ...new Set(
      readOne(value)
        .split(",")
        .map(part => part.trim())
        .filter(part => /^[1-9]\d*$/.test(part)),
    ),
  ].sort((a, b) => Number(a) - Number(b));

  return ids.length > 0 ? ids.join(",") : undefined;
};

/**
 * The request this URL is asking for.
 *
 * Total and idempotent, like every normaliser in this layer: a `validateSearch`
 * that throws turns a hand-edited query string into a router error screen, and
 * the router re-validates the location every navigation produces.
 */
export const normalizeAdminUsersParams = (
  raw: RawAdminUsersParams = {},
): AdminUsersParams => {
  const params: AdminUsersParams = normalizeAdminTableParams(
    raw,
    ADMIN_USERS_TABLE_CONTRACT,
  );
  const roleId = normalizeAdminRoleFilter(raw.roleId);
  if (roleId !== undefined) params.roleId = roleId;

  return params;
};

/**
 * One page of the list, as arguments to whichever fetcher is carrying it.
 *
 * `withPagination` is deliberately absent - see `views/admin/table/params.ts`
 * for why an invisible default is a cache-key bug rather than a convenience.
 */
/** One role, with every translation of its name - resolved where it is rendered. */
export interface AdminUserRole {
  color: null | string;
  id: number;
  name: { languageCode: string; name: string }[];
}

/**
 * One row of the users table, as JSON delivers it.
 *
 * Declared rather than inferred off the fetcher, because an inferred type cannot
 * be named across a declaration-emit boundary. It stays honest anyway:
 * {@link fetchAdminUsersPageInBrowser} is typed as {@link AdminUsersPageFetcher}
 * and returns the response's own inferred shape, so a column renamed in
 * `listUsersAdminRoute` stops this file compiling.
 */
export interface AdminUserRow {
  avatarColor: string;
  birthday: Date | null | string;
  createdAt: Date | string;
  email: string;
  emailVerified: boolean;
  id: number;
  language: string;
  name: string;
  nameCode: string;
  newsletter: boolean;
  role: AdminUserRole;
  roleId: number;
  secondaryRoles: AdminUserRole[];
}

export type AdminUsersPage = AdminTablePage<AdminUserRow>;

/**
 * How a page is actually fetched.
 *
 * The second argument is the read's cancellation, and it is optional so the SSR
 * branch - which is handed no signal, deliberately - satisfies this with one
 * parameter. See {@link adminUsersQueryOptions}.
 */
export type AdminUsersPageFetcher = (
  params: AdminUsersParams,
  options?: { signal?: AbortSignal },
) => Promise<AdminUsersPage>;

/**
 * One page, fetched from the browser.
 *
 * A refusal *throws*. An empty table is what an installation with no users looks
 * like, and a `403` - this administrator lost `users:can_view` while the page
 * was open - must never render as that. An **abort** throws for the same reason
 * and by the same route: `fetch` rejects before there is a response to read, so
 * nothing below runs and no `catch` here turns a cancelled sort into an
 * installation with no users.
 */
export const fetchAdminUsersPageInBrowser: AdminUsersPageFetcher = async (
  params,
  { signal } = {},
) => {
  const response = await fetcherClient(adminModuleRef, {
    args: { query: params },
    method: "get",
    module: "admin/users",
    options: { credentials: "include", signal },
    path: "/list",
  });

  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "the users list",
      describeAdminParams(params),
    );
  }

  return await response.json();
};

/**
 * Every page, sort and filter of the users list, for one administrator.
 *
 * The unit a create, an edit or an email verification invalidates: the row that
 * changed may be on any page, under any sort.
 */
export const adminUsersQueryRoot = (adminUserId: AdminIdentity) =>
  adminScopedQueryRoot(ADMIN_USERS_SCREEN, adminUserId);

export const adminUsersQueryKey = ({
  adminUserId,
  params,
}: {
  adminUserId: AdminIdentity;
  params: AdminUsersParams;
}) => adminScopedQueryKey(ADMIN_USERS_SCREEN, adminUserId, "list", params);

/**
 * The users list, as the one query definition every caller shares.
 *
 *     loader:     ensureQueryData(adminUsersQueryOptions({ fetchPage, ... }))
 *     component:  useSuspenseQuery(adminUsersQueryOptions({ ... }))
 *     mutation:   invalidate `adminUsersQueryRoot(adminUserId)`
 *
 * `retry: false`: a `403` will not become a `200` because we asked again, and a
 * `429` is answered by sending the same request twice more.
 *
 * The `queryFn` **reads** `signal` off the context, which is what makes the read
 * cancellable at all - Query marks a query cancellable only when its function
 * actually touches that getter. Re-sorting the table three times now leaves one
 * request in flight rather than three, and the two that lost reject with an
 * `AbortError` rather than resolving late over the answer somebody is reading.
 *
 * It is safe here because the failure path throws: the abort rejects inside
 * `fetch`, before there is a response to inspect, so it cannot be mistaken for
 * an empty page or a refusal. A fetcher whose `catch` returns a fallback would
 * have to re-throw the abort first; this one has no `catch` at all.
 */
export const adminUsersQueryOptions = ({
  adminUserId,
  fetchPage = fetchAdminUsersPageInBrowser,
  params,
}: {
  adminUserId: AdminIdentity;
  fetchPage?: AdminUsersPageFetcher;
  params: AdminUsersParams;
}) =>
  queryOptions({
    queryFn: async ({ signal }) => await fetchPage(params, { signal }),
    queryKey: adminUsersQueryKey({ adminUserId, params }),
    retry: false,
    /** {@link RECORD_STALE_TIME} - Members are created, edited and verified by people; this window catches another administrator's edit. */
    staleTime: RECORD_STALE_TIME,
  });

/* -------------------------------------------------------------------------- */
/*                                 User search                                */
/* -------------------------------------------------------------------------- */

/** The columns a user picker needs: enough to identify a person on sight. */
export interface AdminUserOption {
  avatarColor: string;
  id: number;
  name: string;
  nameCode: string;
}

/** The signature every user picker takes, wherever the read comes from. */
export type AdminUserSearchOptions = (
  search: string,
) => Promise<AdminUserOption[]>;

/** How many matches a picker asks for. */
export const ADMIN_USER_SEARCH_LIMIT = 20;

/** The rows a picker should offer, out of the page the API returned. Pure. */
export const adminUserOptionsFrom = (
  page: Pick<AdminUsersPage, "edges">,
): AdminUserOption[] =>
  page.edges.map(({ avatarColor, id, name, nameCode }) => ({
    avatarColor,
    id,
    name,
    nameCode,
  }));

/**
 * Users matching `search`, read straight from Hono.
 *
 * Behind `users:can_view`, like the list itself - so a staff form offers only
 * the people this administrator may already see, and the permission check is the
 * route's rather than a second one here.
 *
 * An empty list rather than a throw, for the same reason the role search does
 * it: a picker is a control inside a working form, and taking the form down
 * because a lookup failed loses whatever else was chosen.
 */
export const searchAdminUsersInBrowser: AdminUserSearchOptions =
  async search => {
    try {
      const response = await fetcherClient(adminModuleRef, {
        args: { query: { first: String(ADMIN_USER_SEARCH_LIMIT), search } },
        method: "get",
        module: "admin/users",
        path: "/list",
        options: { credentials: "include" },
      });
      if (!response.ok) return [];

      return adminUserOptionsFrom(await response.json());
    } catch (error) {
      // The picker answers with an empty list, so this is the only trace.
      // eslint-disable-next-line no-console
      console.error("[admin] the user search could not be read", error);

      return [];
    }
  };
