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

/** One role, with every translation of its name - resolved where it is rendered. */
export interface AdminUserRole {
  color: null | string;
  id: number;
  name: { languageCode: string; name: string }[];
}

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

export type AdminUsersPageFetcher = (
  params: AdminUsersParams,
  options?: { signal?: AbortSignal },
) => Promise<AdminUsersPage>;

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

export const adminUsersQueryRoot = (adminUserId: AdminIdentity) =>
  adminScopedQueryRoot(ADMIN_USERS_SCREEN, adminUserId);

export const adminUsersQueryKey = ({
  adminUserId,
  params,
}: {
  adminUserId: AdminIdentity;
  params: AdminUsersParams;
}) => adminScopedQueryKey(ADMIN_USERS_SCREEN, adminUserId, "list", params);

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
