import type {
  AiHistoryFilters,
  AiHistoryOrderBy,
  AiHistoryParams,
  AiOverviewSearch,
} from "@/views/admin/views/core/ai/ai-query";

import {
  AI_OVERVIEW_DEFAULT_PRESET,
  isAiDay,
  isAiMonth,
  isAiOverviewPreset,
} from "@/lib/ai/overview-range";
import { isAiRunStatus } from "@/lib/ai/run-status";
import { asSearchValue } from "@/lib/table-params";
import {
  AI_HISTORY_ACTOR_TYPES,
  AI_HISTORY_TABLE_CONTRACT,
} from "@/views/admin/views/core/ai/ai-query";

import type {
  AdminTableRouteSearch,
  UncheckedAdminTableSearch,
} from "../table-search";

import {
  adminTableRouteParams,
  normalizeAdminTableSearch,
} from "../table-search";

export type AiOverviewRouteSearch = AiOverviewSearch & { settings?: "open" };

export const normalizeAiOverviewSearch = (
  input: Record<string, unknown>,
): AiOverviewRouteSearch => {
  const from = asSearchValue(input.from);
  const to = asSearchValue(input.to);
  const range = asSearchValue(input.range);
  const month = asSearchValue(input.month);
  const custom = isAiDay(from) && isAiDay(to);

  return {
    ...(custom ? { from, to } : {}),
    ...(!custom &&
    isAiOverviewPreset(range) &&
    range !== AI_OVERVIEW_DEFAULT_PRESET
      ? { range }
      : {}),
    ...(isAiMonth(month) ? { month } : {}),
    ...(input.settings === "open" ? { settings: "open" as const } : {}),
  };
};

export type AiHistoryRouteSearch = AiHistoryFilters &
  Omit<
    AdminTableRouteSearch<AiHistoryOrderBy>,
    "orderBy" | "search" | "status"
  >;

export type UncheckedAiHistorySearch =
  AiHistoryRouteSearch | Record<string, unknown>;

const KEY_PATTERN = /^[\w@:./-]{1,255}$/;

/** The history route's own filters, one value each - the API takes no lists. */
const readHistoryFilters = (
  input: UncheckedAiHistorySearch,
): AiHistoryFilters => {
  const action = asSearchValue(input.action);
  const actorType = asSearchValue(input.actorType);
  const modelId = asSearchValue(input.modelId);
  const status = asSearchValue(input.status);

  return {
    ...(action && KEY_PATTERN.test(action) ? { action } : {}),
    ...(AI_HISTORY_ACTOR_TYPES.find(value => value === actorType)
      ? { actorType: actorType as AiHistoryFilters["actorType"] }
      : {}),
    ...(modelId && KEY_PATTERN.test(modelId) ? { modelId } : {}),
    ...(status && isAiRunStatus(status) ? { status } : {}),
  };
};

/** Pagination without the parts this list has no use for. */
const tableSearchOf = (input: UncheckedAiHistorySearch) => {
  const { cursor, first, last, order, page } = normalizeAdminTableSearch(
    input as UncheckedAdminTableSearch<AiHistoryOrderBy>,
    AI_HISTORY_TABLE_CONTRACT,
  );

  return {
    ...(cursor === undefined ? {} : { cursor }),
    ...(page === undefined ? {} : { page }),
    ...(first === undefined ? {} : { first }),
    ...(last === undefined ? {} : { last }),
    ...(order === undefined ? {} : { order }),
  };
};

/** The route's `validateSearch`: it normalises rather than rejects. */
export const normalizeAiHistoryRouteSearch = (
  input: UncheckedAiHistorySearch,
): AiHistoryRouteSearch => ({
  ...tableSearchOf(input),
  ...readHistoryFilters(input),
});

/** The request this URL is asking for, and therefore the query key. */
export const aiHistoryRouteParams = (
  input: UncheckedAiHistorySearch,
): AiHistoryParams => {
  const { cursor, first, last, order, page } = adminTableRouteParams(
    input as UncheckedAdminTableSearch<AiHistoryOrderBy>,
    AI_HISTORY_TABLE_CONTRACT,
  );

  return {
    ...(cursor === undefined ? {} : { cursor }),
    ...(first === undefined ? {} : { first }),
    ...(last === undefined ? {} : { last }),
    ...(order === undefined ? {} : { order }),
    ...(page === undefined ? {} : { page }),
    ...readHistoryFilters(input),
  };
};

/** The query string the table's controls read themselves out of. */
export const aiHistorySearchParams = (
  input: UncheckedAiHistorySearch,
): URLSearchParams => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(
    normalizeAiHistoryRouteSearch(input),
  )) {
    params.set(key, String(value));
  }

  return params;
};

/** A query string one of those controls produced, back as route search. */
export const aiHistorySearchFrom = (nextSearch: string): AiHistoryRouteSearch =>
  normalizeAiHistoryRouteSearch(
    Object.fromEntries(new URLSearchParams(nextSearch)),
  );
