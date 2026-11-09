import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import type { RichTextDocument } from "@/content/rich-text/document";
import type { WarningMessage } from "@/lib/moderation/warnings";

import { fetcherClient } from "@/lib/fetcher-client";
import { manifest } from "@/manifest";
import { fetcher } from "@/tanstack/fetcher";

import { ModcpRequestError } from "../modcp/modcp-query";

export const WARNINGS_QUERY_ROOT = [
  "vitnode",
  "moderation",
  "warnings",
] as const;

/** Every query that shows points, warnings or sanctions - invalidate after a write. */
export const ACCOUNT_STATUS_QUERY_KEY = [
  "vitnode",
  "moderation",
  "account-status",
] as const;

const fetchWarningReasons = async () => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "moderation",
    path: "/warnings/reasons",
  });
  if (!response.ok) {
    throw new ModcpRequestError(response.status, "warning reasons");
  }

  return (await response.json()).reasons;
};

export type ModcpWarningReason = Awaited<
  ReturnType<typeof fetchWarningReasons>
>[number];

export const warningReasonsQueryOptions = () =>
  queryOptions({
    queryFn: fetchWarningReasons,
    queryKey: [...WARNINGS_QUERY_ROOT, "reasons"],
    retry: false,
    staleTime: 60_000,
  });

const fetchMemberStanding = async (userId: number) => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { params: { id: userId } },
    method: "get",
    module: "moderation",
    path: "/members/{id}",
  });
  if (!response.ok) {
    throw new ModcpRequestError(response.status, "the member's standing");
  }

  return await response.json();
};

export type ModcpMemberStanding = Awaited<
  ReturnType<typeof fetchMemberStanding>
>;

export type ModcpStaffWarning = ModcpMemberStanding["warnings"][number];

export type ModcpSanction = NonNullable<
  ModcpMemberStanding["sanctions"]
>[number];

export const memberStandingQueryOptions = (userId: number) =>
  queryOptions({
    queryFn: async () => await fetchMemberStanding(userId),
    queryKey: [...WARNINGS_QUERY_ROOT, "member", userId],
    retry: false,
    staleTime: 10_000,
  });

export interface ModcpWarningsFilter {
  issuedById?: number;
  page: number;
  pageSize: number;
  pluginId?: string;
  reasonId?: number;
  status: "active" | "all" | "expired" | "revoked";
  userId?: number;
}

const fetchWarnings = async (filter: ModcpWarningsFilter) => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { query: filter },
    method: "get",
    module: "moderation",
    path: "/warnings",
  });
  if (!response.ok) throw new ModcpRequestError(response.status, "warnings");

  return await response.json();
};

export type ModcpWarningsPage = Awaited<ReturnType<typeof fetchWarnings>>;

export const warningsListQueryOptions = (filter: ModcpWarningsFilter) =>
  queryOptions({
    placeholderData: keepPreviousData,
    queryFn: async () => await fetchWarnings(filter),
    queryKey: [...WARNINGS_QUERY_ROOT, "list", filter],
    retry: false,
    staleTime: 10_000,
  });

const fetchMembers = async (search: string) => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { query: { search } },
    method: "get",
    module: "moderation",
    path: "/members",
  });
  if (!response.ok) throw new ModcpRequestError(response.status, "members");

  return (await response.json()).items;
};

export const memberSearchQueryOptions = (search: string) => {
  const term = search.trim();

  return queryOptions({
    enabled: term.length > 0,
    placeholderData: keepPreviousData,
    queryFn: async () => await fetchMembers(term),
    queryKey: [...WARNINGS_QUERY_ROOT, "members", term],
    retry: false,
    staleTime: 30_000,
  });
};

const fetchAccountStatus = async () => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "moderation",
    path: "/account-status",
  });
  const { status } = response;
  if (!response.ok) {
    if (status === 401) return null;
    throw new ModcpRequestError(status, "the account status");
  }

  return await response.json();
};

export type AccountStatus = NonNullable<
  Awaited<ReturnType<typeof fetchAccountStatus>>
>;

export const accountStatusQueryOptions = () =>
  queryOptions({
    queryFn: fetchAccountStatus,
    queryKey: ACCOUNT_STATUS_QUERY_KEY,
    retry: false,
    staleTime: 10_000,
  });

export interface AccountStatusHistoryParams {
  kind?: string;
  order: "asc" | "desc";
  orderBy: "issuedAt" | "points";
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
}

const fetchAccountStatusHistory = async (
  params: AccountStatusHistoryParams,
) => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { query: params },
    method: "get",
    module: "moderation",
    path: "/account-status/history",
  });
  if (!response.ok) {
    throw new ModcpRequestError(response.status, "the account history");
  }

  return await response.json();
};

export type AccountStatusHistory = Awaited<
  ReturnType<typeof fetchAccountStatusHistory>
>;

export const accountStatusHistoryQueryOptions = (
  params: AccountStatusHistoryParams,
) =>
  queryOptions({
    placeholderData: keepPreviousData,
    queryFn: async () => await fetchAccountStatusHistory(params),
    queryKey: [...ACCOUNT_STATUS_QUERY_KEY, "history", params],
    retry: false,
    staleTime: 10_000,
  });

const WARNING_FAILURES = [
  "already_revoked",
  "author_mismatch",
  "content_not_found",
  "expiration_override_forbidden",
  "forbidden",
  "idempotency_conflict",
  "invalid_expiration",
  "invalid_points",
  "not_found",
  "override_note_required",
  "points_override_forbidden",
  "protected",
  "reason_disabled",
  "reason_not_found",
  "report_closed",
  "report_mismatch",
  "self",
  "user_not_found",
  "conflict",
] as const;

export type WarningFailure =
  | "unauthenticated"
  | "unknown"
  | "validation"
  | (typeof WARNING_FAILURES)[number];

export type WarningResult<T> =
  | { data: T; ok: true }
  | { failure: WarningFailure; ok: false };

const failureOf = async (response: Response): Promise<WarningFailure> => {
  const body = (await response.json().catch(() => null)) as null | {
    error?: unknown;
  };
  const reported = WARNING_FAILURES.find(failure => failure === body?.error);
  if (reported) return reported;
  if (response.status === 400) return "validation";
  if (response.status === 401) return "unauthenticated";
  if (response.status === 403) return "forbidden";
  if (response.status === 404) return "not_found";

  return "unknown";
};

type SuccessBody<R> = R extends { json: () => Promise<infer T>; ok: true }
  ? T
  : never;

const settle = async <R extends Response>(
  request: () => Promise<R>,
): Promise<WarningResult<SuccessBody<R>>> => {
  try {
    const response = await request();
    if (!response.ok) return { failure: await failureOf(response), ok: false };

    return { data: (await response.json()) as SuccessBody<R>, ok: true };
  } catch {
    return { failure: "unknown", ok: false };
  }
};

type SettledData<
  F extends (...args: never[]) => Promise<WarningResult<unknown>>,
> = Extract<Awaited<ReturnType<F>>, { ok: true }>["data"];

export type WarningExpirationInput =
  | { at: string; mode: "at" }
  | { hours: number; mode: "hours" }
  | { mode: "default" }
  | { mode: "never" };

export interface WarningDraft {
  content?: null | { pluginId: string; targetId: string; targetType: string };
  expiration: WarningExpirationInput;
  points?: null | number;
  reasonId: null | number;
  reportId?: null | number;
  userId: number;
}

export const previewWarning = async (draft: WarningDraft) =>
  await settle(
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body: draft },
        method: "post",
        module: "moderation",
        path: "/warnings/preview",
      }),
  );

export type WarningPreview = SettledData<typeof previewWarning>;

export interface IssueWarningInput extends WarningDraft {
  idempotencyKey: string;
  message: WarningMessage;
  overrideNote?: null | string;
  resolveReport: boolean;
  staffNote: null | RichTextDocument;
}

export const issueWarning = async (input: IssueWarningInput) =>
  await settle(
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body: input },
        method: "post",
        module: "moderation",
        path: "/warnings",
      }),
  );

export type IssuedWarning = SettledData<typeof issueWarning>;

export const revokeWarning = async ({
  id,
  reason,
}: {
  id: number;
  reason: string;
}) =>
  await settle(
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body: { reason }, params: { id } },
        method: "post",
        module: "moderation",
        path: "/warnings/{id}/revoke",
      }),
  );

export const revokeSanction = async ({
  id,
  reason,
}: {
  id: number;
  reason: string;
}) =>
  await settle(
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body: { reason }, params: { id } },
        method: "post",
        module: "moderation",
        path: "/sanctions/{id}/revoke",
      }),
  );
