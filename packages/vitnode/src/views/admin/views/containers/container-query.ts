import type { QueryClient } from "@tanstack/react-query";

import { queryOptions } from "@tanstack/react-query";

import type { ContentContainerErrorCode } from "@/content/containers/types";

import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { isAdminRequestError } from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";

import type { ContentContainerApiTarget } from "./container-request";

import {
  fetchContentContainerPolicies,
  fetchContentContainers,
} from "./container-request";

export const contentContainerQueryRoot = (definitionId: string) =>
  [...adminQueryRoot("containers"), definitionId] as const;

export const contentContainerListQueryKey = (definitionId: string) =>
  [...contentContainerQueryRoot(definitionId), "list"] as const;

export const contentContainerListQuery = ({
  definitionId,
  target,
}: {
  definitionId: string;
  target: ContentContainerApiTarget;
}) =>
  queryOptions({
    queryFn: async ({ signal }) =>
      await fetchContentContainers(target, { signal }),
    queryKey: contentContainerListQueryKey(definitionId),
    retry: (failureCount, error) =>
      !(isAdminRequestError(error) && error.status < 500) && failureCount < 2,
    staleTime: RECORD_STALE_TIME,
  });

export const contentContainerPoliciesQuery = ({
  definitionId,
  id,
  target,
}: {
  definitionId: string;
  id: number;
  target: ContentContainerApiTarget;
}) =>
  queryOptions({
    queryFn: async ({ signal }) =>
      await fetchContentContainerPolicies(target, id, { signal }),
    queryKey: [...contentContainerQueryRoot(definitionId), "policies", id],
    refetchOnWindowFocus: false,
    retry: (failureCount, error) =>
      !(isAdminRequestError(error) && error.status < 500) && failureCount < 2,
    staleTime: 0,
  });

export const invalidateContentContainers = async (
  queryClient: QueryClient,
  definitionId: string,
): Promise<void> => {
  await queryClient.invalidateQueries({
    queryKey: contentContainerQueryRoot(definitionId),
  });
};

export type ContentContainerErrorKey =
  `errors.${"forbidden" | "unknown" | ContentContainerErrorCode}`;

export const contentContainerErrorKey = ({
  code,
  status,
}: {
  code?: ContentContainerErrorCode;
  status: number;
}): ContentContainerErrorKey => {
  if (code !== undefined) return `errors.${code}`;
  if (status === 403) return "errors.forbidden";
  if (status === 404) return "errors.notFound";

  return "errors.unknown";
};
