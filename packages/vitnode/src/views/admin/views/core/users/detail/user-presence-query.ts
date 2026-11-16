import type { UserPresence } from "@vitnode/api/lib/user-presence";

import { queryOptions } from "@tanstack/react-query";
import { PRESENCE_HEARTBEAT_INTERVAL_MS } from "@vitnode/api/lib/user-presence";
import { manifest } from "@vitnode/api/manifest";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { OPERATIONAL_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";

import { adminUserQueryKey } from "./user-query";

export const fetchAdminUserPresence = async (
  userId: number,
): Promise<UserPresence> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { params: { id: String(userId) } },
    method: "get",
    module: "admin/users",
    path: "/{id}/presence",
  });
  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "a user's presence",
      `id=${userId}`,
    );
  }

  return await response.json();
};

export const adminUserPresenceQueryOptions = ({
  adminUserId,
  userId,
}: {
  adminUserId: AdminIdentity;
  userId: number;
}) =>
  queryOptions({
    queryFn: async () => await fetchAdminUserPresence(userId),
    queryKey: [
      ...adminUserQueryKey({ adminUserId, id: String(userId) }),
      "presence",
    ],
    refetchInterval: PRESENCE_HEARTBEAT_INTERVAL_MS,
    refetchIntervalInBackground: false,
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });
