import { queryOptions } from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";

import type {
  AdminTableContract,
  AdminTableParams,
} from "@/views/admin/table/params";

import { OPERATIONAL_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";
import {
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";

export const ACCOUNT_DELETION_STATUSES = [
  "failed",
  "pending",
  "completed",
  "cancelled",
] as const;

export type AccountDeletionStatus = (typeof ACCOUNT_DELETION_STATUSES)[number];

export type AccountDeletionsOrderBy = "createdAt" | "scheduledAt";

export const ACCOUNT_DELETIONS_TABLE_CONTRACT: AdminTableContract<AccountDeletionsOrderBy> =
  {
    orderBy: ["createdAt", "scheduledAt"],
    search: true,
    status: ACCOUNT_DELETION_STATUSES,
  };

export type AccountDeletionsParams = AdminTableParams<AccountDeletionsOrderBy>;

export const fetchAccountDeletionsPage = async (
  params: AccountDeletionsParams,
) => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { query: params },
    method: "get",
    module: "admin/users",
    path: "/account-deletions",
  });

  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "the account deletions list",
      describeAdminParams(params),
    );
  }

  return await response.json();
};

export type AccountDeletionsPage = Awaited<
  ReturnType<typeof fetchAccountDeletionsPage>
>;

export type AccountDeletion = AccountDeletionsPage["edges"][number];

export const fetchAccountDeletionsSummary = async () => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "admin/users",
    path: "/account-deletions/summary",
  });

  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "the account deletions summary",
    );
  }

  return await response.json();
};

export type AccountDeletionsSummary = Awaited<
  ReturnType<typeof fetchAccountDeletionsSummary>
>;

/** Everything about account deletions in the AdminCP: invalidate it after a write. */
export const ACCOUNT_DELETIONS_QUERY_ROOT = [
  "admin",
  "account-deletions",
] as const;

export const accountDeletionsQueryOptions = ({
  params,
}: {
  params: AccountDeletionsParams;
}) =>
  queryOptions({
    queryFn: async () => await fetchAccountDeletionsPage(params),
    queryKey: [...ACCOUNT_DELETIONS_QUERY_ROOT, "list", params],
    retry: false,
    /** {@link OPERATIONAL_STALE_TIME} - The hourly job and members move requests on their own. */
    staleTime: OPERATIONAL_STALE_TIME,
  });

export const accountDeletionsSummaryQueryOptions = () =>
  queryOptions({
    queryFn: fetchAccountDeletionsSummary,
    queryKey: [...ACCOUNT_DELETIONS_QUERY_ROOT, "summary"],
    retry: false,
    /** {@link OPERATIONAL_STALE_TIME} - Feeds the Debug Panel's health, like the other sources. */
    staleTime: OPERATIONAL_STALE_TIME,
  });

/** Whole days since `date`, for the one-month GDPR clock. */
export const daysSince = (date: Date | string, now = Date.now()): number =>
  Math.max(0, Math.floor((now - new Date(date).getTime()) / 86_400_000));
