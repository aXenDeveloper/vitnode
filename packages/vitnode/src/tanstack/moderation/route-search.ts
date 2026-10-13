import type { ModcpBoardFilter } from "@/views/moderation/modcp/modcp-query";

import { MIN_TABLE_SEARCH_LENGTH } from "@/components/table/url-state";
import { asSearchValue } from "@/lib/table-params";

export interface ModcpReportsRouteSearch {
  assigned?: "me" | "unassigned";
  search?: string;
}

const ASSIGNED = new Set(["me", "unassigned"]);
const MAX_SEARCH_LENGTH = 200;

export const normalizeModcpReportsSearch = (
  input: Record<string, unknown>,
): ModcpReportsRouteSearch => {
  const assigned = asSearchValue(input.assigned);
  const search = asSearchValue(input.search)
    ?.trim()
    .slice(0, MAX_SEARCH_LENGTH);

  return {
    ...(assigned !== undefined && ASSIGNED.has(assigned)
      ? {
          assigned: assigned as NonNullable<
            ModcpReportsRouteSearch["assigned"]
          >,
        }
      : {}),
    ...(search !== undefined && search.length >= MIN_TABLE_SEARCH_LENGTH
      ? { search }
      : {}),
  };
};

export const modcpBoardFilter = (
  search: ModcpReportsRouteSearch,
): ModcpBoardFilter => ({
  assigned: search.assigned ?? "any",
  ...(search.search === undefined ? {} : { search: search.search }),
});

export const modcpReportsSearchParams = (
  search: ModcpReportsRouteSearch,
): URLSearchParams =>
  new URLSearchParams(
    Object.entries(search)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );

export const modcpReportsSearchFrom = (
  query: string,
): ModcpReportsRouteSearch =>
  normalizeModcpReportsSearch(Object.fromEntries(new URLSearchParams(query)));
