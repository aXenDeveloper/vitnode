import { queryOptions } from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";
import {
  ADMIN_REACTIONS_SCREEN,
  adminScopedQueryKey,
  adminScopedQueryRoot,
} from "@/views/admin/views/core/shared/admin-scope";

const fetchAdminReactions = async () => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "admin/reactions",
    path: "/",
  });
  if (!response.ok) {
    throw new AdminRequestError(response.status, "the reactions");
  }

  return (await response.json()).reactions;
};

export type AdminReaction = Awaited<
  ReturnType<typeof fetchAdminReactions>
>[number];

export const adminReactionsQueryRoot = (adminUserId: AdminIdentity) =>
  adminScopedQueryRoot(ADMIN_REACTIONS_SCREEN, adminUserId);

export const adminReactionsQueryOptions = (adminUserId: AdminIdentity) =>
  queryOptions({
    queryFn: fetchAdminReactions,
    queryKey: adminScopedQueryKey(ADMIN_REACTIONS_SCREEN, adminUserId),
    staleTime: RECORD_STALE_TIME,
  });

const fetchRoleReactions = async (roleId: number) => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "admin/reactions",
    path: "/roles/{roleId}",
    args: { params: { roleId } },
  });
  if (!response.ok) {
    throw new AdminRequestError(response.status, "the role's reactions");
  }

  return await response.json();
};

/** A role's reaction settings; role id `0` reads a new role's defaults. */
export type AdminRoleReactions = Awaited<ReturnType<typeof fetchRoleReactions>>;

export const adminRoleReactionsQueryOptions = (
  adminUserId: AdminIdentity,
  roleId: null | number,
) =>
  queryOptions({
    queryFn: async () => await fetchRoleReactions(roleId ?? 0),
    queryKey: [
      ...adminScopedQueryRoot(ADMIN_REACTIONS_SCREEN, adminUserId),
      "role",
      roleId ?? 0,
    ],
    staleTime: RECORD_STALE_TIME,
  });

const fetchRoleOptions = async () => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "admin/roles",
    path: "/list",
    args: { query: { first: "100" } },
  });
  if (!response.ok) {
    throw new AdminRequestError(response.status, "the roles");
  }

  return (await response.json()).edges;
};

/** Every role, for the per-role limits of a reaction. */
export const adminReactionRolesQueryOptions = (adminUserId: AdminIdentity) =>
  queryOptions({
    queryFn: fetchRoleOptions,
    queryKey: [
      ...adminScopedQueryRoot(ADMIN_REACTIONS_SCREEN, adminUserId),
      "roles",
    ],
    staleTime: RECORD_STALE_TIME,
  });
