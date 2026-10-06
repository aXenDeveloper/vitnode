import type { z } from "zod";

import { queryOptions } from "@tanstack/react-query";

import type {
  zodAiAction,
  zodAiModel,
  zodAiSettingsResponse,
} from "@/api/modules/admin/ai/schemas";
import type { AiRunStatusValue } from "@/lib/ai/run-status";
import type {
  AdminTableContract,
  AdminTablePage,
  AdminTableParams,
} from "@/views/admin/table/params";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { CONFIG_PLUGIN } from "@/config";
import {
  OPERATIONAL_STALE_TIME,
  RECORD_STALE_TIME,
} from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";
import {
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";
import {
  adminScopedQueryKey,
  adminScopedQueryRoot,
} from "@/views/admin/views/core/shared/admin-scope";

export const ADMIN_AI_SCREEN = "ai";

export const AI_OVERVIEW_PERIODS = ["current", "previous"] as const;
export type AiOverviewPeriod = (typeof AI_OVERVIEW_PERIODS)[number];

export interface AiBreakdownRow {
  failures: number;
  key: string;
  knownCostUsd: string;
  knownOperations: number;
  operations: number;
}

/** `GET /admin/ai/overview`. */
export interface AdminAiOverview {
  alt: {
    imagesDescribed: number;
    knownCostUsd: string;
    perImageUsd: null | string;
    perTranslationUsd: null | string;
    translations: number;
  };
  averageDailyCostUsd: string;
  averageOperationCostUsd: null | string;
  budget: {
    limitUsd: null | string;
    remainingUsd: null | string;
    reservedUsd: string;
    spentUsd: string;
    systemLimitUsd: null | string;
    systemSpentUsd: string;
  };
  byAction: AiBreakdownRow[];
  byModel: AiBreakdownRow[];
  byOrigin: AiBreakdownRow[];
  costSources: { estimated: number; provider: number; unknown: number };
  enabled: boolean;
  failureRate: number;
  knownCostUsd: string;
  operations: number;
  period: { end: string; start: string };
  pricingCoverage: number;
  tokens: { input: number; output: number };
}

export type AdminAiSettings = z.infer<typeof zodAiSettingsResponse>;

/** `GET /admin/ai/alt` - automatic ALT progress. */
export interface AdminAiAltStatus {
  counts: {
    completed: number;
    failed: number;
    pending: number;
    skipped: number;
    waitingBudget: number;
  };
  eligibleImages: number;
  enabled: boolean;
  languages: string[];
}
export type AdminAiModel = z.infer<typeof zodAiModel>;
export type AdminAiAction = z.infer<typeof zodAiAction>;

/** `GET /admin/ai/access/roles` - what the role form's AI tab edits. */
export interface AdminAiRoleAccess {
  permissions: AdminAiRolePermission[];
  /** `null` when creating a role. */
  role: null | {
    grants: {
      dailyLimit: null | number;
      granted: boolean;
      permission: string;
    }[];
    monthlyPoints: null | string;
    root: boolean;
    unlimited: boolean;
  };
}

export interface AdminAiRolePermission {
  actions: { icon: null | string; key: string; title: string }[];
  defaultGranted: boolean;
  key: string;
}

/** `GET /admin/ai/access/users/{userId}`. */
export interface AdminAiUserOverride {
  blocked: boolean;
  monthlyPoints: null | string;
  unlimited: boolean;
}

/** One row of the AI history, as JSON delivers it. */
export interface AdminAiRunRow {
  accepted: boolean | null;
  actionKey: string;
  actorType: "system" | "user";
  chargedPoints: null | string;
  chargedUsd: null | string;
  costSource: null | string;
  costUsd: null | string;
  createdAt: Date | string;
  errorCode: null | string;
  finishedAt: Date | null | string;
  id: number;
  inputTokens: null | number;
  modelId: null | string;
  outputTokens: null | number;
  provider: null | string;
  resourceId: null | string;
  resourceType: null | string;
  status: AiRunStatusValue;
  user: null | { id: number; name: string; nameCode: string };
}

export interface AdminAiRunCall {
  attempt: number;
  cacheReadTokens: null | number;
  cacheWriteTokens: null | number;
  costReason: null | string;
  costSource: string;
  costUsd: null | string;
  errorCode: null | string;
  finishedAt: Date | null | string;
  id: number;
  images: number;
  inputTokens: null | number;
  modelId: string;
  outputTokens: null | number;
  pricingVersion: null | string;
  provider: string;
  providerModelId: null | string;
  providerRequestId: null | string;
  reasoningTokens: null | number;
  startedAt: Date | string;
  status: string;
}

export interface AdminAiRunAdjustment {
  createdAt: Date | string;
  deltaUsd: string;
  id: number;
  newCostUsd: string;
  newSource: string;
  previousCostUsd: null | string;
  previousSource: string;
  reason: string;
}

/** `GET /admin/ai/history/{id}`. */
export interface AdminAiRunDetail {
  adjustments: AdminAiRunAdjustment[];
  calls: AdminAiRunCall[];
  run: AdminAiRunRow & {
    promptVersion: number;
    reservedPoints: string;
    reservedUsd: string;
    settlement: string;
  };
}

export const AI_HISTORY_ORDER_BY = ["createdAt"] as const;
export type AiHistoryOrderBy = (typeof AI_HISTORY_ORDER_BY)[number];

export const AI_HISTORY_TABLE_CONTRACT: AdminTableContract<AiHistoryOrderBy> = {
  orderBy: AI_HISTORY_ORDER_BY,
};

export const AI_HISTORY_ACTOR_TYPES = ["user", "system"] as const;
export type AiHistoryActorType = (typeof AI_HISTORY_ACTOR_TYPES)[number];

/** The filters the history route reads, one value each. */
export interface AiHistoryFilters {
  action?: string;
  actorType?: AiHistoryActorType;
  modelId?: string;
  status?: AiRunStatusValue;
}

export type AiHistoryParams = AiHistoryFilters &
  Omit<AdminTableParams<AiHistoryOrderBy>, "orderBy" | "search" | "status">;

export type AdminAiHistoryPage = AdminTablePage<AdminAiRunRow>;

export type AdminAiOverviewFetcher = (
  period: AiOverviewPeriod,
) => Promise<AdminAiOverview>;

export const fetchAdminAiOverview: AdminAiOverviewFetcher = async period => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { query: { period } },
    method: "get",
    module: "admin/ai",
    path: "/overview",
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the AI overview", period);
  }

  return await response.json();
};

export type AdminAiSettingsFetcher = () => Promise<AdminAiSettings>;

export const fetchAdminAiSettings: AdminAiSettingsFetcher = async () => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "admin/ai",
    path: "/settings",
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the AI settings");
  }

  return await response.json();
};

export type AdminAiAltStatusFetcher = () => Promise<AdminAiAltStatus>;

export const fetchAdminAiAltStatus: AdminAiAltStatusFetcher = async () => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "admin/ai",
    path: "/alt",
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the ALT text progress");
  }

  return await response.json();
};

export type AdminAiModelsFetcher = () => Promise<{ models: AdminAiModel[] }>;

export const fetchAdminAiModels: AdminAiModelsFetcher = async () => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "admin/ai",
    path: "/models",
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the AI models");
  }

  return await response.json();
};

export type AdminAiActionsFetcher = () => Promise<{
  actions: AdminAiAction[];
}>;

export const fetchAdminAiActions: AdminAiActionsFetcher = async () => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "admin/ai",
    path: "/actions",
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the AI actions");
  }

  return await response.json();
};

export type AdminAiRoleAccessFetcher = (
  roleId: null | number,
) => Promise<AdminAiRoleAccess>;

export const fetchAdminAiRoleAccess: AdminAiRoleAccessFetcher =
  async roleId => {
    const response = await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      args: { query: roleId === null ? {} : { roleId } },
      method: "get",
      module: "admin/ai",
      path: "/access/roles",
    });

    if (!response.ok) {
      throw new AdminRequestError(
        response.status,
        "the AI access of a role",
        `roleId=${roleId ?? "new"}`,
      );
    }

    return await response.json();
  };

export type AdminAiUserOverrideFetcher = (
  userId: number,
) => Promise<{ override: AdminAiUserOverride | null }>;

export const fetchAdminAiUserOverride: AdminAiUserOverrideFetcher =
  async userId => {
    const response = await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      args: { params: { userId } },
      method: "get",
      module: "admin/ai",
      path: "/access/users/{userId}",
    });

    if (!response.ok) {
      throw new AdminRequestError(
        response.status,
        "the AI exception of a user",
        `userId=${userId}`,
      );
    }

    return await response.json();
  };

export type AdminAiHistoryFetcher = (
  params: AiHistoryParams,
) => Promise<AdminAiHistoryPage>;

export const fetchAdminAiHistory: AdminAiHistoryFetcher = async params => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { query: params },
    method: "get",
    module: "admin/ai",
    path: "/history",
  });

  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "the AI history",
      describeAdminParams(params),
    );
  }

  return await response.json();
};

export type AdminAiRunFetcher = (id: number) => Promise<AdminAiRunDetail>;

export const fetchAdminAiRun: AdminAiRunFetcher = async id => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { params: { id } },
    method: "get",
    module: "admin/ai",
    path: "/history/{id}",
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "an AI run", `id=${id}`);
  }

  return await response.json();
};

/** Every cached read of the AI screens for one admin. */
export const adminAiQueryRoot = (adminUserId: AdminIdentity) =>
  adminScopedQueryRoot(ADMIN_AI_SCREEN, adminUserId);

export const adminAiOverviewQueryOptions = ({
  adminUserId,
  period,
}: {
  adminUserId: AdminIdentity;
  period: AiOverviewPeriod;
}) =>
  queryOptions({
    queryFn: async () => await fetchAdminAiOverview(period),
    queryKey: adminScopedQueryKey(
      ADMIN_AI_SCREEN,
      adminUserId,
      "overview",
      period,
    ),
    retry: false,
    /** {@link OPERATIONAL_STALE_TIME} - Spending moves with every run. */
    staleTime: OPERATIONAL_STALE_TIME,
  });

export const adminAiSettingsQueryOptions = ({
  adminUserId,
}: {
  adminUserId: AdminIdentity;
}) =>
  queryOptions({
    queryFn: async () => await fetchAdminAiSettings(),
    queryKey: adminScopedQueryKey(ADMIN_AI_SCREEN, adminUserId, "settings"),
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });

export const adminAiAltStatusQueryOptions = ({
  adminUserId,
}: {
  adminUserId: AdminIdentity;
}) =>
  queryOptions({
    queryFn: async () => await fetchAdminAiAltStatus(),
    queryKey: adminScopedQueryKey(ADMIN_AI_SCREEN, adminUserId, "alt"),
    retry: false,
    /** {@link OPERATIONAL_STALE_TIME} - The worker drains the queue every minute. */
    staleTime: OPERATIONAL_STALE_TIME,
  });

export const adminAiModelsQueryOptions = ({
  adminUserId,
}: {
  adminUserId: AdminIdentity;
}) =>
  queryOptions({
    queryFn: async () => await fetchAdminAiModels(),
    queryKey: adminScopedQueryKey(ADMIN_AI_SCREEN, adminUserId, "models"),
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });

export const adminAiActionsQueryOptions = ({
  adminUserId,
}: {
  adminUserId: AdminIdentity;
}) =>
  queryOptions({
    queryFn: async () => await fetchAdminAiActions(),
    queryKey: adminScopedQueryKey(ADMIN_AI_SCREEN, adminUserId, "actions"),
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });

export const adminAiRoleAccessQueryOptions = ({
  adminUserId,
  roleId,
}: {
  adminUserId: AdminIdentity;
  roleId: null | number;
}) =>
  queryOptions({
    queryFn: async () => await fetchAdminAiRoleAccess(roleId),
    queryKey: adminScopedQueryKey(
      ADMIN_AI_SCREEN,
      adminUserId,
      "role-access",
      roleId,
    ),
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });

export const adminAiUserOverrideQueryOptions = ({
  adminUserId,
  userId,
}: {
  adminUserId: AdminIdentity;
  userId: number;
}) =>
  queryOptions({
    queryFn: async () => await fetchAdminAiUserOverride(userId),
    queryKey: adminScopedQueryKey(
      ADMIN_AI_SCREEN,
      adminUserId,
      "user-override",
      userId,
    ),
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });

export const adminAiHistoryQueryOptions = ({
  adminUserId,
  params,
}: {
  adminUserId: AdminIdentity;
  params: AiHistoryParams;
}) =>
  queryOptions({
    queryFn: async () => await fetchAdminAiHistory(params),
    queryKey: adminScopedQueryKey(
      ADMIN_AI_SCREEN,
      adminUserId,
      "history",
      params,
    ),
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

export const adminAiRunQueryOptions = ({
  adminUserId,
  id,
}: {
  adminUserId: AdminIdentity;
  id: number;
}) =>
  queryOptions({
    queryFn: async () => await fetchAdminAiRun(id),
    queryKey: adminScopedQueryKey(ADMIN_AI_SCREEN, adminUserId, "run", id),
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });
