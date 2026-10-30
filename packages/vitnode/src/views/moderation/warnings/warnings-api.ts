import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
} from "@tanstack/react-query";

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

const fetchMemberLog = async (userId: number, cursor: null | string) => {
  const response = await fetcher({
    plugin: manifest.id,
    args: {
      params: { id: userId },
      query: cursor ? { cursor } : {},
    },
    method: "get",
    module: "moderation",
    path: "/members/{id}/log",
  });
  if (!response.ok) {
    throw new ModcpRequestError(response.status, "the member's log");
  }

  return await response.json();
};

export type ModcpMemberLogEntry = Awaited<
  ReturnType<typeof fetchMemberLog>
>["edges"][number];

export const memberLogQueryOptions = (userId: number) =>
  infiniteQueryOptions({
    getNextPageParam: (last: Awaited<ReturnType<typeof fetchMemberLog>>) =>
      last.pageInfo.hasNextPage ? last.pageInfo.endCursor : undefined,
    initialPageParam: null as null | string,
    queryFn: async ({ pageParam }) => await fetchMemberLog(userId, pageParam),
    queryKey: [...WARNINGS_QUERY_ROOT, "member-log", userId],
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

export const memberSearchQueryOptions = (search: string) =>
  queryOptions({
    enabled: search.trim().length > 0,
    placeholderData: keepPreviousData,
    queryFn: async () => await fetchMembers(search.trim()),
    queryKey: [...WARNINGS_QUERY_ROOT, "members", search.trim()],
    retry: false,
    staleTime: 30_000,
  });

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

const settle = async <T>(
  request: () => Promise<Response>,
): Promise<WarningResult<T>> => {
  try {
    const response = await request();
    if (!response.ok) return { failure: await failureOf(response), ok: false };

    return { data: (await response.json()) as T, ok: true };
  } catch {
    return { failure: "unknown", ok: false };
  }
};

const options = { credentials: "include" } as const;

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

/** What `POST /moderation/warnings/preview` answers. */
export interface WarningPreview {
  defaults: { expiresAfterHours: null | number; points: number };
  expiresAt: null | string;
  overrides: { expiration: boolean; points: boolean };
  permissions: {
    overrideExpiration: boolean;
    overridePoints: boolean;
    resolveReport: boolean;
    viewWarnings: boolean;
  };
  points: { current: number; projected: number; warning: number };
  related: ModcpStaffWarning[];
  sanction: null | {
    action: "suspend_indefinite" | "suspend_temporary";
    durationHours: null | number;
    endsAt: null | string;
    points: number;
    thresholdId: number;
  };
  suspendedUntil: null | { endsAt: null | string };
  user: ModcpMemberStanding["user"];
}

export const previewWarning = async (draft: WarningDraft) =>
  await settle<WarningPreview>(
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body: draft },
        method: "post",
        module: "moderation",
        options,
        path: "/warnings/preview",
      }),
  );

export interface IssueWarningInput extends WarningDraft {
  idempotencyKey: string;
  message: string;
  overrideNote?: null | string;
  resolveReport: boolean;
  staffNote?: null | string;
}

export interface IssuedWarning {
  duplicate: boolean;
  points: { after: number; before: number };
  reportResolved: boolean;
  sanction: null | {
    endsAt: null | string;
    id: number;
    thresholdId: null | number;
  };
  warningId: number;
}

export const issueWarning = async (input: IssueWarningInput) =>
  await settle<IssuedWarning>(
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body: input },
        method: "post",
        module: "moderation",
        options,
        path: "/warnings",
      }),
  );

export const revokeWarning = async ({
  id,
  reason,
}: {
  id: number;
  reason: string;
}) =>
  await settle<{ userId: number; warningId: number }>(
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body: { reason }, params: { id } },
        method: "post",
        module: "moderation",
        options,
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
  await settle<{ sanctionId: number; userId: number }>(
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body: { reason }, params: { id } },
        method: "post",
        module: "moderation",
        options,
        path: "/sanctions/{id}/revoke",
      }),
  );
