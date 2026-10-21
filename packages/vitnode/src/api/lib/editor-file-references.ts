import type { Context } from "hono";

import { getColumns, type SQL, sql } from "drizzle-orm";
import { type PgColumn, PgTable } from "drizzle-orm/pg-core";

import type { AnyContentTypeDefinition } from "@/content/types";

import { contentPublicItemTag, contentPublicListTag } from "@/content/cache";
import { contentLiveFileDeleted } from "@/content/server/live/hooks";
import {
  type AnyContentModel,
  contentDefinitionOf,
} from "@/content/server/model";
import { bumpContentPublicGeneration } from "@/content/server/public-cache";
import { core_content_revisions } from "@/database/content";
import { core_content_drafts } from "@/database/content-drafts";
import { invalidatePageCacheTags } from "@/page-cache/store.server";

const UPLOAD_NODE_TYPES: ReadonlySet<string> = new Set(["attachment", "image"]);

const FILE_REFERENCE_PATH = "$.** ? (@.attrs.fileId == $fileId)";

const DELETED_ATTRS = {
  deleted: true,
  fileId: null,
  naturalHeight: null,
  naturalWidth: null,
  src: null,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const markEditorFileDeleted = (value: unknown, fileId: number): unknown => {
  if (Array.isArray(value)) {
    return value.map(item => markEditorFileDeleted(item, fileId));
  }
  if (!isRecord(value)) return value;

  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    next[key] = markEditorFileDeleted(child, fileId);
  }

  const { attrs, type } = value;
  if (
    typeof type === "string" &&
    UPLOAD_NODE_TYPES.has(type) &&
    isRecord(attrs) &&
    attrs.fileId === fileId
  ) {
    next.attrs = { ...attrs, ...DELETED_ATTRS };
  }

  return next;
};

const referencesFile = (column: PgColumn, fileId: number): SQL =>
  sql`jsonb_path_exists(${column}, ${FILE_REFERENCE_PATH}::jsonpath, jsonb_build_object('fileId', ${fileId}::integer))`;

const jsonbColumnsOf = (table: PgTable): PgColumn[] =>
  Object.values(getColumns(table)).filter(
    column => column.getSQLType() === "jsonb",
  );

const releaseInTable = async (
  c: Context,
  {
    fileId,
    recordIdColumn,
    table,
  }: { fileId: number; recordIdColumn?: PgColumn; table: PgTable },
): Promise<Set<string>> => {
  const db = c.get("db");
  const recordIds = new Set<string>();

  for (const column of jsonbColumnsOf(table)) {
    const rows = await db
      .select({
        ctid: sql<string>`ctid::text`,
        document: column,
        recordId:
          recordIdColumn === undefined
            ? sql<null>`null`
            : sql<string>`${recordIdColumn}::text`,
      })
      .from(table)
      .where(referencesFile(column, fileId));

    for (const row of rows) {
      await db.execute(
        sql`UPDATE ${table} SET ${sql.identifier(column.name)} = ${JSON.stringify(
          markEditorFileDeleted(row.document, fileId),
        )}::jsonb WHERE ctid = ${row.ctid}::tid`,
      );
      if (row.recordId !== null) recordIds.add(row.recordId);
    }
  }

  return recordIds;
};

const tablesOf = (
  model: AnyContentModel,
): { recordIdColumn: PgColumn | undefined; table: PgTable }[] => {
  const withItemId = (table: PgTable) => ({
    recordIdColumn: getColumns(table).itemId,
    table,
  });

  return [
    { recordIdColumn: getColumns(model.table).id, table: model.table },
    ...(model.translationTable instanceof PgTable
      ? [withItemId(model.translationTable)]
      : []),
    ...Object.values(model.advancedTables.repeatables).flatMap(table =>
      table instanceof PgTable ? [withItemId(table)] : [],
    ),
  ];
};

const expireContentReads = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  recordIds: Set<string>,
): Promise<void> => {
  await Promise.all([
    invalidatePageCacheTags(
      [
        contentPublicListTag(definition.id),
        ...[...recordIds].map(id => contentPublicItemTag(definition.id, id)),
      ],
      { mode: "hard" },
    ),
    bumpContentPublicGeneration(c, definition.id),
  ]);
};

const rewriteEditorFileReferences = async (
  c: Context,
  fileId: number,
): Promise<void> => {
  for (const { model } of c.get("core")?.contentModels ?? []) {
    const recordIds = new Set<string>();
    for (const { recordIdColumn, table } of tablesOf(model)) {
      const ids = await releaseInTable(c, { fileId, recordIdColumn, table });
      for (const id of ids) recordIds.add(id);
    }

    if (recordIds.size > 0) {
      await expireContentReads(c, contentDefinitionOf(model), recordIds);
    }
  }

  for (const table of [core_content_revisions, core_content_drafts]) {
    await releaseInTable(c, { fileId, table });
  }

  await contentLiveFileDeleted(c, fileId);
};

/**
 * After a file is deleted, replaces every image or attachment that pointed at
 * it in Content Engine rich text (records, translations, repeatable rows,
 * revision snapshots, live-editing drafts and live documents) with a
 * "deleted" placeholder, then expires the cached reads of each content type
 * it touched. Best-effort: the file is already gone, so a failure is logged
 * rather than thrown. Server-only.
 */
export const releaseEditorFileReferences = async (
  c: Context,
  fileId: number,
): Promise<void> => {
  try {
    await rewriteEditorFileReferences(c, fileId);
  } catch (error) {
    await c
      .get("log")
      .error(
        `[editor-files] File ${fileId} was deleted, but the documents that show it could not be updated: ${error instanceof Error ? error.message : String(error)}`,
      );
  }
};
