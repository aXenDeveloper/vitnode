import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import React from "react";

import type { DevicesFetcher } from "@/views/auth/settings/devices/devices-query";
import type {
  RevokeDevice,
  RevokeDeviceArgs,
  RevokeDeviceResult,
} from "@/views/auth/settings/devices/devices-revoke";

import {
  devicesQueryKey,
  devicesQueryOptions,
  fetchDevicesInBrowser,
} from "@/views/auth/settings/devices/devices-query";
import {
  revokeDeviceInBrowser,
  shouldRefreshAfterRevoke,
} from "@/views/auth/settings/devices/devices-revoke";

import { fetchDevicesOnServer } from "./server";

const fetchDevices: DevicesFetcher = createIsomorphicFn()
  .server(fetchDevicesOnServer)
  .client(fetchDevicesInBrowser);

export const devicesQuery = (userId: number) =>
  devicesQueryOptions({ fetchDevices, userId });

export const invalidateDevices = async (
  queryClient: QueryClient,
  userId: number,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: devicesQueryKey(userId) });

export const revokeDevice = async (
  queryClient: QueryClient,
  userId: number,
  args: RevokeDeviceArgs,
): Promise<RevokeDeviceResult> => {
  const result = await revokeDeviceInBrowser(args);

  if (shouldRefreshAfterRevoke(result)) {
    await invalidateDevices(queryClient, userId);
  }

  return result;
};

export const useRevokeDeviceCallback = (userId: number): RevokeDevice => {
  const queryClient = useQueryClient();

  return React.useMemo(
    () => async (args: RevokeDeviceArgs) =>
      await revokeDevice(queryClient, userId, args),
    [queryClient, userId],
  );
};
