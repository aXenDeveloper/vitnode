import "@tanstack/react-start/server-only";

import { debugAdminModule } from "@/api/modules/admin/debug/debug.admin.module";
import { AdminRequestError } from "@/views/admin/admin-request";
import { ADMIN_DEBUG_PREFIX_PATH } from "@/views/admin/views/core/system/integrations/integrations-query";

import { fetcher } from "../../fetcher/server";

export const fetchIntegrationsOnServer = async () => {
  const response = await fetcher(debugAdminModule, {
    method: "get",
    module: "debug",
    path: "/integrations",
    prefixPath: ADMIN_DEBUG_PREFIX_PATH,
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the integrations board");
  }

  return await response.json();
};
