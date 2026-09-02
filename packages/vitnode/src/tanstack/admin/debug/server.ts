import "@tanstack/react-start/server-only";

import type { DebugLogsParams } from "@/views/admin/views/core/debug/debug-query";

import { debugAdminModule } from "@/api/modules/admin/debug/debug.admin.module";
import {
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";
import { DEBUG_PREFIX_PATH } from "@/views/admin/views/core/debug/debug-query";

import { fetcher } from "../../fetcher/server";

export const fetchDebugLogsPageOnServer = async (params: DebugLogsParams) => {
  const response = await fetcher(debugAdminModule, {
    args: { query: params },
    method: "get",
    module: "debug",
    path: "/logs",
    prefixPath: DEBUG_PREFIX_PATH,
  });

  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "the system log",
      describeAdminParams(params),
    );
  }

  return await response.json();
};

export const fetchDebugQueueOnServer = async () => {
  const response = await fetcher(debugAdminModule, {
    method: "get",
    module: "debug",
    path: "/queue",
    prefixPath: DEBUG_PREFIX_PATH,
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the queue snapshot");
  }

  return await response.json();
};
