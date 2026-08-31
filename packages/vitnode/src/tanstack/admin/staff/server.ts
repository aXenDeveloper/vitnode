import "@tanstack/react-start/server-only";

import type { PermissionStaffType } from "@/api/lib/permission-staff";
import type {
  AdminStaffCatalogFetcher,
  AdminStaffEntryFetcher,
  AdminStaffPageFetcher,
  AdminStaffParams,
} from "@/views/admin/views/core/staff/staff-query";

import {
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";
import { STAFF_TYPE_SEGMENT } from "@/views/admin/views/core/staff/staff-model";
import {
  adminStaffCatalogRequest,
  adminStaffEntryRequest,
  adminStaffRequest,
} from "@/views/admin/views/core/staff/staff-query";
import { adminModuleRef } from "@/views/admin/views/core/users/list/users-query";

import { fetcherServer } from "../../fetcher/server";

/**
 * The three staff reads, during SSR.
 *
 * The requests and the refusal checks are the shared ones; only the transport is
 * this module's. `fetcherServer` forwards the admin cookie the page request
 * arrived with, which is what makes these answerable at all - `/admin/staff/*`
 * is behind `globalAdminMiddleware` and every handler re-checks the staff
 * tables.
 *
 * Only ever reached through the isomorphic transports in `./query`.
 */

export const fetchAdminStaffPageOnServer: AdminStaffPageFetcher = async (
  type: PermissionStaffType,
  params: AdminStaffParams,
) => {
  const response = await fetcherServer(
    adminModuleRef,
    adminStaffRequest(type, params),
  );

  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      `the ${STAFF_TYPE_SEGMENT[type]} staff list`,
      describeAdminParams(params),
    );
  }

  return await response.json();
};

export const fetchAdminStaffCatalogOnServer: AdminStaffCatalogFetcher =
  async () => {
    const response = await fetcherServer(
      adminModuleRef,
      adminStaffCatalogRequest(),
    );

    if (!response.ok) {
      throw new AdminRequestError(
        response.status,
        "the staff permission catalog",
      );
    }

    return await response.json();
  };

export const fetchAdminStaffEntryOnServer: AdminStaffEntryFetcher = async (
  type: PermissionStaffType,
  id: string,
) => {
  const response = await fetcherServer(
    adminModuleRef,
    adminStaffEntryRequest(type, id),
  );

  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "a staff entry",
      `type=${type}, id=${id}`,
    );
  }

  return await response.json();
};
