import "@tanstack/react-start/server-only";

import type { CronParams } from "@/views/admin/views/core/advanced/cron/cron-query";

import { cronAdminModule } from "@/api/modules/admin/advanced/cron/cron.admin.module";
import {
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";
import { CRON_PREFIX_PATH } from "@/views/admin/views/core/advanced/cron/cron-query";

import { fetcher } from "../../fetcher/server";

export const fetchCronPageOnServer = async (params: CronParams) => {
  const response = await fetcher(cronAdminModule, {
    args: { query: params },
    method: "get",
    module: "cron",
    path: "/",
    prefixPath: CRON_PREFIX_PATH,
  });

  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "the cron list",
      describeAdminParams(params),
    );
  }

  return await response.json();
};
