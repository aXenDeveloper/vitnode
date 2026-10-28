import type { SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import {
  and,
  eq,
  inArray,
  isNull,
  not,
  notInArray,
  or,
  sql,
} from "drizzle-orm";

import type { ContentId } from "../../ids";
import type { AnyContentModel } from "../../server/model";
import type { AnyContentTypeDefinition } from "../../types";
import type { ContentAccessAction, ContentAccessActor } from "../policy";
import type { ContentAccessFamily } from "./families";

import { contentContainerFieldOf } from "../../containers/association";
import { contentIdKey } from "../../ids";
import { contentSearchContextSource } from "../../search";
import { contentDefinitionOf } from "../../server/model";
import { resolveContentAccessActor } from "./actor";
import {
  contentAccessAllowedScopes,
  isContentAccessFamilyOpen,
  listContentAccessFamilies,
} from "./families";

/**
 * How a content type's records map to access scopes:
 *
 * - `container` - its own `field.container()` of an access-enabled collection;
 * - `scopes` - `access.from`, a relation to a scope content type, where a
 *   record must be allowed by every scope it points at;
 * - `parent` - a relation to a record that has access of its own (a reply's
 *   thread root, a comment's article), whose scopes it shares.
 */
export type ContentAccessSource =
  | {
      column: PgColumn;
      family: ContentAccessFamily;
      field: string;
      kind: "container";
    }
  | {
      column: PgColumn;
      field: string;
      kind: "parent";
      parent: AnyContentModel;
    }
  | {
      column?: PgColumn;
      family: ContentAccessFamily;
      field: string;
      junction?: { itemId: PgColumn; relatedItemId: PgColumn; table: PgTable };
      kind: "scopes";
    };

/** A scope one record belongs to. */
export interface ContentAccessScopeRef {
  family: string;
  scopeId: string;
}

const modelsOf = (c: Context): { model: AnyContentModel; pluginId: string }[] =>
  c.get("core")?.contentModels ?? [];

const modelById = (c: Context, id: string): AnyContentModel | undefined =>
  modelsOf(c).find(entry => entry.model.definition.id === id)?.model;

/** The relation fields that make a record answer a parent, in priority order. */
const parentFieldsOf = (
  definition: AnyContentTypeDefinition,
): { field: string; target: AnyContentTypeDefinition }[] => {
  const candidates: { field: string; target: AnyContentTypeDefinition }[] = [];
  const add = (field: string) => {
    const descriptor = definition.fields[field];
    if (
      descriptor?.kind !== "relation" ||
      descriptor.multiple ||
      candidates.some(entry => entry.field === field)
    ) {
      return;
    }
    try {
      const target = descriptor.target();
      if (target.id !== definition.id) candidates.push({ field, target });
    } catch {
      // A relation whose target cannot load is no parent.
    }
  };

  if (definition.thread.enabled) add(definition.thread.rootField);
  for (const [name, descriptor] of Object.entries(definition.fields)) {
    if (
      descriptor.kind === "relation" &&
      (descriptor as { container?: boolean }).container === true
    ) {
      add(name);
    }
  }
  const context = contentSearchContextSource(definition);
  if (context?.kind === "relation") add(context.field);

  return candidates;
};

// Per registry, then per model: the answer depends on which families the
// running app registered, and tests build more than one app per process.
const sources = new WeakMap<
  object,
  WeakMap<AnyContentModel, ContentAccessSource | null>
>();
const NO_REGISTRY = {};

const sourceCacheOf = (
  c: Context,
): WeakMap<AnyContentModel, ContentAccessSource | null> => {
  const core = (c.get("core") as object | undefined) ?? NO_REGISTRY;
  let cache = sources.get(core);
  if (!cache) {
    cache = new WeakMap();
    sources.set(core, cache);
  }

  return cache;
};

/**
 * The access source of one model, or `null` when its records belong to no
 * access scope. Static for the life of the process.
 */
export const contentAccessSourceOf = (
  c: Context,
  model: AnyContentModel,
  visiting: ReadonlySet<string> = new Set(),
): ContentAccessSource | null => {
  const cache = sourceCacheOf(c);
  if (cache.has(model)) return cache.get(model) ?? null;

  const definition = contentDefinitionOf(model);
  const columns = model.columns as Record<string, PgColumn>;
  const families = listContentAccessFamilies(c);
  const resolve = (): ContentAccessSource | null => {
    const from = definition.access?.from;
    if (from) {
      const descriptor = definition.fields[from];
      const target =
        descriptor?.kind === "relation" ? descriptor.target() : undefined;
      const family = families.find(
        candidate =>
          candidate.kind === "contentType" && candidate.id === target?.id,
      );
      if (!family) return null;

      const junction = (
        model.advancedTables.junctions as unknown as Record<
          string,
          Record<string, unknown> | undefined
        >
      )[from];

      return junction
        ? {
            family,
            field: from,
            junction: {
              itemId: junction.itemId as PgColumn,
              relatedItemId: junction.relatedItemId as PgColumn,
              table: junction as unknown as PgTable,
            },
            kind: "scopes",
          }
        : { column: columns[from], family, field: from, kind: "scopes" };
    }

    const container = contentContainerFieldOf(definition);
    if (container) {
      const family = families.find(
        candidate =>
          candidate.kind === "container" &&
          candidate.id === container.field.definition.id,
      );
      const column = columns[container.name];
      if (family && column) {
        return { column, family, field: container.name, kind: "container" };
      }
    }

    const next = new Set(visiting).add(definition.id);
    for (const { field, target } of parentFieldsOf(definition)) {
      if (next.has(target.id)) continue;
      const parent = modelById(c, target.id);
      const column = columns[field];
      if (!parent || !column) continue;
      if (contentAccessSourceOf(c, parent, next)) {
        return { column, field, kind: "parent", parent };
      }
    }

    return null;
  };

  const source = resolve();
  // Only cache a complete answer; a call mid-cycle may be partial.
  if (visiting.size === 0) cache.set(model, source);

  return source;
};

/** The family at the end of a source's parent chain. */
export const contentAccessFamilyOf = (
  c: Context,
  model: AnyContentModel,
): ContentAccessFamily | null => {
  const source = contentAccessSourceOf(c, model);
  if (!source) return null;
  if (source.kind === "parent") return contentAccessFamilyOf(c, source.parent);

  return source.family;
};

/**
 * Whether no access rule can change who reads this content type: it has no
 * access source, or its family is open to everyone. Only then may a public
 * response for it go into a cache shared by every viewer.
 */
export const isContentAccessOpen = async (
  c: Context,
  model: AnyContentModel,
): Promise<boolean> => {
  const family = contentAccessFamilyOf(c, model);

  return !family || (await isContentAccessFamilyOpen(c, family));
};

const NOTHING: SQL = sql`false`;

const scopeIdValues = (
  ids: readonly string[],
  numeric: boolean,
): (number | string)[] =>
  numeric ? ids.map(Number).filter(id => Number.isSafeInteger(id)) : [...ids];

const isNumericColumn = (column: PgColumn): boolean =>
  column.columnType === "PgInteger" ||
  column.columnType === "PgSerial" ||
  column.dataType === "number";

/**
 * The `WHERE` condition that keeps only the records of `model` that `actor`
 * may perform `action` on, or `undefined` when every record qualifies. Built
 * from the scopes' current rules and tree, so it is the same check whatever
 * reads the table: lists before pagination, single reads, counts and joins.
 * Server-only.
 */
export const contentAccessCondition = async (
  c: Context,
  model: AnyContentModel,
  action: ContentAccessAction,
  actor?: ContentAccessActor,
): Promise<SQL | undefined> => {
  const source = contentAccessSourceOf(c, model);
  if (!source) return undefined;
  const who = actor ?? (await resolveContentAccessActor(c));
  if (who.kind === "member" && who.root) return undefined;

  if (source.kind === "parent") {
    const parentCondition = await contentAccessCondition(
      c,
      source.parent,
      action,
      who,
    );
    if (!parentCondition) return undefined;

    const parentColumns = source.parent.columns as Record<string, PgColumn>;
    const parentTable: PgTable = source.parent.table;

    return or(
      isNull(source.column),
      inArray(
        source.column,
        c
          .get("db")
          .select({ id: parentColumns.id })
          .from(parentTable)
          .where(parentCondition),
      ),
    );
  }

  const allowed = await contentAccessAllowedScopes(c, {
    action,
    actor: who,
    family: source.family,
  });
  if (allowed.all) return undefined;

  if (source.kind === "scopes" && source.junction) {
    const { itemId, relatedItemId, table } = source.junction;
    const columns = model.columns as Record<string, PgColumn>;
    const values = scopeIdValues(allowed.ids, isNumericColumn(relatedItemId));
    const blocked =
      values.length === 0
        ? undefined
        : notInArray(relatedItemId, values as never[]);

    // Allowed by every scope it points at: no junction row names a scope
    // outside the allowed set.
    return not(
      sql`exists (select 1 from ${table} where ${and(
        eq(itemId, columns.id),
        blocked,
      )})`,
    );
  }

  const column = source.column;
  if (!column) return NOTHING;
  const values = scopeIdValues(allowed.ids, isNumericColumn(column));

  return values.length === 0
    ? isNull(column)
    : or(isNull(column), inArray(column, values as never[]));
};

/**
 * The scopes each of `ids` currently belongs to, read from the database. A
 * record missing from the result does not exist; one with an empty list has
 * no scope and is open.
 */
export const contentRecordAccessScopes = async (
  c: Context,
  model: AnyContentModel,
  ids: readonly ContentId[],
): Promise<Map<string, ContentAccessScopeRef[]>> => {
  const result = new Map<string, ContentAccessScopeRef[]>();
  if (ids.length === 0) return result;

  const source = contentAccessSourceOf(c, model);
  const columns = model.columns as Record<string, PgColumn>;
  const table: PgTable = model.table;
  const db = c.get("db");

  if (!source) {
    const rows = await db
      .select({ id: columns.id })
      .from(table)
      .where(inArray(columns.id, [...ids]));
    for (const row of rows) result.set(contentIdKey(row.id as ContentId), []);

    return result;
  }

  if (source.kind === "scopes" && source.junction) {
    const rows = await db
      .select({ id: columns.id })
      .from(table)
      .where(inArray(columns.id, [...ids]));
    for (const row of rows) result.set(contentIdKey(row.id as ContentId), []);

    const links = await db
      .select({
        itemId: source.junction.itemId,
        relatedItemId: source.junction.relatedItemId,
      })
      .from(source.junction.table)
      .where(inArray(source.junction.itemId, [...ids]));
    for (const link of links) {
      const key = contentIdKey(link.itemId as ContentId);
      result.get(key)?.push({
        family: source.family.id,
        scopeId: String(link.relatedItemId),
      });
    }

    return result;
  }

  const column = source.column;
  if (!column) return result;
  const rows = await db
    .select({ id: columns.id, value: column })
    .from(table)
    .where(inArray(columns.id, [...ids]));

  if (source.kind === "parent") {
    const parentIds = [
      ...new Map(
        rows
          .map(row => row.value)
          .filter(
            (value): value is number | string =>
              typeof value === "number" || typeof value === "string",
          )
          .map(value => [contentIdKey(value), value]),
      ).values(),
    ];
    const parents = await contentRecordAccessScopes(
      c,
      source.parent,
      parentIds,
    );
    for (const row of rows) {
      const value = row.value;
      const key = contentIdKey(row.id as ContentId);
      if (value === null || value === undefined) {
        result.set(key, []);
        continue;
      }
      const scopes = parents.get(contentIdKey(value as ContentId));
      // A parent that no longer exists resolves to nothing - never to "open".
      result.set(
        key,
        scopes ?? [
          {
            family: "",
            scopeId: `missing:${contentIdKey(value as ContentId)}`,
          },
        ],
      );
    }

    return result;
  }

  for (const row of rows) {
    const value = row.value;
    result.set(
      contentIdKey(row.id as ContentId),
      value === null || value === undefined
        ? []
        : [
            {
              family: source.family.id,
              scopeId: contentIdKey(value as ContentId),
            },
          ],
    );
  }

  return result;
};

/**
 * The scopes a record would belong to if `values` were written: the container
 * or scope ids in the payload, or the scopes of the parent it names. The
 * caller passes values it already validated; nothing here trusts a client's
 * claim about scopes beyond the ids, which are resolved on the server.
 */
export const contentAccessScopesForValues = async (
  c: Context,
  model: AnyContentModel,
  values: Record<string, unknown>,
): Promise<ContentAccessScopeRef[] | null> => {
  const source = contentAccessSourceOf(c, model);
  if (!source) return [];

  const value = values[source.field];
  if (value === undefined || value === null) return [];

  if (source.kind === "parent") {
    if (typeof value !== "number" && typeof value !== "string") return null;
    const parents = await contentRecordAccessScopes(c, source.parent, [value]);

    return parents.get(contentIdKey(value)) ?? null;
  }

  const ids = Array.isArray(value) ? value : [value];

  return ids.map(id => ({
    family: source.family.id,
    scopeId: String(
      typeof id === "object" && id !== null && "id" in id
        ? (id as { id: unknown }).id
        : id,
    ),
  }));
};

/**
 * {@link contentAccessCondition} for a content type by its definition, through
 * the model the app registered for it. The public read services call this on
 * every read.
 */
export const contentPublicAccessCondition = async (
  c: Context,
  definition: Pick<AnyContentTypeDefinition, "id">,
  {
    action = "read",
    actor,
  }: { action?: ContentAccessAction; actor?: ContentAccessActor } = {},
): Promise<SQL | undefined> => {
  const model = modelById(c, definition.id);
  if (!model) return undefined;

  return await contentAccessCondition(c, model, action, actor);
};
