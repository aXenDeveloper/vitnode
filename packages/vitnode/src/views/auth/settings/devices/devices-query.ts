import { queryOptions } from "@tanstack/react-query";

import type { usersModule } from "@/api/modules/users/users.module";

import { CONFIG_PLUGIN } from "@/config";
import { clientModule, fetcherClient } from "@/lib/fetcher-client";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";

export const usersModuleRef = clientModule<typeof usersModule>(
  CONFIG_PLUGIN.pluginId,
);

/** Which icon a row gets, and the only three values the API will send. */
export const DEVICE_TYPES = ["desktop", "tablet", "mobile"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export interface Device {
  browser: string;
  deviceType: DeviceType;
  expiresAt: Date | string;
  ipAddress: string;

  isCurrent: boolean;
  lastSeen: Date | string;
  os: string;
  publicId: string;
}

/** The list route's whole response. */
export interface DevicesApi {
  devices: Device[];
}

/** How the list is actually fetched. See {@link devicesQueryOptions}. */
export type DevicesFetcher = () => Promise<DevicesApi>;

/** The `name` every {@link DevicesRequestError} carries. See below. */
const DEVICES_REQUEST_ERROR = "DevicesRequestError";

export class DevicesRequestError extends Error {
  constructor(status: number) {
    super(`The devices API answered ${status} for the current user's devices.`);
    this.name = DEVICES_REQUEST_ERROR;
    this.status = status;
  }

  readonly status: number;
}

export const isDevicesRequestError = (
  error: unknown,
): error is DevicesRequestError =>
  error instanceof Error && error.name === DEVICES_REQUEST_ERROR;

export const fetchDevicesInBrowser: DevicesFetcher = async () => {
  const response = await fetcherClient(usersModuleRef, {
    method: "get",
    module: "users",
    path: "/devices",
  });

  if (!response.ok) throw new DevicesRequestError(response.status);

  return await response.json();
};

export const DEVICES_IDENTITY_ROOT = ["devices", "user"] as const;

export const devicesQueryKey = (userId: number) =>
  [...DEVICES_IDENTITY_ROOT, userId] as const;

export const devicesQueryOptions = ({
  fetchDevices = fetchDevicesInBrowser,
  userId,
}: {
  fetchDevices?: DevicesFetcher;
  userId: number;
}) =>
  queryOptions({
    // `userId` is deliberately absent from the request: the owner comes from
    // the session cookie, on the server, on every call.
    queryFn: async () => await fetchDevices(),
    queryKey: devicesQueryKey(userId),
    retry: false,
    /** {@link RECORD_STALE_TIME} - A sign-in on another device adds a row this screen would otherwise never show. */
    staleTime: RECORD_STALE_TIME,
  });

export type DevicesQueryOptions = ReturnType<typeof devicesQueryOptions>;
