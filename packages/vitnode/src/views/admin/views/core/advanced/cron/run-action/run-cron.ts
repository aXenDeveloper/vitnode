import { fetcherClient } from "@/lib/fetcher-client";
import { CRON_PREFIX_PATH } from "@/views/admin/views/core/advanced/cron/cron-query";

import { cronAdminModuleRef } from "../cron-query";

export type RunCronResult = undefined | { error?: string };

export type RunCron = (id: number) => Promise<RunCronResult>;

export const runCronInBrowser: RunCron = async id => {
  try {
    const response = await fetcherClient(cronAdminModuleRef, {
      args: { params: { id: String(id) } },
      method: "post",
      module: "cron",
      options: { credentials: "include" },
      path: "/{id}",
      prefixPath: CRON_PREFIX_PATH,
    });

    if (!response.ok) return { error: "Failed to run cron job" };

    return undefined;
  } catch {
    return { error: "Failed to run cron job" };
  }
};
