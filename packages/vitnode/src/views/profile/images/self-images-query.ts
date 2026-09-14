import { queryOptions } from "@tanstack/react-query";

import type { UserImageKind, UserImagePolicy } from "@/lib/user-images";

import { CONFIG_PLUGIN } from "@/config";
import { fetcherClient } from "@/lib/fetcher-client";
import { OPERATIONAL_STALE_TIME } from "@/lib/query-freshness";
import { readApiErrorMessage } from "@/lib/read-api-error";
import { fetcher } from "@/tanstack/fetcher";

import { PROFILE_QUERY_ROOT } from "../profile-query";

export type UserImagePolicyFetcher = () => Promise<UserImagePolicy>;

export const fetchUserImagePolicy: UserImagePolicyFetcher = async () => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "users/images",
    path: "/policy",
  });

  if (!response.ok) {
    throw new Error(`The image policy route answered ${response.status}.`);
  }

  return await response.json();
};

export const userImagePolicyQueryKey = () =>
  [...PROFILE_QUERY_ROOT, "images", "policy"] as const;

export const userImagePolicyQueryOptions = ({
  fetchPolicy = fetchUserImagePolicy,
}: { fetchPolicy?: UserImagePolicyFetcher } = {}) =>
  queryOptions({
    queryFn: async () => await fetchPolicy(),
    queryKey: userImagePolicyQueryKey(),
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

export class UserImageRequestError extends Error {
  constructor(status: number, message: string) {
    super(message);
    this.name = "UserImageRequestError";
    this.status = status;
  }

  readonly status: number;
}

const rejectionOf = async (
  response: Response,
  fallback: string,
): Promise<UserImageRequestError> =>
  new UserImageRequestError(
    response.status,
    (await readApiErrorMessage(response)) ?? fallback,
  );

export const uploadOwnUserImage = async (
  kind: UserImageKind,
  file: File,
): Promise<{ url: string }> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetcherClient({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { params: { kind } },
    formData,
    method: "post",
    module: "users/images",
    path: "/{kind}",
  });

  if (!response.ok) {
    throw await rejectionOf(
      response,
      `The upload answered ${response.status}.`,
    );
  }

  return await response.json();
};

export const removeOwnUserImage = async (
  kind: UserImageKind,
): Promise<void> => {
  const response = await fetcherClient({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { params: { kind } },
    method: "delete",
    module: "users/images",
    path: "/{kind}",
  });

  if (!response.ok) {
    throw await rejectionOf(
      response,
      `The removal answered ${response.status}.`,
    );
  }
};
