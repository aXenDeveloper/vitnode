import { queryOptions } from "@tanstack/react-query";

import type { UniversalFetcher } from "@/lib/fetcher-client";
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

export const adminRolesPageFetcher =
  (transport: UniversalFetcher): AdminRolesPageFetcher =>
  async params => {
    const response = await transport(adminModuleRef, {
      args: { query: params },
      method: "get",
      module: "admin/roles",
      path: "/list",
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

export const fetchAdminRolesPageInBrowser: AdminRolesPageFetcher =
  adminRolesPageFetcher(fetcherClient);

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

export interface AdminRoleOption {
  color: null | string;
  id: number;
  name: { languageCode: string; name: string }[];
}

/** The signature every role picker takes, wherever the read comes from. */
export type AdminRoleSearch = (search: string) => Promise<AdminRoleOption[]>;

export const adminRoleOptionsFrom = (
  page: Pick<AdminRolesPage, "edges">,
): AdminRoleOption[] =>
  page.edges
    .filter(role => !role.guest)
    .map(({ color, id, name }) => ({ color, id, name }));

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
