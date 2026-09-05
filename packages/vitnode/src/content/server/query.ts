import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { and, eq, ilike, isNull, or } from "drizzle-orm";

import type {
  ContentFieldDescriptor,
  ContentFieldMap,
  ContentRelationFilter,
} from "../types";

import {
  CONTENT_FILTERABLE_FIELD_KINDS,
  CONTENT_PUBLICATION_STATUSES,
  isContentPublicationStatus,
  isFilterableFieldKind,
} from "../const";
import { ContentEngineError } from "../errors";
import {
  contentFieldPath,
  contentInnerFields,
  contentLeafColumnName,
  contentStorageColumns,
  contentValuesToColumns,
  isContentCollectionField,
  isContentReferenceCollection,
  readContentLeaf,
  splitContentFieldPath,
} from "../paths";

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
  allowed,
  columns,
  contentTypeId,
  fields,
  filters,
  membership,
  publication = false,
}: {
  /**
   * Narrows the filterable set further, for a caller with its own allowlist -
   * the public service, whose `filterableFields` is a deliberate subset of
   * what the admin list accepts.
   */
  allowed?: readonly string[];
  columns: Record<string, PgColumn>;
  contentTypeId: string;
  fields: ContentFieldMap;
  filters: Record<string, unknown>;
  /**
   * Compiles a to-many relation's `{ contains }` filter into an indexed
   * `EXISTS` over its junction table.
   *
   * Injected rather than built here because it needs the generated tables,
   * which this module deliberately knows nothing about - and because a caller
   * that passes none simply has no to-many relation to filter on.
   */
  membership?: (
    field: string,
    filter: ContentRelationFilter,
  ) => SQL | undefined;
  /** Whether `status` is a generated column and therefore filterable. */
  publication?: boolean;
}): SQL | undefined => {
  const conditions: SQL[] = [];

  for (const [name, raw] of Object.entries(filters)) {
    if (raw === undefined) continue;

    if (allowed && !allowed.includes(name)) {
      throw new ContentEngineError(
        `Filter "${name}" is not in the allowlist. Allowed: ${allowed.length > 0 ? allowed.join(", ") : "(none)"}.`,
        { contentTypeId },
      );
    }

    // `status` is a generated column, not a declared field, so there is no
    // descriptor to drive the checks below. The generated schema's `z.enum`
    // already narrowed it on the HTTP path; this re-checks the value for the
    // direct-service path, where a cast or a runtime-built object could put
    // anything here.
    if (publication && name === "status" && columns.status) {
      if (!isContentPublicationStatus(raw)) {
        throw new ContentEngineError(
          `Invalid publication status ${JSON.stringify(raw)}. Allowed values: ${CONTENT_PUBLICATION_STATUSES.join(", ")}.`,
          { contentTypeId },
        );
      }

      conditions.push(eq(columns.status, raw));
      continue;
    }

    const fieldValue = fields[name];

    // A to-many relation has no column, so it is answered before the column
    // lookup: `{ contains: 7 }` becomes an indexed `EXISTS` over the junction
    // table rather than an equality against something that does not exist.
    if (fieldValue && isContentReferenceCollection(fieldValue)) {
      const filter = raw as ContentRelationFilter;
      if (typeof filter?.contains !== "number") {
        throw new ContentEngineError(
          `Filter "${name}" is a to-many relation, which takes \`{ contains: <id> }\` rather than a value.`,
          { contentTypeId },
        );
      }

      const condition = membership?.(name, filter);
      if (condition) conditions.push(condition);
      continue;
    }

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

export const diffChangedFields = <TName extends string>(
  fieldNames: readonly TName[],
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): TName[] =>
  fieldNames.filter(
    name => patch[name] !== undefined && !sameValue(current[name], patch[name]),
  );

export const diffChangedPaths = (
  fields: ContentFieldMap,
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): string[] => {
  const changed: string[] = [];

  for (const [name, fieldValue] of Object.entries(fields)) {
    const next = patch[name];
    if (next === undefined) continue;
    // A collection is not a column, so it is not this function's to diff - the
    // advanced store answers for it, against the rows rather than the patch.
    if (isContentCollectionField(fieldValue)) continue;

    if (fieldValue.kind !== "group") {
      if (!sameValue(current[name], next)) changed.push(name);
      continue;
    }

    const inner = contentInnerFields(fieldValue);

    if (next === null) {
      for (const leaf of Object.keys(inner)) {
        const stored = readContentLeaf(current, name, leaf);
        if (stored === null || stored === undefined) continue;

        changed.push(contentFieldPath(name, leaf));
      }
      continue;
    }

    if (typeof next !== "object") continue;

    for (const [leaf, leafValue] of Object.entries(
      next as Record<string, unknown>,
    )) {
      if (!(leaf in inner) || leafValue === undefined) continue;

      // `readContentLeaf` rather than a direct column read, so the same diff
      // works against a database row (flattened columns) and against a logical
      // one - a translation's `values` is the second, and the translation
      // restore path diffs exactly that.
      if (sameValue(readContentLeaf(current, name, leaf), leafValue)) continue;

      changed.push(contentFieldPath(name, leaf));
    }
  }

  return changed;
};

export const changedPathsToColumns = (
  fields: ContentFieldMap,
  patch: Record<string, unknown>,
  changedPaths: readonly string[],
): Record<string, unknown> => {
  const picked: Record<string, unknown> = {};

  for (const path of changedPaths) {
    const parts = splitContentFieldPath(path);
    if (!parts) {
      if (fields[path] === undefined) continue;

      picked[path] = patch[path];
      continue;
    }

    const [owner, leaf] = parts;
    const container = patch[owner];
    picked[contentLeafColumnName(owner, leaf)] =
      container === null
        ? null
        : ((container as Record<string, unknown> | undefined)?.[leaf] ?? null);
  }

  return toColumnValues(contentStorageColumns(fields), picked);
};

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

export const toInsertColumns = (
  fields: ContentFieldMap,
  values: Record<string, unknown>,
): Record<string, unknown> =>
  toColumnValues(
    contentStorageColumns(fields),
    contentValuesToColumns(fields, values),
  );
