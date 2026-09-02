import "@tanstack/react-start/server-only";

import type { AdminUsersParams } from "@/views/admin/views/core/users/list/users-query";

import { adminModule } from "@/api/modules/admin/admin.module";
import {
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";

import { fetcher } from "../../fetcher/server";

export const fetchAdminUsersPageOnServer = async (params: AdminUsersParams) => {
  const response = await fetcher(adminModule, {
    args: { query: params },
    method: "get",
    module: "admin/users",
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

export const fetchAdminUserOnServer = async (id: string) => {
  const response = await fetcher(adminModule, {
    args: { params: { id } },
    method: "get",
    module: "admin/users",
    path: "/{id}",
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "a user", `id=${id}`);
  }

  return await response.json();
};
