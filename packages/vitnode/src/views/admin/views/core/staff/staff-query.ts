import { queryOptions } from "@tanstack/react-query";

import type {
  PermissionsStaffArgs,
  PermissionStaffType,
} from "@/api/lib/permission-staff";
import type {
  AdminTableContract,
  AdminTablePage,
  AdminTableParams,
  RawAdminTableParams,
} from "@/views/admin/table/params";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { StaffCatalog } from "@/views/admin/views/core/staff/staff-model";

import { fetcherClient } from "@/lib/fetcher-client";
import {
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";
import { normalizeAdminTableParams } from "@/views/admin/table/params";
import {
  ADMIN_STAFF_SCREEN,
  adminScopedQueryKey,
  adminScopedQueryRoot,
} from "@/views/admin/views/core/shared/admin-scope";
import { STAFF_TYPE_SEGMENT } from "@/views/admin/views/core/staff/staff-model";
import { adminModuleRef } from "@/views/admin/views/core/users/list/users-query";

/** The columns both staff lists sort by - `staffListAdminQuery`'s enum. */
export const ADMIN_STAFF_ORDER_BY = ["id", "createdAt", "updatedAt"] as const;
export type AdminStaffOrderBy = (typeof ADMIN_STAFF_ORDER_BY)[number];

export const ADMIN_STAFF_DEFAULT_ORDER = {
  column: "updatedAt",
  order: "desc",
} as const;

/** No search box: `staffListAdminQuery` declares no `search` parameter. */
export const ADMIN_STAFF_TABLE_CONTRACT: AdminTableContract<AdminStaffOrderBy> =
  {
    orderBy: ADMIN_STAFF_ORDER_BY,
  };

export type AdminStaffParams = AdminTableParams<AdminStaffOrderBy>;

export const normalizeAdminStaffParams = (
  raw: RawAdminTableParams = {},
): AdminStaffParams =>
  normalizeAdminTableParams(raw, ADMIN_STAFF_TABLE_CONTRACT);

export {
  adminStaffPermissions,
  staffPermissionModuleFor,
} from "@/views/admin/views/core/shared/admin-permissions";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";

/**
 * One page of a staff list.
 *
 * Two literal paths rather than one interpolated string, because the fetcher's
 * types are keyed on the path literal - `/admins` and `/moderators` are two
 * routes, and a template literal would infer as neither.
 */
/** A role reference as a staff row renders it. */
export interface AdminStaffRole {
  color: null | string;
  id: number;
  name: { languageCode: string; name: string }[];
}

/** One staff entry: a role *or* a user, never both. */
export interface AdminStaffRow {
  createdAt: Date | string;
  id: number;
  /** Managed by the installation - it cannot be edited or removed. */
  protected: boolean;
  role: AdminStaffRole | null;
  /**
   * This entry governs the *reading* administrator's own access - their user
   * entry, or an entry for a role they hold. Computed by the API against the
   * caller, which is why a staff list is one of the reads that must never be
   * shared between two administrators' cache partitions.
   */
  self: boolean;
  unrestricted: boolean;
  updatedAt: Date | string;
  user: null | {
    avatarColor: string;
    id: number;
    name: string;
    nameCode: string;
    role: AdminStaffRole;
  };
}

export type AdminStaffPage = AdminTablePage<AdminStaffRow>;

/**
 * How a page is actually fetched.
 *
 * The third argument is the read's cancellation, and it is optional so the SSR
 * branch - handed no signal, deliberately - satisfies this with two parameters.
 * See {@link adminStaffQueryOptions}.
 */
export type AdminStaffPageFetcher = (
  type: PermissionStaffType,
  params: AdminStaffParams,
  options?: { signal?: AbortSignal },
) => Promise<AdminStaffPage>;

/**
 * One page, fetched from the browser.
 *
 * A refusal throws, and so does an abort: `fetch` rejects before there is a
 * response, so a cancelled sort cannot arrive as an empty staff list.
 */
export const fetchAdminStaffPageInBrowser: AdminStaffPageFetcher = async (
  type,
  params,
  { signal } = {},
) => {
  const response = await fetcherClient(adminModuleRef, {
    args: { query: params },
    method: "get",
    module: "admin/staff",
    path: type === "admin" ? "/admins" : "/moderators",
    options: { signal },
  });

  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      `the ${STAFF_TYPE_SEGMENT[type]} staff list`,
      describeAdminParams(params),
    );
  }

  return await response.json();
};

export const adminStaffQueryRoot = (adminUserId: AdminIdentity) =>
  adminScopedQueryRoot(ADMIN_STAFF_SCREEN, adminUserId);

export const adminStaffQueryKey = ({
  adminUserId,
  params,
  type,
}: {
  adminUserId: AdminIdentity;
  params: AdminStaffParams;
  type: PermissionStaffType;
}) =>
  adminScopedQueryKey(ADMIN_STAFF_SCREEN, adminUserId, "list", type, params);

export const adminStaffQueryOptions = ({
  adminUserId,
  fetchPage = fetchAdminStaffPageInBrowser,
  params,
  type,
}: {
  adminUserId: AdminIdentity;
  fetchPage?: AdminStaffPageFetcher;
  params: AdminStaffParams;
  type: PermissionStaffType;
}) =>
  queryOptions({
    // Reads `signal`, which is what makes the read cancellable: re-sorting the
    // table leaves one request in flight rather than one per keystroke. Safe
    // because the fetcher throws rather than degrading - see it above.
    queryFn: async ({ signal }) => await fetchPage(type, params, { signal }),
    queryKey: adminStaffQueryKey({ adminUserId, params, type }),
    retry: false,
    /** {@link RECORD_STALE_TIME} - Staff membership changes when somebody grants or revokes it. */
    staleTime: RECORD_STALE_TIME,
  });

/* -------------------------------------------------------------------------- */
/*                            The permission catalog                          */
/* -------------------------------------------------------------------------- */

export type AdminStaffCatalogFetcher = () => Promise<StaffCatalog>;

export const fetchAdminStaffCatalogInBrowser: AdminStaffCatalogFetcher =
  async () => {
    const response = await fetcherClient(adminModuleRef, {
      method: "get",
      module: "admin/staff",
      path: "/permission-catalog",
    });

    if (!response.ok) {
      throw new AdminRequestError(
        response.status,
        "the staff permission catalog",
      );
    }

    return await response.json();
  };

/**
 * The catalog is what the *installation* declares, not what one administrator
 * may do - but it is still read with an admin session, and it names every
 * plugin installed. It is partitioned and dropped with the rest.
 */
export const adminStaffCatalogQueryKey = (adminUserId: AdminIdentity) =>
  adminScopedQueryKey(ADMIN_STAFF_SCREEN, adminUserId, "catalog");

export const adminStaffCatalogQueryOptions = ({
  adminUserId,
  fetchCatalog = fetchAdminStaffCatalogInBrowser,
}: {
  adminUserId: AdminIdentity;
  fetchCatalog?: AdminStaffCatalogFetcher;
}) =>
  queryOptions({
    queryFn: async () => await fetchCatalog(),
    queryKey: adminStaffCatalogQueryKey(adminUserId),
    retry: false,
    /** {@link RECORD_STALE_TIME} - The catalogue of grantable roles and permissions, edited by hand. */
    staleTime: RECORD_STALE_TIME,
  });

/* -------------------------------------------------------------------------- */
/*                                 One entry                                  */
/* -------------------------------------------------------------------------- */

/** A staff entry with the permissions it actually grants. */
export interface AdminStaffEntry extends AdminStaffRow {
  permissions: PermissionsStaffArgs[];
}

export type AdminStaffEntryFetcher = (
  type: PermissionStaffType,
  id: string,
) => Promise<AdminStaffEntry>;

export const fetchAdminStaffEntryInBrowser: AdminStaffEntryFetcher = async (
  type,
  id,
) => {
  const response = await fetcherClient(adminModuleRef, {
    args: { params: { id, type } },
    method: "get",
    module: "admin/staff",
    path: "/entry/{type}/{id}",
  });

  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "a staff entry",
      `type=${type}, id=${id}`,
    );
  }

  return await response.json();
};

export const adminStaffEntryQueryKey = ({
  adminUserId,
  id,
  type,
}: {
  adminUserId: AdminIdentity;
  id: string;
  type: PermissionStaffType;
}) => adminScopedQueryKey(ADMIN_STAFF_SCREEN, adminUserId, "entry", type, id);

export const adminStaffEntryQueryOptions = ({
  adminUserId,
  fetchEntry = fetchAdminStaffEntryInBrowser,
  id,
  type,
}: {
  adminUserId: AdminIdentity;
  fetchEntry?: AdminStaffEntryFetcher;
  id: string;
  type: PermissionStaffType;
}) =>
  queryOptions({
    queryFn: async () => await fetchEntry(type, id),
    queryKey: adminStaffEntryQueryKey({ adminUserId, id, type }),
    retry: false,
  });
