import {
  AUDIT_ACTION_MAX_LENGTH,
  AUDIT_ACTION_PATTERN,
  AUDIT_AREAS,
  AUDIT_PLUGIN_ID_MAX_LENGTH,
  AUDIT_SEARCH_ACTIONS_MAX,
  AUDIT_TARGET_ID_MAX_LENGTH,
  AUDIT_TARGET_TYPE_MAX_LENGTH,
  AUDIT_TARGET_TYPE_PATTERN,
} from "@/lib/audit/const";
import { asSearchValue } from "@/lib/table-params";

import type { ActivityFilters, ActivityPagination } from "./activity-query";

const foldForSearch = (value: string): string =>
  value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .replaceAll(/[łŁ]/g, "l")
    .toLocaleLowerCase();

export const activitySearchActions = <
  Action extends { action: string; pluginId: string },
>(
  term: string | undefined,
  actions: readonly Action[],
  labelOf: (action: Action) => string,
): string | undefined => {
  const needle = foldForSearch(term?.trim() ?? "");
  if (!needle) return undefined;

  const matches = actions
    .filter(action => foldForSearch(labelOf(action)).includes(needle))
    .slice(0, AUDIT_SEARCH_ACTIONS_MAX)
    .map(({ action, pluginId }) => `${pluginId}:${action}`);

  return matches.length > 0 ? matches.join(",") : undefined;
};

/** The date presets of the toolbar's date filter. */
export const ACTIVITY_RANGES = [
  "today",
  "7d",
  "30d",
  "90d",
  "180d",
  "this_month",
  "last_month",
  "this_year",
  "last_year",
] as const;

export type ActivityRange = (typeof ACTIVITY_RANGES)[number];

const RANGE_DAYS = {
  "180d": 180,
  "30d": 30,
  "7d": 7,
  "90d": 90,
  today: 1,
} as const;

const utcDay = (year: number, month: number, date: number) =>
  new Date(Date.UTC(year, month, date)).toISOString().slice(0, 10);

export const activityRangeDays = (
  range: ActivityRange,
  now: Date = new Date(),
): { from: string; to?: string } => {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  switch (range) {
    case "last_month":
      return { from: utcDay(year, month - 1, 1), to: utcDay(year, month, 0) };
    case "last_year":
      return { from: utcDay(year - 1, 0, 1), to: utcDay(year - 1, 11, 31) };
    case "this_month":
      return { from: utcDay(year, month, 1) };
    case "this_year":
      return { from: utcDay(year, 0, 1) };
    default:
      return {
        from: utcDay(year, month, now.getUTCDate() - RANGE_DAYS[range] + 1),
      };
  }
};

/** Entries per page while the URL names no `first`. */
export const ACTIVITY_PAGE_SIZE = 25;

const ACTIVITY_MAX_PAGE_SIZE = 100;

/** An Activity Logs URL: the filters, the page, and the entry that is open. */
export interface ActivityRouteSearch extends ActivityFilters {
  first?: number;
  log?: number;
  page?: number;
  /** A date preset; while set it replaces `from` and `to`. */
  range?: ActivityRange;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const PLUGIN_ID = /^[\w@./-]+$/;
const TARGET_ID = /^[\w:.-]+$/;

const positiveInt = (value: unknown): number | undefined => {
  const raw = asSearchValue(value);
  if (raw === undefined || !/^\d{1,15}$/.test(raw)) return undefined;
  const number = Number(raw);

  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
};

const pageSize = (value: unknown): number | undefined => {
  const size = positiveInt(value);

  return size === undefined || size === ACTIVITY_PAGE_SIZE
    ? undefined
    : Math.min(size, ACTIVITY_MAX_PAGE_SIZE);
};

const matching = (value: unknown, pattern: RegExp, max: number) => {
  const raw = asSearchValue(value);

  return raw && raw.length <= max && pattern.test(raw) ? raw : undefined;
};

/**
 * The route's search validator: keeps what it recognises, drops the rest,
 * never throws - a hand-edited URL shows the unfiltered log rather than an
 * error. The API validates again; this only keeps the URL tidy.
 */
export const normalizeActivitySearch = (
  input: Record<string, unknown>,
): ActivityRouteSearch => {
  const area = AUDIT_AREAS.find(value => value === asSearchValue(input.area));
  const search = asSearchValue(input.search)?.trim().slice(0, 100);
  const page = positiveInt(input.page);
  const range = ACTIVITY_RANGES.find(
    value => value === asSearchValue(input.range),
  );
  const entries: [keyof ActivityRouteSearch, unknown][] = [
    [
      "action",
      matching(input.action, AUDIT_ACTION_PATTERN, AUDIT_ACTION_MAX_LENGTH),
    ],
    ["actorId", positiveInt(input.actorId)],
    ["area", area],
    ["first", pageSize(input.first)],
    ["from", matching(input.from, DAY, 10)],
    ["log", positiveInt(input.log)],
    ["page", page === 1 ? undefined : page],
    ["range", range],
    [
      "pluginId",
      matching(input.pluginId, PLUGIN_ID, AUDIT_PLUGIN_ID_MAX_LENGTH),
    ],
    ["search", search === "" ? undefined : search],
    [
      "targetId",
      matching(input.targetId, TARGET_ID, AUDIT_TARGET_ID_MAX_LENGTH),
    ],
    [
      "targetType",
      matching(
        input.targetType,
        AUDIT_TARGET_TYPE_PATTERN,
        AUDIT_TARGET_TYPE_MAX_LENGTH,
      ),
    ],
    ["to", matching(input.to, DAY, 10)],
  ];

  return Object.fromEntries(entries.filter(([, value]) => value !== undefined));
};

/**
 * The filters of a route search, as the API reads them - everything but the
 * page and the open entry, with a date preset turned into its days (UTC).
 */
export const activityFiltersOf = ({
  first: _first,
  log: _log,
  page: _page,
  range,
  ...filters
}: ActivityRouteSearch): ActivityFilters => {
  if (!range) return filters;
  const { from: _from, to: _to, ...rest } = filters;

  return { ...rest, ...activityRangeDays(range) };
};

/** The page a route search asks for. */
export const activityPaginationOf = ({
  first,
  page,
}: ActivityRouteSearch): ActivityPagination => ({
  page: page ?? 1,
  pageSize: first ?? ACTIVITY_PAGE_SIZE,
});
