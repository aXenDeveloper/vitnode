import type { SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import {
  and,
  asc,
  eq,
  getColumnTable,
  getTableName,
  inArray,
  sql,
} from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";

import type { AnyContentTypeDefinition, ContentRelationFilter } from "../types";
import type { ContentDatabase } from "./service";
import type { ContentAdvancedTables } from "./types";

import {
  CONTENT_ADVANCED_CODES,
  CONTENT_COLLECTION_FIRST_POSITION,
} from "../const";
import { ContentAdvancedInputError, ContentEngineError } from "../errors";
import {
  asContentReferenceCollection,
  contentInnerFields,
  isContentCollectionField,
} from "../paths";
import { toColumnValues } from "./query";

/** One repeatable child, as it is written back. */
type ChildValues = Record<string, unknown>;

export interface ContentAdvancedStore {
  diff: (
    tx: ContentDatabase,
    itemId: number,
    patch: Record<string, unknown>,
  ) => Promise<string[]>;
  /** Whether the content type declares any advanced collection at all. */
  readonly enabled: boolean;
  /** The collection field names, in declaration order. */
  readonly fields: string[];

  load: (
    itemId: number,
    database: ContentDatabase,
    only?: readonly string[],
  ) => Promise<Record<string, unknown>>;

  loadMany: (
    itemIds: readonly number[],
    database: ContentDatabase,
    only?: readonly string[],
  ) => Promise<Map<number, Record<string, unknown>>>;

  membershipCondition: (
    field: string,
    filter: ContentRelationFilter,
  ) => SQL | undefined;

  prepareRestore: (
    tx: ContentDatabase,
    itemId: number,
    patch: Record<string, unknown>,
  ) => Promise<{
    missingRelations: { field: string; ids: number[] }[];
    patch: Record<string, unknown>;
  }>;

  targetTable: (field: string) => null | PgTable;
  /** Applies a patch's collection half. Returns the fields that moved. */
  write: (
    tx: ContentDatabase,
    itemId: number,
    patch: Record<string, unknown>,
  ) => Promise<string[]>;
}

/** The row shape a relation's junction table holds, in write order. */
interface JunctionRow {
  createdAt?: Date;
  relatedItemId: number;
}

const sameJunction = (
  current: readonly JunctionRow[],
  desired: readonly number[],
): boolean =>
  current.length === desired.length &&
  current.every((row, index) => row.relatedItemId === desired[index]);

const normalizeTargets = (
  ids: readonly number[],
  ordered: boolean,
): number[] => (ordered ? [...ids] : [...ids].sort((a, b) => a - b));

const sameChildValues = (
  leaves: readonly string[],
  current: ChildValues,
  desired: ChildValues,
): boolean =>
  leaves.every(leaf => {
    const before = current[leaf];
    const after = desired[leaf];

    if (before instanceof Date) {
      return (
        after !== null &&
        after !== undefined &&
        before.getTime() === new Date(after as string).getTime()
      );
    }

    return before === after;
  });

export const createContentAdvancedStore = <
  TDefinition extends AnyContentTypeDefinition,
>({
  definition,
  table,
  tables,
}: {
  definition: TDefinition;
  table: PgTable;
  tables: ContentAdvancedTables;
}): ContentAdvancedStore => {
  const contentTypeId = definition.id;
  const fields = definition.fields;
  const collectionNames = Object.keys(fields).filter(name =>
    isContentCollectionField(fields[name]),
  );
  const baseColumns = table as unknown as Record<string, PgColumn>;

  const junctionOf = (
    field: string,
  ): null | { columns: Record<string, PgColumn>; table: PgTable } => {
    const junction = tables.junctions[field];
    if (!junction) return null;

    return {
      columns: junction as unknown as Record<string, PgColumn>,
      table: junction as unknown as PgTable,
    };
  };

  const childOf = (
    field: string,
  ): null | { columns: Record<string, PgColumn>; table: PgTable } => {
    const child = tables.repeatables[field];
    if (!child) return null;

    return {
      columns: child as unknown as Record<string, PgColumn>,
      table: child as unknown as PgTable,
    };
  };

  const leafNamesOf = (field: string): string[] =>
    Object.keys(contentInnerFields(fields[field]));

  const targetColumns = new Map<string, null | PgColumn>();
  const relationTargetColumn = (field: string): null | PgColumn => {
    const cached = targetColumns.get(field);
    if (cached !== undefined) return cached;

    const junction = tables.junctions[field];
    const resolved = junction
      ? (getTableConfig(junction as unknown as PgTable)
          .foreignKeys.map(foreignKey => foreignKey.reference())
          // Drizzle is configured with no `casing` transform, so a column is
          // named by its object key on both sides - `relatedItemId` here and
          // `relatedItemId` in SQL.
          .find(reference =>
            reference.columns.some(column => column.name === "relatedItemId"),
          )?.foreignColumns[0] ?? null)
      : null;

    targetColumns.set(field, resolved);

    return resolved;
  };

  const assertTargetsExist = async (
    tx: ContentDatabase,
    field: string,
    ids: readonly number[],
  ): Promise<void> => {
    if (ids.length === 0) return;

    const target = relationTargetColumn(field);
    if (!target) return;

    const rows = await tx
      .select({ id: target })
      .from(getColumnTable(target))
      .where(inArray(target, [...ids]));

    const found = new Set(rows.map(row => Number(row.id)));
    const missing = ids.filter(id => !found.has(id));
    if (missing.length === 0) return;

    // The noun follows the kind, because the two mean different things to
    // whoever reads the message: a missing relation target is another record
    // somebody deleted, and a missing gallery entry is a stored file that is
    // gone. `assertContentFileReferences` normally answers first for a file
    // field - this is the net under it, and under a direct service call.
    const isFile = fields[field].kind === "file";
    const noun = isFile
      ? missing.length === 1
        ? "a file"
        : "files"
      : missing.length === 1
        ? "a record"
        : "records";

    throw new ContentAdvancedInputError({
      code: CONTENT_ADVANCED_CODES.missingTarget,
      contentTypeId,
      field,
      ids: missing,
      message: `${isFile ? "File field" : "Relation"} "${field}" references ${noun} that no longer exist: ${missing.join(", ")}.`,
    });
  };

  const readJunction = async (
    field: string,
    itemIds: readonly number[],
    database: ContentDatabase,
  ): Promise<Map<number, JunctionRow[]>> => {
    const junction = junctionOf(field);
    const result = new Map<number, JunctionRow[]>();
    if (!junction || itemIds.length === 0) return result;

    const rows = await database
      .select({
        createdAt: junction.columns.createdAt,
        itemId: junction.columns.itemId,
        relatedItemId: junction.columns.relatedItemId,
      })
      .from(junction.table)
      .where(inArray(junction.columns.itemId, [...itemIds]))
      .orderBy(asc(junction.columns.itemId), asc(junction.columns.position));

    for (const row of rows) {
      const itemId = Number(row.itemId);
      const list = result.get(itemId) ?? [];
      list.push({
        createdAt: row.createdAt instanceof Date ? row.createdAt : undefined,
        relatedItemId: Number(row.relatedItemId),
      });
      result.set(itemId, list);
    }

    return result;
  };

  const readChildren = async (
    field: string,
    itemIds: readonly number[],
    database: ContentDatabase,
  ): Promise<Map<number, ChildValues[]>> => {
    const child = childOf(field);
    const result = new Map<number, ChildValues[]>();
    if (!child || itemIds.length === 0) return result;

    const leaves = leafNamesOf(field);
    const rows = await database
      .select({
        id: child.columns.id,
        itemId: child.columns.itemId,
        ...Object.fromEntries(leaves.map(leaf => [leaf, child.columns[leaf]])),
      })
      .from(child.table)
      .where(inArray(child.columns.itemId, [...itemIds]))
      .orderBy(asc(child.columns.itemId), asc(child.columns.position));

    for (const row of rows) {
      const values = row as ChildValues;
      const itemId = Number(values.itemId);
      const list = result.get(itemId) ?? [];
      list.push({
        id: Number(values.id),
        ...Object.fromEntries(leaves.map(leaf => [leaf, values[leaf]])),
      });
      result.set(itemId, list);
    }

    return result;
  };

  /**
   * Rewrites one collection's rows to exactly `desired`, in two passes.
   *
   * The passes exist because of `UNIQUE (itemId, position)`: moving row A from
   * slot 0 to slot 1 while row B still sits in slot 1 violates it *during* the
   * statement even though the final state is fine. So every surviving row is
   * first parked at a negative slot - a space no settled row ever occupies - and
   * a single final `UPDATE` maps the whole set back to `0..n-1` at once. No
   * deferrable constraint, no delete-and-recreate, and identity survives.
   */
  const settlePositions = async (
    tx: ContentDatabase,
    target: { columns: Record<string, PgColumn>; table: PgTable },
    itemId: number,
  ): Promise<void> => {
    await tx
      .update(target.table)
      .set({ position: sql`-${target.columns.position} - 1` })
      .where(eq(target.columns.itemId, itemId));
  };

  const parked = (index: number): number =>
    -(index - CONTENT_COLLECTION_FIRST_POSITION + 1);

  const writeRelation = async (
    tx: ContentDatabase,
    field: string,
    itemId: number,
    desired: readonly number[],
  ): Promise<void> => {
    const junction = junctionOf(field);
    if (!junction) return;

    const current = (await readJunction(field, [itemId], tx)).get(itemId) ?? [];
    const keep = new Set(desired);
    const removed = current
      .filter(row => !keep.has(row.relatedItemId))
      .map(row => row.relatedItemId);

    if (removed.length > 0) {
      await tx
        .delete(junction.table)
        .where(
          and(
            eq(junction.columns.itemId, itemId),
            inArray(junction.columns.relatedItemId, removed),
          ),
        );
    }

    const existing = new Set(
      current
        .filter(row => keep.has(row.relatedItemId))
        .map(row => row.relatedItemId),
    );

    for (const [index, relatedItemId] of desired.entries()) {
      if (!existing.has(relatedItemId)) continue;

      await tx
        .update(junction.table)
        .set({ position: parked(index) })
        .where(
          and(
            eq(junction.columns.itemId, itemId),
            eq(junction.columns.relatedItemId, relatedItemId),
          ),
        );
    }

    const inserted = desired
      .map((relatedItemId, index) => ({ index, relatedItemId }))
      .filter(entry => !existing.has(entry.relatedItemId));

    if (inserted.length > 0) {
      await tx.insert(junction.table).values(
        inserted.map(entry => ({
          itemId,
          position: parked(entry.index),
          relatedItemId: entry.relatedItemId,
        })),
      );
    }

    if (desired.length > 0) await settlePositions(tx, junction, itemId);
  };

  const writeRepeatable = async (
    tx: ContentDatabase,
    field: string,
    itemId: number,
    desired: readonly ChildValues[],
  ): Promise<void> => {
    const child = childOf(field);
    if (!child) return;

    const leaves = leafNamesOf(field);
    const inner = contentInnerFields(fields[field]);
    const current = (await readChildren(field, [itemId], tx)).get(itemId) ?? [];
    const currentIds = new Set(current.map(row => Number(row.id)));

    // A child id the caller sent that does not belong to this record is a
    // mistake worth naming: silently creating a new row instead would look like
    // it worked and quietly duplicate the entry the caller meant to edit.
    const claimed = desired
      .map(row => row.id)
      .filter((id): id is number => typeof id === "number");
    const foreign = claimed.filter(id => !currentIds.has(id));
    if (foreign.length > 0) {
      throw new ContentAdvancedInputError({
        code: CONTENT_ADVANCED_CODES.missingChild,
        contentTypeId,
        field,
        ids: foreign,
        message: `Repeatable "${field}" was sent ${foreign.length === 1 ? "an entry" : "entries"} that do not belong to this record: ${foreign.join(", ")}. Omit \`id\` to add a new entry.`,
      });
    }

    const keep = new Set(claimed);
    const removed = [...currentIds].filter(id => !keep.has(id));
    if (removed.length > 0) {
      await tx
        .delete(child.table)
        .where(
          and(
            eq(child.columns.itemId, itemId),
            inArray(child.columns.id, removed),
          ),
        );
    }

    for (const [index, row] of desired.entries()) {
      const values = toColumnValues(
        inner,
        Object.fromEntries(leaves.map(leaf => [leaf, row[leaf] ?? null])),
      );

      if (typeof row.id === "number") {
        await tx
          .update(child.table)
          .set({ ...values, position: parked(index) })
          .where(
            and(eq(child.columns.itemId, itemId), eq(child.columns.id, row.id)),
          );
        continue;
      }

      await tx
        .insert(child.table)
        .values({ ...values, itemId, position: parked(index) });
    }

    if (desired.length > 0) await settlePositions(tx, child, itemId);
  };

  const plan = async (
    tx: ContentDatabase,
    itemId: number,
    patch: Record<string, unknown>,
  ): Promise<
    { desired: unknown; field: string; kind: "relation" | "repeatable" }[]
  > => {
    const changes: {
      desired: unknown;
      field: string;
      kind: "relation" | "repeatable";
    }[] = [];

    for (const field of collectionNames) {
      const value = patch[field];
      if (value === undefined) continue;

      const relation = asContentReferenceCollection(fields[field]);
      if (relation) {
        if (!Array.isArray(value)) continue;

        const desired = normalizeTargets(value as number[], relation.ordered);
        const current =
          (await readJunction(field, [itemId], tx)).get(itemId) ?? [];

        if (sameJunction(current, desired)) continue;

        changes.push({ desired, field, kind: "relation" });
        continue;
      }

      if (fields[field].kind !== "repeatable") continue;
      if (!Array.isArray(value)) continue;

      const desired = value as ChildValues[];
      const current =
        (await readChildren(field, [itemId], tx)).get(itemId) ?? [];
      const leaves = leafNamesOf(field);

      const unchanged =
        current.length === desired.length &&
        current.every((row, index) => {
          const next = desired[index];
          // Identity first: two entries that swapped places have moved even if
          // every value is identical, and an entry with no `id` is new whatever
          // it holds.
          if (next.id !== row.id) return false;

          return sameChildValues(leaves, row, next);
        });

      if (unchanged) continue;

      changes.push({ desired, field, kind: "repeatable" });
    }

    return changes;
  };

  const selected = (only?: readonly string[]): string[] =>
    only === undefined
      ? collectionNames
      : collectionNames.filter(field => only.includes(field));

  const enabled = collectionNames.length > 0;

  // Every method a no-op, so a content type with no advanced collection can be
  // handed the same object every other one gets and pay for nothing.
  const disabled: ContentAdvancedStore = {
    diff: async () => Promise.resolve([]),
    enabled: false,
    fields: [],
    load: async () => Promise.resolve({}),
    loadMany: async () => Promise.resolve(new Map()),
    membershipCondition: () => undefined,
    prepareRestore: async (_tx, _itemId, patch) =>
      Promise.resolve({ missingRelations: [], patch }),
    targetTable: () => null,
    write: async () => Promise.resolve([]),
  };

  if (!enabled) return disabled;

  return {
    diff: async (tx, itemId, patch) =>
      (await plan(tx, itemId, patch)).map(change => change.field),

    enabled,

    fields: collectionNames,

    load: async (itemId, database, only) => {
      const loaded = await Promise.all(
        selected(only).map(async field => {
          if (tables.junctions[field]) {
            const rows =
              (await readJunction(field, [itemId], database)).get(itemId) ?? [];

            return [field, rows.map(row => row.relatedItemId)] as const;
          }

          const rows =
            (await readChildren(field, [itemId], database)).get(itemId) ?? [];

          return [field, rows] as const;
        }),
      );

      return Object.fromEntries(loaded);
    },

    loadMany: async (itemIds, database, only) => {
      const wanted = selected(only);
      const result = new Map<number, Record<string, unknown>>();
      for (const itemId of itemIds) {
        result.set(
          itemId,
          Object.fromEntries(wanted.map(field => [field, []])),
        );
      }
      if (itemIds.length === 0) return result;

      for (const field of wanted) {
        if (tables.junctions[field]) {
          const rows = await readJunction(field, itemIds, database);
          for (const [itemId, list] of rows) {
            const entry = result.get(itemId);
            if (!entry) continue;
            entry[field] = list.map(row => row.relatedItemId);
          }
          continue;
        }

        const rows = await readChildren(field, itemIds, database);
        for (const [itemId, list] of rows) {
          const entry = result.get(itemId);
          if (!entry) continue;
          entry[field] = list;
        }
      }

      return result;
    },

    prepareRestore: async (tx, itemId, patch) => {
      const prepared: Record<string, unknown> = { ...patch };
      const missingRelations: { field: string; ids: number[] }[] = [];

      for (const field of collectionNames) {
        const value = prepared[field];
        if (!Array.isArray(value)) continue;

        if (tables.junctions[field]) {
          const ids = (value as number[]).filter(id => Number.isInteger(id));
          const target = relationTargetColumn(field);
          if (!target || ids.length === 0) continue;

          const rows = await tx
            .select({ id: target })
            .from(getColumnTable(target))
            .where(inArray(target, ids));
          const found = new Set(rows.map(row => Number(row.id)));
          const missing = ids.filter(id => !found.has(id));

          if (missing.length > 0)
            missingRelations.push({ field, ids: missing });
          continue;
        }

        // A child whose identifier is gone is recreated rather than matched:
        // dropping `id` is exactly the "create a new one" branch of the write
        // protocol, so the entry comes back with its values and a fresh id.
        const current =
          (await readChildren(field, [itemId], tx)).get(itemId) ?? [];
        const known = new Set(current.map(row => Number(row.id)));

        prepared[field] = (value as ChildValues[]).map(row => {
          if (typeof row.id === "number" && known.has(row.id)) return row;

          // Dropping `id` is the "create a new one" branch of the write
          // protocol, so the entry comes back with its values and a fresh id.
          return Object.fromEntries(
            Object.entries(row).filter(([key]) => key !== "id"),
          );
        });
      }

      return { missingRelations, patch: prepared };
    },

    membershipCondition: (field, filter) => {
      const junction = junctionOf(field);
      if (!junction) {
        throw new ContentEngineError(
          `Field "${field}" is not a to-many relation, so it has no membership filter.`,
          { contentTypeId },
        );
      }

      if (!Number.isInteger(filter.contains)) return undefined;

      // Correlated, so the planner uses the junction's primary key and stops at
      // the first matching row - and the outer query needs no `DISTINCT` to keep
      // one record from appearing once per matching target.
      return sql`exists (select 1 from ${junction.table} where ${junction.columns.itemId} = ${baseColumns.id} and ${junction.columns.relatedItemId} = ${filter.contains})`;
    },

    targetTable: field => {
      const column = relationTargetColumn(field);

      return column ? getColumnTable(column) : null;
    },

    write: async (tx, itemId, patch) => {
      const changes = await plan(tx, itemId, patch);

      for (const change of changes) {
        if (change.kind === "relation") {
          const desired = change.desired as number[];
          await assertTargetsExist(tx, change.field, desired);
          await writeRelation(tx, change.field, itemId, desired);
          continue;
        }

        await writeRepeatable(
          tx,
          change.field,
          itemId,
          change.desired as ChildValues[],
        );
      }

      return changes.map(change => change.field);
    },
  };
};

/** The generated junction table's name, for diagnostics and tests. */
export const contentJunctionTableName = (
  tables: ContentAdvancedTables,
  field: string,
): null | string => {
  const junction = tables.junctions[field];

  return junction ? getTableName(junction as unknown as PgTable) : null;
};
