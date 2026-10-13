import type { QueryClient } from "@tanstack/react-query";

import { queryOptions } from "@tanstack/react-query";

import type { ContentContainerErrorCode } from "@/content/containers/types";

import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { isAdminRequestError } from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";

import type { ContentContainerApiTarget } from "./container-request";

import { fetchContentContainers } from "./container-request";

/** `["vitnode","admin","containers"]` - every collection's cache hangs off it. */
export const ADMIN_CONTAINERS_SCREEN = "containers";

export const contentContainerQueryRoot = (definitionId: string) =>
  [...adminQueryRoot(ADMIN_CONTAINERS_SCREEN), definitionId] as const;

export const contentContainerListQueryKey = (definitionId: string) =>
  [...contentContainerQueryRoot(definitionId), "list"] as const;

/**
 * One collection's whole tree. Shared by the tree screen, the container picker
 * in content forms and the list cells that name a record's container, so one
 * read serves all three.
 */
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
    // A 403 or a 404 answers the same way the second time.
    retry: (failureCount, error) =>
      !(isAdminRequestError(error) && error.status < 500) && failureCount < 2,
    staleTime: RECORD_STALE_TIME,
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

/** The `core.containers.errors.*` key for a refused write. */
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
