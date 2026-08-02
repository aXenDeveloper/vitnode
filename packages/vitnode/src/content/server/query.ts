import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { and, eq, ilike, or } from "drizzle-orm";

import type { ContentFieldDescriptor, ContentFieldMap } from "../types";

import { ContentEngineError } from "../errors";

/**
 * Escapes the `LIKE` wildcards so a search for "100%" matches the literal text
 * rather than every row. Backslash is Postgres' default escape character.
 */
export const escapeLikePattern = (value: string): string =>
  value.replace(/[\\%_]/g, match => `\\${match}`);

export const buildSearchCondition = (
  columns: readonly PgColumn[],
  term: string | undefined,
): SQL | undefined => {
  const trimmed = term?.trim();
  if (!columns.length || !trimmed) return undefined;

  const pattern = `%${escapeLikePattern(trimmed)}%`;

  return or(...columns.map(column => ilike(column, pattern)));
};

const filterValue = (
  fieldValue: ContentFieldDescriptor,
  raw: unknown,
): unknown => {
  if (fieldValue.kind === "boolean") return raw === "true" || raw === true;

  return raw;
};

/**
 * Builds an equality filter from validated query parameters.
 *
 * Filter keys are looked up in the column map, so a request can never reach a
 * SQL identifier: an unknown key is a hard error, not a silently ignored one.
 */
export const buildFilterCondition = ({
  columns,
  contentTypeId,
  fields,
  filters,
}: {
  columns: Record<string, PgColumn>;
  contentTypeId: string;
  fields: ContentFieldMap;
  filters: Record<string, unknown>;
}): SQL | undefined => {
  const conditions: SQL[] = [];

  for (const [name, raw] of Object.entries(filters)) {
    if (raw === undefined) continue;

    const fieldValue = fields[name];
    const column = columns[name];
    if (!fieldValue || !column) {
      throw new ContentEngineError(`Unknown filter "${name}".`, {
        contentTypeId,
      });
    }

    conditions.push(eq(column, filterValue(fieldValue, raw)));
  }

  if (conditions.length === 0) return undefined;

  return conditions.length === 1 ? conditions[0] : and(...conditions);
};

/**
 * Resolves `orderBy` against the allowlist. The request only ever picks a name
 * from the list; the column object itself comes from the model.
 */
export const buildOrderColumn = ({
  columns,
  contentTypeId,
  fallback,
  orderBy,
  orderable,
}: {
  columns: Record<string, PgColumn>;
  contentTypeId: string;
  fallback: string;
  orderable: readonly string[];
  orderBy: string | undefined;
}): PgColumn => {
  const name = orderBy ?? fallback;

  if (!orderable.includes(name)) {
    throw new ContentEngineError(
      `Cannot order by "${name}". Allowed: ${orderable.join(", ")}.`,
      { contentTypeId },
    );
  }

  const column = columns[name];
  if (!column) {
    throw new ContentEngineError(`No column named "${name}".`, {
      contentTypeId,
    });
  }

  return column;
};

const sameValue = (current: unknown, next: unknown): boolean => {
  if (current instanceof Date) {
    if (next === null || next === undefined) return false;

    return current.getTime() === new Date(next as string).getTime();
  }

  return current === next;
};

/**
 * The keys an update actually changes. Values equal to what is already stored
 * are dropped, so `content.*.updated` never reports a field that did not move.
 */
export const diffChangedFields = (
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): string[] =>
  Object.keys(patch).filter(
    key => patch[key] !== undefined && !sameValue(current[key], patch[key]),
  );

/** `dateTime` values arrive as ISO strings and have to become `Date` columns. */
export const toColumnValues = (
  fields: ContentFieldMap,
  values: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(values).map(([name, value]) => {
      if (fields[name]?.kind !== "dateTime" || typeof value !== "string") {
        return [name, value];
      }

      return [name, new Date(value)];
    }),
  );
