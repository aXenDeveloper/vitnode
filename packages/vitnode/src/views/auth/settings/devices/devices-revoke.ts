import { fetcherClient } from "@/lib/fetcher-client";

import type { Device } from "./devices-query";

import { usersModuleRef } from "./devices-query";

/** Signing out one device. The id is the row's own `publicId`. */
export interface RevokeDeviceArgs {
  publicId: string;
}

export interface RevokeDeviceResult {
  data?: true;
  error?: {
    status: number;
  };
}

export type RevokeDevice = (
  args: RevokeDeviceArgs,
) => Promise<RevokeDeviceResult>;

export const REVOKE_CURRENT_DEVICE_STATUS = 400;

export const isRevokableDevice = (device: Pick<Device, "isCurrent">): boolean =>
  !device.isCurrent;

const DEVICE_PUBLIC_ID = /^[A-Za-z0-9_-]{1,128}$/;

export const isDevicePublicId = (publicId: string): boolean =>
  DEVICE_PUBLIC_ID.test(publicId);

export const revokeResultFromStatus = (status: number): RevokeDeviceResult =>
  status === 200 ? { data: true } : { error: { status } };

export const revokeDeviceInBrowser: RevokeDevice = async ({ publicId }) => {
  if (!isDevicePublicId(publicId)) return { error: { status: 400 } };

  try {
    const response = await fetcherClient(usersModuleRef, {
      args: { params: { publicId } },
      method: "delete",
      module: "users",
      options: { credentials: "include" },
      path: "/devices/{publicId}",
    });

    return revokeResultFromStatus(response.status);
  } catch {
    return { error: { status: 500 } };
  }
};

export const shouldRefreshAfterRevoke = ({
  data,
  error,
}: RevokeDeviceResult): boolean => {
  if (data) return true;

  return (
    error?.status === 404 || error?.status === REVOKE_CURRENT_DEVICE_STATUS
  );
};
