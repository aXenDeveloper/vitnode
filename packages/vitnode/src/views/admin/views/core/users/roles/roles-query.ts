import { queryOptions } from "@tanstack/react-query";

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
  describeAdminParams,
} from "@/views/admin/admin-request";
import { normalizeAdminTableParams } from "@/views/admin/table/params";
import {
  ADMIN_ROLES_SCREEN,
  adminScopedQueryKey,
  adminScopedQueryRoot,
} from "@/views/admin/views/core/shared/admin-scope";
import { adminModuleRef } from "@/views/admin/views/core/users/list/users-query";

/**
 * Roles, as the AdminCP reads them - the list screen, and every role picker.
 *
 * Two questions, one API route:
 *
 *     /admin/core/users/roles   a paginated, searchable, sortable table
 *     role search               the first 20 matches, for a filter or a picker
 *
 * The second is why this module exists at all. The Next.js AdminCP answers it
 * with three near-identical `"use server"` actions - one for the users table's
 * role filter, one for the user detail's role dialog, one for the "move members
 * to" picker in the delete dialog - each fetching `/admin/roles/list` and
 * mapping the result its own way.
 *
 * A server action is a Next.js primitive: a TanStack Start route cannot call
 * one. Re-declaring it as a `createServerFn` would be a *second* RPC hop in
 * front of a plain authenticated `GET` - the browser posts to the app, the app
 * calls Hono - in exchange for nothing, because this read needs no server-only
 * secret and sets no cookie. So the read is a direct Hono call, the mapping is a
 * pure function, and both are stated once.
 *
 * `listRolesAdminRoute` declares no `adminStaffPermission` of its own: any
 * administrator may read it, which is what lets a role *picker* work for someone
 * who cannot open the roles *screen*. The screen's own gate is
 * `roles:can_view`, applied on the frontend and repeated below only as which
 * page is reachable.
 */

/** The columns `listRolesAdminRoute` sorts by. */
export const ADMIN_ROLES_ORDER_BY = ["id", "createdAt", "updatedAt"] as const;
export type AdminRolesOrderBy = (typeof ADMIN_ROLES_ORDER_BY)[number];

export const ADMIN_ROLES_DEFAULT_ORDER = {
  column: "updatedAt",
  order: "desc",
} as const;

/** How many matches a picker or a filter dropdown asks for. */
export const ADMIN_ROLE_SEARCH_LIMIT = 20;

export const ADMIN_ROLES_TABLE_CONTRACT: AdminTableContract<AdminRolesOrderBy> =
  {
    orderBy: ADMIN_ROLES_ORDER_BY,
    search: true,
  };

export type AdminRolesParams = AdminTableParams<AdminRolesOrderBy>;

export const normalizeAdminRolesParams = (
  raw: RawAdminTableParams = {},
): AdminRolesParams =>
  normalizeAdminTableParams(raw, ADMIN_ROLES_TABLE_CONTRACT);

/** One row of the roles table - everything the edit dialog re-opens with. */
export interface AdminRoleRow {
  allowUploadFiles: boolean;
  color: null | string;
  createdAt: Date | string;
  default: boolean;
  /** The role has a row in `core_admin_permissions`, so editing it is elevated. */
  grantsAdmin: boolean;
  guest: boolean;
  id: number;
  maxStorageForSubmit: null | number;
  name: { languageCode: string; name: string }[];
  protected: boolean;
  root: boolean;
  totalMaxStorage: null | number;
  updatedAt: Date | string;
  usersCount: number;
}

export type AdminRolesPage = AdminTablePage<AdminRoleRow>;

export type AdminRolesPageFetcher = (
  params: AdminRolesParams,
) => Promise<AdminRolesPage>;

export const fetchAdminRolesPageInBrowser: AdminRolesPageFetcher =
  async params => {
    const response = await fetcherClient(adminModuleRef, {
      args: { query: params },
      method: "get",
      module: "admin/roles",
      path: "/list",
      options: { credentials: "include" },
    });

    if (!response.ok) {
      throw new AdminRequestError(
        response.status,
        "the roles list",
        describeAdminParams(params),
      );
    }

    return await response.json();
  };

export const adminRolesQueryRoot = (adminUserId: AdminIdentity) =>
  adminScopedQueryRoot(ADMIN_ROLES_SCREEN, adminUserId);

export const adminRolesQueryKey = ({
  adminUserId,
  params,
}: {
  adminUserId: AdminIdentity;
  params: AdminRolesParams;
}) => adminScopedQueryKey(ADMIN_ROLES_SCREEN, adminUserId, "list", params);

export const adminRolesQueryOptions = ({
  adminUserId,
  fetchPage = fetchAdminRolesPageInBrowser,
  params,
}: {
  adminUserId: AdminIdentity;
  fetchPage?: AdminRolesPageFetcher;
  params: AdminRolesParams;
}) =>
  queryOptions({
    queryFn: async () => await fetchPage(params),
    queryKey: adminRolesQueryKey({ adminUserId, params }),
    retry: false,
    /** {@link RECORD_STALE_TIME} - Roles change when somebody edits them, and rarely. */
    staleTime: RECORD_STALE_TIME,
  });

/* -------------------------------------------------------------------------- */
/*                                 Role search                                */
/* -------------------------------------------------------------------------- */

/**
 * One role, as a picker or a filter needs it.
 *
 * `name` stays the raw per-language list: the server has no business deciding
 * which language the person clicking reads in, so it is resolved against the
 * active locale where it is rendered.
 */
export interface AdminRoleOption {
  color: null | string;
  id: number;
  name: { languageCode: string; name: string }[];
}

/** The signature every role picker takes, wherever the read comes from. */
export type AdminRoleSearch = (search: string) => Promise<AdminRoleOption[]>;

/**
 * The rows a search should offer, out of the page the API returned.
 *
 * The guest role is dropped, and that is not cosmetic: it is the role a request
 * has when it has *no account*, so it is never something to assign to anybody
 * and never something to filter a list of accounts by. All three of the server
 * actions this replaces wanted it gone, so it is gone once, here.
 *
 * Pure, so the rule is testable without a network.
 */
export const adminRoleOptionsFrom = (
  page: Pick<AdminRolesPage, "edges">,
): AdminRoleOption[] =>
  page.edges
    .filter(role => !role.guest)
    .map(({ color, id, name }) => ({ color, id, name }));

/**
 * Roles matching `search`, read straight from Hono.
 *
 * An empty list rather than a throw for every failure, and that is the one place
 * this layer deliberately differs from the list reads above: a picker is a
 * *control inside* a working screen. A table that renders empty on a `403` is
 * lying about the installation; a dropdown that offers nothing is telling the
 * truth about itself, and taking the whole dialog down with an error boundary
 * because a search failed would lose whatever else was typed into it.
 */
export const searchAdminRolesInBrowser: AdminRoleSearch = async search => {
  try {
    const response = await fetcherClient(adminModuleRef, {
      args: { query: { first: String(ADMIN_ROLE_SEARCH_LIMIT), search } },
      method: "get",
      module: "admin/roles",
      path: "/list",
      options: { credentials: "include" },
    });
    if (!response.ok) return [];

    return adminRoleOptionsFrom(await response.json());
  } catch (error) {
    // The picker answers with an empty list, so this is the only trace.
    // eslint-disable-next-line no-console
    console.error("[admin] the role search could not be read", error);

    return [];
  }
};
