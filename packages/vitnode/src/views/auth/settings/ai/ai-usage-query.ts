import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { CONFIG_PLUGIN } from "@/config";
import { OPERATIONAL_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";

export const AI_USAGE_NOTICES = [
  "none",
  "near_limit",
  "exhausted",
  "site_paused",
] as const;
export type AiUsageNotice = (typeof AI_USAGE_NOTICES)[number];

export interface AiUsageAction {
  dailyLimit: null | number;
  description: null | string;
  key: string;
  permissionKey: string;
  usedToday: number;
}

/** `GET /ai/usage` - the signed-in user's own allowance. */
export interface AiUsage {
  actions: AiUsageAction[];
  enabled: boolean;
  notice: AiUsageNotice;
  points: {
    available: null | string;
    reserved: string;
    /** `null` is unlimited. */
    total: null | string;
    used: string;
  };
  resetsAt: string;
  sitePaused: boolean;
}

export interface AiHistoryItem {
  accepted: boolean | null;
  actionKey: string;
  chargedPoints: null | string;
  createdAt: Date | string;
  errorCode: null | string;
  id: number;
  status: string;
}

export interface AiHistoryPage {
  items: AiHistoryItem[];
  nextBefore: null | number;
}

export class AiUsageRequestError extends Error {
  constructor(status: number, what: string) {
    super(`The AI API answered ${status} for ${what}.`);
    this.name = "AiUsageRequestError";
    this.status = status;
  }

  readonly status: number;
}

export type AiUsageFetcher = () => Promise<AiUsage>;

export const fetchAiUsage: AiUsageFetcher = async () => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "ai",
    path: "/usage",
  });

  if (!response.ok) {
    throw new AiUsageRequestError(response.status, "the user's AI usage");
  }

  return await response.json();
};

export type AiHistoryFetcher = (before?: number) => Promise<AiHistoryPage>;

export const fetchAiHistory: AiHistoryFetcher = async before => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { query: before === undefined ? {} : { before } },
    method: "get",
    module: "ai",
    path: "/history",
  });

  if (!response.ok) {
    throw new AiUsageRequestError(
      response.status,
      `the user's AI history (before ${before ?? "none"})`,
    );
  }

  return await response.json();
};

export const AI_USAGE_QUERY_ROOT = ["ai", "user"] as const;

export const aiUsageQueryRoot = (userId: number) =>
  [...AI_USAGE_QUERY_ROOT, userId] as const;

export const aiUsageQueryOptions = ({ userId }: { userId: number }) =>
  queryOptions({
    // The owner comes from the session cookie on the server; `userId` only
    // keeps one account's cache from answering for another.
    queryFn: async () => await fetchAiUsage(),
    queryKey: [...aiUsageQueryRoot(userId), "usage"] as const,
    retry: false,
    /** {@link OPERATIONAL_STALE_TIME} - Points move every time an AI feature runs. */
    staleTime: OPERATIONAL_STALE_TIME,
  });

export const aiHistoryQueryOptions = ({ userId }: { userId: number }) =>
  infiniteQueryOptions({
    getNextPageParam: (lastPage: AiHistoryPage) =>
      lastPage.nextBefore ?? undefined,
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => await fetchAiHistory(pageParam),
    queryKey: [...aiUsageQueryRoot(userId), "history"] as const,
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });
