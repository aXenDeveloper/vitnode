import type { Context } from "hono";

import { and, eq, getColumns, inArray, sql } from "drizzle-orm";
import { type PgColumn, PgTable } from "drizzle-orm/pg-core";

import type { ContentFileDescriptor } from "../../files";
import type { ContentId } from "../../ids";
import type { AnyContentModel } from "../../server/model";
import type { AnyContentTypeDefinition, ContentFieldMap } from "../../types";
import type { ContentAccessFlags } from "../policy";

import { core_files } from "../../../database/files";
import { CONFIG } from "../../../lib/config";
import { contentIdKey, parseContentId } from "../../ids";
import { CONTENT_ACCESS_OPEN_FLAGS } from "../policy";
import { contentRecordAccessFlags } from "./decide";
import { contentAccessSourceOf } from "./source";

const UPLOAD_NODE_TYPES: ReadonlySet<string> = new Set([
  "attachment",
  "audio",
  "image",
]);

const FILE_REFERENCE_PATH = "$.** ? (@.attrs.fileId == $fileId)";

interface FileFacts {
  isImage: boolean;
  visibility: "private" | "public";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const positiveId = (value: unknown): null | number =>
  typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;

/** Every `attrs.fileId` a rich-text document names. */
const richTextFileIds = (value: unknown, into: Set<number>): void => {
  if (Array.isArray(value)) {
    for (const item of value) richTextFileIds(item, into);

    return;
  }
  if (!isRecord(value)) return;
  if (
    typeof value.type === "string" &&
    UPLOAD_NODE_TYPES.has(value.type) &&
    isRecord(value.attrs)
  ) {
    const id = positiveId(value.attrs.fileId);
    if (id !== null) into.add(id);
  }
  if (Array.isArray(value.content)) richTextFileIds(value.content, into);
};

const registeredOf = (
  c: Context,
  contentTypeId: string,
): undefined | { model: AnyContentModel; pluginId: string } =>
  (
    (c.get("core")?.contentModels ?? []) as {
      model: AnyContentModel;
      pluginId: string;
    }[]
  ).find(entry => entry.model.definition.id === contentTypeId);

/**
 * The URL a protected file is served from: the content type's own download
 * route, which checks the reader's access to the record every time. The same
 * for every reader, so a response carrying it may still be cached where the
 * rest of it allows.
 */
export const contentProtectedFileUrl = ({
  fileId,
  itemId,
  pluginId,
  publicPath,
}: {
  fileId: number;
  itemId: ContentId;
  pluginId: string;
  publicPath: string;
}): string =>
  `${CONFIG.api.origin.replace(/\/$/, "")}/api/${pluginId}/content/${publicPath}/${encodeURIComponent(contentIdKey(itemId))}/files/${fileId}`;

const readFileFacts = async (
  c: Context,
  ids: readonly number[],
): Promise<Map<number, FileFacts>> => {
  if (ids.length === 0) return new Map();
  const rows = await c
    .get("db")
    .select({
      id: core_files.id,
      mimeType: core_files.mimeType,
      visibility: core_files.visibility,
    })
    .from(core_files)
    .where(inArray(core_files.id, [...ids]));

  return new Map(
    rows.map(row => [
      row.id,
      {
        isImage: row.mimeType?.startsWith("image/") === true,
        visibility: row.visibility,
      },
    ]),
  );
};

/**
 * Rewrites the files of public rows for the reader: a private file's URL
 * becomes the authorized download route, and an attachment (anything but an
 * image) the reader may not download loses its name, size and link - in file
 * fields and in rich-text documents alike. Images follow `read`; a reader
 * who can read the record sees them, and can save what they see.
 *
 * Runs on every public read after the file descriptors are resolved.
 * Server-only.
 */
export const protectContentPublicRowFiles = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> => {
  if (!definition.publicApi.enabled || rows.length === 0) return rows;
  const registered = registeredOf(c, definition.id);
  if (!registered) return rows;

  const exposed = new Set(definition.publicApi.fields);
  const fileFields = Object.entries(definition.fields)
    .filter(([name, field]) => field.kind === "file" && exposed.has(name))
    .map(([name]) => name);
  const richFields = Object.entries(definition.fields)
    .filter(([name, field]) => field.kind === "richText" && exposed.has(name))
    .map(([name]) => name);
  if (fileFields.length === 0 && richFields.length === 0) return rows;

  const ids = new Set<number>();
  for (const row of rows) {
    for (const name of fileFields) {
      const value = row[name];
      for (const item of Array.isArray(value) ? value : [value]) {
        const id = positiveId(isRecord(item) ? item.id : item);
        if (id !== null) ids.add(id);
      }
    }
    for (const name of richFields) richTextFileIds(row[name], ids);
  }
  if (ids.size === 0) return rows;

  const facts = await readFileFacts(c, [...ids]);
  const hasAccess = contentAccessSourceOf(c, registered.model) !== null;
  const rowIds = rows.flatMap(row => {
    const id = parseContentId(definition.idStrategy, row.id);

    return id === null ? [] : [id];
  });
  const flags: Map<string, ContentAccessFlags> = hasAccess
    ? await contentRecordAccessFlags(c, registered.model, rowIds)
    : new Map();

  return rows.map(row => {
    const itemId = parseContentId(definition.idStrategy, row.id);
    const rowFlags =
      itemId === null
        ? CONTENT_ACCESS_OPEN_FLAGS
        : (flags.get(contentIdKey(itemId)) ?? CONTENT_ACCESS_OPEN_FLAGS);
    const urlOf = (fileId: number): string =>
      itemId === null
        ? ""
        : contentProtectedFileUrl({
            fileId,
            itemId,
            pluginId: registered.pluginId,
            publicPath: definition.publicApi.path,
          });

    const fixDescriptor = (descriptor: unknown): unknown => {
      if (!isRecord(descriptor)) return descriptor;
      const id = positiveId(descriptor.id);
      const fact = id === null ? undefined : facts.get(id);
      if (!fact || id === null) return descriptor;

      if (!fact.isImage && !rowFlags.canDownloadAttachments) {
        return {
          id,
          mimeType: null,
          name: "",
          restricted: true,
          size: 0,
          url: "",
        } satisfies ContentFileDescriptor;
      }

      return fact.visibility === "private"
        ? { ...descriptor, url: urlOf(id) }
        : descriptor;
    };

    const fixNode = (node: unknown): unknown => {
      if (Array.isArray(node)) return node.map(fixNode);
      if (!isRecord(node)) return node;

      const next: Record<string, unknown> = { ...node };
      if (Array.isArray(node.content)) next.content = node.content.map(fixNode);

      if (
        typeof node.type !== "string" ||
        !UPLOAD_NODE_TYPES.has(node.type) ||
        !isRecord(node.attrs)
      ) {
        return next;
      }
      const id = positiveId(node.attrs.fileId);
      const fact = id === null ? undefined : facts.get(id);
      if (!fact || id === null) return next;

      if (node.type !== "image" && !rowFlags.canDownloadAttachments) {
        next.attrs = {
          fileId: null,
          mimeType: null,
          name: null,
          restricted: true,
          size: null,
          src: null,
        };
        next.type = "attachment";

        return next;
      }
      if (fact.visibility === "private") {
        next.attrs = { ...node.attrs, src: urlOf(id) };
      }

      return next;
    };

    const patched: Record<string, unknown> = { ...row };
    for (const name of fileFields) {
      const value = row[name];
      patched[name] = Array.isArray(value)
        ? value.map(fixDescriptor)
        : fixDescriptor(value);
    }
    for (const name of richFields) patched[name] = fixNode(row[name]);

    return patched;
  });
};

const jsonbColumnsOf = (table: PgTable): PgColumn[] =>
  Object.values(getColumns(table)).filter(
    column => column.getSQLType() === "jsonb",
  );

/**
 * Whether `fileId` belongs to the record: one of its file fields holds it, or
 * one of its rich-text documents (any language, any repeatable row) names it.
 * A file id a client sends never proves anything on its own.
 */
export const contentRecordHasFile = async (
  c: Context,
  model: AnyContentModel,
  itemId: ContentId,
  fileId: number,
): Promise<boolean> => {
  const db = c.get("db");
  const { definition } = model;
  const columns = model.columns as Record<string, PgColumn>;
  const table: PgTable = model.table;

  for (const [name, field] of Object.entries(
    definition.fields as ContentFieldMap,
  )) {
    if (field.kind !== "file") continue;
    if (field.multiple) {
      const junction = (
        model.advancedTables.junctions as unknown as Record<
          string,
          Record<string, PgColumn> | undefined
        >
      )[name];
      if (!junction) continue;
      const [row] = await db
        .select({ one: sql`1` })
        .from(junction as unknown as PgTable)
        .where(
          and(eq(junction.itemId, itemId), eq(junction.relatedItemId, fileId)),
        )
        .limit(1);
      if (row) return true;
      continue;
    }

    const column = columns[name];
    if (!column) continue;
    const [row] = await db
      .select({ one: sql`1` })
      .from(table)
      .where(and(eq(columns.id, itemId), eq(column, fileId)))
      .limit(1);
    if (row) return true;
  }

  const references = (column: PgColumn) =>
    sql`jsonb_path_exists(${column}, ${FILE_REFERENCE_PATH}::jsonpath, jsonb_build_object('fileId', ${fileId}::integer))`;
  const tables: { idColumn: PgColumn; table: PgTable }[] = [
    { idColumn: columns.id, table },
    ...(model.translationTable instanceof PgTable
      ? [
          {
            idColumn: getColumns(model.translationTable).itemId,
            table: model.translationTable,
          },
        ]
      : []),
    ...Object.values(model.advancedTables.repeatables).flatMap(child =>
      child instanceof PgTable
        ? [{ idColumn: getColumns(child).itemId, table: child }]
        : [],
    ),
  ];
  for (const { idColumn, table: source } of tables) {
    if (!idColumn) continue;
    for (const column of jsonbColumnsOf(source)) {
      const [row] = await db
        .select({ one: sql`1` })
        .from(source)
        .where(and(eq(idColumn, itemId), references(column)))
        .limit(1);
      if (row) return true;
    }
  }

  return false;
};

/**
 * Whether new files of this content type are stored privately: it has access
 * rules and the storage adapter can keep files private. Existing files stay
 * where they are until an administrator protects them.
 */
export const contentUploadVisibility = (
  c: Context,
  model: AnyContentModel,
): "private" | "public" =>
  contentAccessSourceOf(c, model) !== null &&
  (
    c.get("storage") as { supportsPrivateFiles?: () => boolean }
  ).supportsPrivateFiles?.() === true
    ? "private"
    : "public";

/** The staff-only URL a private file is shown from in the AdminCP. */
export const contentPrivateAdminFileUrl = (fileId: number): string =>
  `${CONFIG.api.origin.replace(/\/$/, "")}/api/@vitnode/core/admin/files/${fileId}/download?inline=true`;
