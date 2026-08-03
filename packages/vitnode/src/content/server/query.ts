import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { and, eq, ilike, isNull, or } from "drizzle-orm";

import type { ContentFieldDescriptor, ContentFieldMap } from "../types";

import {
  CONTENT_FILTERABLE_FIELD_KINDS,
  isFilterableFieldKind,
} from "../const";
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
 * Filter keys are looked up in the column map, so no caller can reach a SQL
 * identifier. A key that is not a declared field is a hard error here rather
 * than something quietly dropped - the generated list route has already stripped
 * the query-string keys that are not filters, so anything arriving with an
 * unrecognised key came from code, and code should hear about it.
 *
 * The public filter type also excludes the kinds that have no equality filter,
 * and `null` on a `NOT NULL` field. Both are re-checked here because a cast, a
 * plain-JavaScript caller or an object built at runtime can bypass the type -
 * and the type is not what protects the query.
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

    if (!isFilterableFieldKind(fieldValue.kind)) {
      throw new ContentEngineError(
        `Field "${name}" of kind "${fieldValue.kind}" cannot be used as a generated equality filter. Filterable kinds: ${CONTENT_FILTERABLE_FIELD_KINDS.join(", ")}. Write a custom route for anything else.`,
        { contentTypeId },
      );
    }

    // `null` is a value, not a parameter: `column = NULL` is never true.
    if (raw === null) {
      if (!fieldValue.nullable) {
        throw new ContentEngineError(
          `Field "${name}" is not nullable, so it can never hold null. Drop the filter, or declare the field \`nullable: true\`.`,
          { contentTypeId },
        );
      }

      conditions.push(isNull(column));
      continue;
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
 *
 * Driven by the content type's own field names rather than by `Object.keys` on
 * the patch: that keeps the result typed as the field-name union, and it can
 * never surface a key the content type does not declare.
 */
export const diffChangedFields = <TName extends string>(
  fieldNames: readonly TName[],
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): TName[] =>
  fieldNames.filter(
    name => patch[name] !== undefined && !sameValue(current[name], patch[name]),
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
