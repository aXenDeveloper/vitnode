import { CONFIG_PLUGIN } from "@/config";
import { fetcherClient } from "@/lib/fetcher-client";

export interface UpdateTimeZoneResult {
  data?: true;
  error?: { status: number };
}

export type UpdateTimeZone = (
  timeZone: null | string,
) => Promise<UpdateTimeZoneResult>;

export const updateTimeZoneInBrowser: UpdateTimeZone = async timeZone => {
  try {
    const response = await fetcherClient({
      plugin: CONFIG_PLUGIN.pluginId,
      args: { body: { timeZone } },
      method: "put",
      module: "users",
      options: { credentials: "include" },
      path: "/me/time-zone",
    });

    return response.ok
      ? { data: true }
      : { error: { status: response.status } };
  } catch {
    return { error: { status: 500 } };
  }
};

export const supportedTimeZones = (): string[] => {
  try {
    const zones = Intl.supportedValuesOf("timeZone");

    return zones.includes("UTC") ? zones : ["UTC", ...zones];
  } catch {
    return ["UTC"];
  }
};

export const deviceTimeZone = (): null | string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }
};
