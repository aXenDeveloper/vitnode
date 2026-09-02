import "@tanstack/react-start/server-only";

import type { AdminRolesParams } from "@/views/admin/views/core/users/roles/roles-query";

import { adminModule } from "@/api/modules/admin/admin.module";
import {
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";

import { fetcher } from "../../fetcher/server";

export const fetchAdminRolesPageOnServer = async (params: AdminRolesParams) => {
  const response = await fetcher(adminModule, {
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
