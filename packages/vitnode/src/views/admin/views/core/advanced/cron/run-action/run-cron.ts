import { CONFIG_PLUGIN } from "@/config";
import { fetcherClient } from "@/lib/fetcher-client";

export type RunCronResult = undefined | { error?: string };

export type RunCron = (id: number) => Promise<RunCronResult>;

export const runCronInBrowser: RunCron = async id => {
  try {
    const response = await fetcherClient({
      plugin: CONFIG_PLUGIN.pluginId,
      args: { params: { id: String(id) } },
      method: "post",
      module: "admin/advanced/cron",
      options: { credentials: "include" },
      path: "/{id}",
    });

    if (!response.ok) return { error: "Failed to run cron job" };

    return undefined;
  } catch {
    return { error: "Failed to run cron job" };
  }
};
