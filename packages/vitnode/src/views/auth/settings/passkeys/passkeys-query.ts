import { queryOptions } from "@tanstack/react-query";

import { CONFIG_PLUGIN } from "@/config";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";

export interface Passkey {
  backedUp: boolean;
  createdAt: Date | string;
  deviceType: "multiDevice" | "singleDevice";
  id: number;
  lastUsedAt: Date | null | string;
  name: string;
  transports: string[];
}

export interface PasskeysApi {
  passkeys: Passkey[];
}

export type PasskeysFetcher = () => Promise<PasskeysApi>;

const PASSKEYS_REQUEST_ERROR = "PasskeysRequestError";

export class PasskeysRequestError extends Error {
  constructor(status: number) {
    super(`The passkeys API answered ${status} for the current user.`);
    this.name = PASSKEYS_REQUEST_ERROR;
    this.status = status;
  }

  readonly status: number;
}

export const isPasskeysRequestError = (
  error: unknown,
): error is PasskeysRequestError =>
  error instanceof Error && error.name === PASSKEYS_REQUEST_ERROR;

export const fetchPasskeys: PasskeysFetcher = async () => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "users/passkeys",
    path: "/",
  });

  if (!response.ok) throw new PasskeysRequestError(response.status);

  return await response.json();
};

export const PASSKEYS_IDENTITY_ROOT = ["passkeys", "user"] as const;

export const passkeysQueryKey = (userId: number) =>
  [...PASSKEYS_IDENTITY_ROOT, userId] as const;

export const passkeysQueryOptions = ({ userId }: { userId: number }) =>
  queryOptions({
    queryFn: async () => await fetchPasskeys(),
    queryKey: passkeysQueryKey(userId),
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });
