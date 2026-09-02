import "@tanstack/react-start/server-only";

import type { PermissionStaffType } from "@/api/lib/permission-staff";
import type { AdminStaffParams } from "@/views/admin/views/core/staff/staff-query";

import { adminModule } from "@/api/modules/admin/admin.module";
import {
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";
import { STAFF_TYPE_SEGMENT } from "@/views/admin/views/core/staff/staff-model";

import { fetcher } from "../../fetcher/server";

export const fetchAdminStaffPageOnServer = async (
  type: PermissionStaffType,
  params: AdminStaffParams,
) => {
  const response = await fetcher(adminModule, {
    args: { query: params },
    method: "get",
    module: "admin/staff",
    path: type === "admin" ? "/admins" : "/moderators",
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

export const fetchAdminStaffCatalogOnServer = async () => {
  const response = await fetcher(adminModule, {
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

export const fetchAdminStaffEntryOnServer = async (
  type: PermissionStaffType,
  id: string,
) => {
  const response = await fetcher(adminModule, {
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
