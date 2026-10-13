import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { CONFIG_PLUGIN } from "@/config";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";

export interface StaffScopeResource {
  context: string[];
  id: string;
  label: string;
}

interface StaffScopeResourcePage {
  items: StaffScopeResource[];
  missing: string[];
  nextCursor: null | string;
}

const fetchScopeResources = async ({
  cursor,
  family,
  ids,
  search,
}: {
  cursor?: string;
  family: string;
  ids?: string[];
  search?: string;
}): Promise<StaffScopeResourcePage> => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: {
      params: { family },
      query: {
        cursor,
        ids: ids?.join(","),
        search: search === "" ? undefined : search,
      },
    },
    method: "get",
    module: "admin/staff",
    path: "/scope-resources/{family}",
  });
  if (!response.ok) {
    throw new AdminRequestError(response.status, "moderation scope resources");
  }

  return await response.json();
};

export const staffScopeResourcesQueryOptions = ({
  family,
  search,
}: {
  family: string;
  search: string;
}) =>
  infiniteQueryOptions({
    getNextPageParam: (page: StaffScopeResourcePage) =>
      page.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      await fetchScopeResources({ cursor: pageParam, family, search }),
    queryKey: ["vitnode", "admin", "staff", "scope", family, "list", search],
    retry: false,
    staleTime: 30_000,
  });

export const staffScopeSelectionQueryOptions = ({
  family,
  ids,
}: {
  family: string;
  ids: string[];
}) =>
  queryOptions({
    enabled: ids.length > 0,
    queryFn: async () => await fetchScopeResources({ family, ids }),
    queryKey: [
      "vitnode",
      "admin",
      "staff",
      "scope",
      family,
      "selection",
      [...ids].sort().join(","),
    ],
    retry: false,
    staleTime: 30_000,
  });
