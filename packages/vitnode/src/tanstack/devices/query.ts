import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import type { DevicesFetcher } from "@/views/auth/settings/devices/devices-query";
import type {
  RevokeDevice,
  RevokeDeviceArgs,
  RevokeDeviceResult,
} from "@/views/auth/settings/devices/devices-revoke";

import { fetcher } from "@/tanstack/fetcher";
import {
  devicesFetcher,
  devicesQueryKey,
  devicesQueryOptions,
} from "@/views/auth/settings/devices/devices-query";
import {
  revokeDeviceInBrowser,
  shouldRefreshAfterRevoke,
} from "@/views/auth/settings/devices/devices-revoke";

const fetchDevices: DevicesFetcher = devicesFetcher(fetcher);

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
