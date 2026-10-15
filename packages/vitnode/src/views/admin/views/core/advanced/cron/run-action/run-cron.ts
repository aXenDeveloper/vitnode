import { fetcherClient } from "@/lib/fetcher-client";
import { manifest } from "@/manifest";

export type RunCronResult = undefined | { error?: string };

export type RunCron = (id: number) => Promise<RunCronResult>;

export const runCronInBrowser: RunCron = async id => {
  try {
    const response = await fetcherClient({
      plugin: manifest.id,
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
