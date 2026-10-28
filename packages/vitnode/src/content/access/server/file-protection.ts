import type { Context } from "hono";

import { getColumns, inArray, sql } from "drizzle-orm";
import { PgTable, type PgColumn } from "drizzle-orm/pg-core";

import type { AnyContentModel } from "../../server/model";
import type { ContentFieldMap } from "../../types";

import { core_files } from "../../../database/files";
import { contentPrivateAdminFileUrl } from "./files";
import { contentModelsInAccessFamily } from "./invalidate";

/** How many files one protect request moves, so a big install takes several. */
export const CONTENT_ACCESS_PROTECT_BATCH = 100;

const jsonbColumnsOf = (table: PgTable): PgColumn[] =>
  Object.values(getColumns(table)).filter(
    column => column.getSQLType() === "jsonb",
  );

const tablesOf = (model: AnyContentModel): PgTable[] => [
  model.table as PgTable,
  ...(model.translationTable instanceof PgTable ? [model.translationTable] : []),
  ...Object.values(model.advancedTables.repeatables).flatMap(table =>
    table instanceof PgTable ? [table] : [],
  ),
];

/** Every file id the records of `model` reference: file fields and rich text. */
const fileIdsOfModel = async (
  c: Context,
  model: AnyContentModel,
): Promise<Set<number>> => {
  const db = c.get("db");
  const ids = new Set<number>();
  const add = (value: unknown) => {
    const id = Number(value);
    if (Number.isInteger(id) && id > 0) ids.add(id);
  };
  const columns = model.columns as Record<string, PgColumn>;

  for (const [name, field] of Object.entries(
    model.definition.fields as ContentFieldMap,
  )) {
    if (field.kind !== "file") continue;
    if (field.multiple) {
      const junction = (
        model.advancedTables.junctions as unknown as Record<
          string,
          undefined | Record<string, PgColumn>
        >
      )[name];
      if (!junction) continue;
      const rows = await db
        .selectDistinct({ id: junction.relatedItemId })
        .from(junction as unknown as PgTable);
      rows.forEach(row => {
        add(row.id);
      });
      continue;
    }
    const column = columns[name];
    if (!column) continue;
    const rows = await db
      .selectDistinct({ id: column })
      .from(model.table as PgTable);
    rows.forEach(row => {
      add(row.id);
    });
  }

  for (const table of tablesOf(model)) {
    for (const column of jsonbColumnsOf(table)) {
      const rows = await db
        .selectDistinct({
          id: sql<unknown>`jsonb_path_query(${column}, '$.**.attrs.fileId')`,
        })
        .from(table);
      rows.forEach(row => {
        add(row.id);
      });
    }
  }

  return ids;
};

const FILE_REFERENCE_PATH = "$.** ? (@.attrs.fileId == $fileId)";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const withFileSrc = (value: unknown, fileId: number, src: string): unknown => {
  if (Array.isArray(value)) return value.map(item => withFileSrc(item, fileId, src));
  if (!isRecord(value)) return value;

  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    next[key] = withFileSrc(child, fileId, src);
  }
  if (isRecord(value.attrs) && value.attrs.fileId === fileId) {
    next.attrs = { ...value.attrs, src };
  }

  return next;
};

/** Points every stored rich-text node of `fileId` in `model` at `src`. */
const rewriteStoredFileSrc = async (
  c: Context,
  model: AnyContentModel,
  fileId: number,
  src: string,
): Promise<void> => {
  const db = c.get("db");
  for (const table of tablesOf(model)) {
    for (const column of jsonbColumnsOf(table)) {
      const rows = await db
        .select({ ctid: sql<string>`ctid::text`, document: column })
        .from(table)
        .where(
          sql`jsonb_path_exists(${column}, ${FILE_REFERENCE_PATH}::jsonpath, jsonb_build_object('fileId', ${fileId}::integer))`,
        );
      for (const row of rows) {
        await db.execute(
          sql`UPDATE ${table} SET ${sql.identifier(column.name)} = ${JSON.stringify(
            withFileSrc(row.document, fileId, src),
          )}::jsonb WHERE ctid = ${row.ctid}::tid`,
        );
      }
    }
  }
};

export interface ContentAccessFileStatus {
  /** Files already in the private store, served only through access checks. */
  private: number;
  /** Files that still have a public URL anybody holding it can open. */
  public: number;
}

/**
 * How many files the content of one access family references, by where they
 * are stored. A scope is only as private as its files: a public one stays
 * reachable by URL whatever the rules say. Server-only.
 */
export const contentAccessFileStatus = async (
  c: Context,
  familyId: string,
): Promise<ContentAccessFileStatus> => {
  const ids = new Set<number>();
  for (const model of contentModelsInAccessFamily(c, familyId)) {
    for (const id of await fileIdsOfModel(c, model)) ids.add(id);
  }
  if (ids.size === 0) return { private: 0, public: 0 };

  const rows = await c
    .get("db")
    .select({ visibility: core_files.visibility })
    .from(core_files)
    .where(inArray(core_files.id, [...ids]));

  return {
    private: rows.filter(row => row.visibility === "private").length,
    public: rows.filter(row => row.visibility === "public").length,
  };
};

/**
 * Moves the family's public files into the private store, a batch at a time.
 * A file is moved only when nothing outside the family references it: one
 * that public content elsewhere also shows cannot become confidential, so it
 * is left alone and counted in `shared` - re-upload it where it should be
 * private. Nothing private is ever made public. Server-only.
 */
export const protectContentAccessFiles = async (
  c: Context,
  familyId: string,
): Promise<{ moved: number; remaining: number; shared: number }> => {
  const inside = contentModelsInAccessFamily(c, familyId);
  const outside = (
    (c.get("core")?.contentModels ?? []) as { model: AnyContentModel }[]
  )
    .map(entry => entry.model)
    .filter(model => !inside.includes(model));

  const ids = new Set<number>();
  for (const model of inside) {
    for (const id of await fileIdsOfModel(c, model)) ids.add(id);
  }
  const elsewhere = new Set<number>();
  for (const model of outside) {
    for (const id of await fileIdsOfModel(c, model)) elsewhere.add(id);
  }

  const candidates =
    ids.size === 0
      ? []
      : await c
          .get("db")
          .select({ id: core_files.id, visibility: core_files.visibility })
          .from(core_files)
          .where(inArray(core_files.id, [...ids]));
  const publicIds = candidates
    .filter(row => row.visibility === "public")
    .map(row => row.id);
  const shared = publicIds.filter(id => elsewhere.has(id));
  const movable = publicIds.filter(id => !elsewhere.has(id));

  const storage = c.get("storage");
  let moved = 0;
  for (const id of movable.slice(0, CONTENT_ACCESS_PROTECT_BATCH)) {
    if ((await storage.makeFilePrivate(id)) !== "moved") continue;
    moved++;
    // The documents still carry the public URL that just stopped working: the
    // AdminCP editor reads it as it is stored, so it points at the staff
    // route now. Public reads replace it with the authorized route anyway.
    for (const model of inside) {
      await rewriteStoredFileSrc(c, model, id, contentPrivateAdminFileUrl(id));
    }
  }

  return {
    moved,
    remaining: Math.max(movable.length - CONTENT_ACCESS_PROTECT_BATCH, 0),
    shared: shared.length,
  };
};
