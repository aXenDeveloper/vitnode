import {
  AUDIT_ACTION_MAX_LENGTH,
  AUDIT_ACTION_PATTERN,
  AUDIT_AREAS,
  AUDIT_PLUGIN_ID_MAX_LENGTH,
  AUDIT_TARGET_ID_MAX_LENGTH,
  AUDIT_TARGET_TYPE_MAX_LENGTH,
  AUDIT_TARGET_TYPE_PATTERN,
} from "@/lib/audit/const";
import { asSearchValue } from "@/lib/table-params";

import type { ActivityFilters } from "./activity-query";

/** An Activity Logs URL: the filters, plus the entry whose sheet is open. */
export interface ActivityRouteSearch extends ActivityFilters {
  log?: number;
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
  const entries: [keyof ActivityRouteSearch, unknown][] = [
    [
      "action",
      matching(input.action, AUDIT_ACTION_PATTERN, AUDIT_ACTION_MAX_LENGTH),
    ],
    ["actorId", positiveInt(input.actorId)],
    ["area", area],
    ["from", matching(input.from, DAY, 10)],
    ["log", positiveInt(input.log)],
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

/** The filters of a route search - everything but the open sheet. */
export const activityFiltersOf = ({
  log: _log,
  ...filters
}: ActivityRouteSearch): ActivityFilters => filters;

/** Filters and the open entry, back as route search. */
export const activitySearchOf = ({
  entryId,
  filters,
}: {
  entryId: null | number;
  filters: ActivityFilters;
}): ActivityRouteSearch =>
  normalizeActivitySearch({
    ...filters,
    ...(entryId === null ? {} : { log: entryId }),
  });
