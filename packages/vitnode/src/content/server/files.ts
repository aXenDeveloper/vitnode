import type { Context } from "hono";

import { inArray, sql } from "drizzle-orm";

import type { StorageFileUploadResult } from "../../api/models/storage";
import type {
  ContentFileConstraints,
  ContentFileDescriptor,
  ContentFileFieldValue,
  ContentFileRejection,
} from "../files";
import type { AnyContentTypeDefinition, ContentFileField } from "../types";
import type { ContentDatabase } from "./service";

import { core_files, core_files_alt } from "../../database/files";
import { parseImageDimensions } from "../../lib/api/upload";
import { CONTENT_FILE_CODES } from "../const";
import { ContentInputError } from "../errors";
import { contentFileConstraints, validateContentFile } from "../files";
import { partitionContentFields } from "../localization";
import { resolveContentActor } from "./actor";

export const contentFileFields = (
  definition: AnyContentTypeDefinition,
): Record<string, ContentFileField> => {
  const { collectionFields, sharedFields } = partitionContentFields(
    definition.fields,
  );
  const files: Record<string, ContentFileField> = {};

  for (const [name, fieldValue] of [
    ...Object.entries(sharedFields),
    ...Object.entries(collectionFields),
  ]) {
    if (fieldValue.kind === "file") files[name] = fieldValue;
  }

  return files;
};

export const contentFileCollectionFields = (
  definition: AnyContentTypeDefinition,
): Record<string, ContentFileField> =>
  Object.fromEntries(
    Object.entries(contentFileFields(definition)).filter(
      ([, fieldValue]) => fieldValue.multiple,
    ),
  );

/** The columns a descriptor is built from. Never `key`, and never `metadata`. */
const fileSelection = {
  alts: sql<null | Record<string, string>>`(
    SELECT jsonb_object_agg(${core_files_alt.languageCode}, ${core_files_alt.text})
    FROM ${core_files_alt}
    WHERE ${core_files_alt.fileId} = ${core_files.id}
  )`,
  id: core_files.id,
  key: core_files.key,
  metadata: core_files.metadata,
  mimeType: core_files.mimeType,
  name: core_files.name,
  size: core_files.size,
};

interface ContentFileRow {
  alts?: null | Record<string, string>;
  id: number;
  key: string;
  metadata: null | Record<string, unknown>;
  mimeType: null | string;
  name: string;
  size: number;
}

interface ContentFileOriginRow extends ContentFileRow {
  userId?: null | number;
}

const toDescriptor = (
  row: ContentFileRow,
  url: (key: string) => string,
): ContentFileDescriptor => {
  const dimensions = parseImageDimensions(row.metadata);

  return {
    id: row.id,
    mimeType: row.mimeType,
    name: row.name,
    size: row.size,
    url: url(row.key),
    ...(row.alts && row.mimeType?.startsWith("image/")
      ? { alts: row.alts }
      : {}),
    ...(dimensions
      ? { height: dimensions.height, width: dimensions.width }
      : {}),
  };
};

const readContentFileRows = async (
  c: Context,
  ids: readonly number[],
  tx?: ContentDatabase,
): Promise<ContentFileOriginRow[]> => {
  const unique = [...new Set(ids.filter(id => Number.isInteger(id) && id > 0))];
  if (unique.length === 0) return [];

  return await (tx ?? c.get("db"))
    .select({ ...fileSelection, userId: core_files.userId })
    .from(core_files)
    .where(inArray(core_files.id, unique));
};

const descriptorsByIdOf = (
  c: Context,
  rows: readonly ContentFileRow[],
): Map<number, ContentFileDescriptor> => {
  const hasAdapter = !!c.get("core").storage?.adapter;
  const storage = c.get("storage");
  const url = (key: string): string => (hasAdapter ? storage.getUrl(key) : "");

  return new Map(rows.map(row => [row.id, toDescriptor(row, url)]));
};

export const resolveContentFileDescriptors = async (
  c: Context,
  ids: readonly number[],
  tx?: ContentDatabase,
): Promise<Map<number, ContentFileDescriptor>> =>
  descriptorsByIdOf(c, await readContentFileRows(c, ids, tx));

/** One positive integer, or `null` - the only thing a file reference can be. */
const asFileId = (value: unknown): null | number =>
  typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;

const fileIdsOfValue = (value: unknown): number[] => {
  if (Array.isArray(value)) {
    return value.map(asFileId).filter((id): id is number => id !== null);
  }

  const id = asFileId(value);

  return id === null ? [] : [id];
};

/** The file ids one set of values actually names, ignoring absent and null. */
const fileIdsOf = (
  names: readonly string[],
  values: Record<string, unknown>,
): number[] => names.flatMap(name => fileIdsOfValue(values[name]));

const descriptorsOf = (
  byId: Map<number, ContentFileDescriptor>,
  value: unknown,
): ContentFileDescriptor[] =>
  fileIdsOfValue(value)
    .map(id => byId.get(id))
    .filter((file): file is ContentFileDescriptor => file !== undefined);

export const withContentRowFiles = async <TRow extends object>(
  c: Context,
  definition: AnyContentTypeDefinition,
  rows: readonly TRow[],
): Promise<(TRow & { files: Record<string, ContentFileFieldValue> })[]> => {
  const fields = contentFileFields(definition);
  const names = Object.keys(fields);
  if (names.length === 0) {
    return rows.map(row => ({ ...row, files: {} }));
  }

  const byId = await resolveContentFileDescriptors(
    c,
    rows.flatMap(row => fileIdsOf(names, row as Record<string, unknown>)),
  );

  return rows.map(row => {
    const values = row as Record<string, unknown>;

    return {
      ...row,
      files: Object.fromEntries(
        names.flatMap((name): [string, ContentFileFieldValue][] => {
          if (fields[name].multiple) {
            const ids = values[name];
            // Not loaded: say nothing rather than say "empty".
            if (!Array.isArray(ids)) return [];

            return [[name, descriptorsOf(byId, ids)]];
          }

          const id = asFileId(values[name]);

          return [[name, id === null ? null : (byId.get(id) ?? null)]];
        }),
      ),
    };
  });
};

export const resolveContentPublicRowFiles = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> => {
  if (!definition.publicApi.enabled || rows.length === 0) return rows;

  const files = contentFileFields(definition);
  const names = definition.publicApi.fields.filter(
    name => files[name] !== undefined,
  );
  if (names.length === 0) return rows;

  const byId = await resolveContentFileDescriptors(
    c,
    rows.flatMap(row => fileIdsOf(names, row)),
  );

  return rows.map(row => ({
    ...row,
    ...Object.fromEntries(
      names.map(name => {
        if (files[name].multiple) {
          return [name, descriptorsOf(byId, row[name])];
        }

        const id = asFileId(row[name]);

        return [name, id === null ? null : (byId.get(id) ?? null)];
      }),
    ),
  }));
};

export interface ContentFileReferenceOptions {
  /**
   * The values the record already holds - or, for a restore, held. A file id
   * found in them is accepted whatever its origin, so a record keeps saving with
   * the files it has. Only read when some id fails the origin check.
   */
  existing?: () => Promise<Record<string, unknown>>;
}

/**
 * Whether a caller may point a field at a file it did not just keep.
 *
 * Only a file uploaded through this content type's own upload route, or one the
 * calling user uploaded themselves - never somebody else's avatar or another
 * plugin's attachment found by counting ids. Server code running without a
 * user (a job, a seed) picks its own ids and is trusted.
 */
const isContentFileOriginAllowed = (
  row: ContentFileOriginRow,
  {
    callerId,
    contentTypeId,
  }: { callerId: null | number; contentTypeId: string },
): boolean =>
  callerId === null ||
  row.metadata?.contentTypeId === contentTypeId ||
  row.userId === callerId;

export const assertContentFileReferences = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  values: Record<string, unknown>,
  tx?: ContentDatabase,
  { existing }: ContentFileReferenceOptions = {},
): Promise<void> => {
  const files = contentFileFields(definition);
  // One entry per (field, id) pair, in payload order, so a gallery contributes
  // as many checks as it has entries and a field the payload says nothing about
  // contributes none.
  const named = Object.keys(files).flatMap(name =>
    (files[name].multiple
      ? Array.isArray(values[name])
        ? fileIdsOfValue(values[name])
        : []
      : fileIdsOfValue(asFileId(values[name]))
    ).map(id => ({ id, name })),
  );
  if (named.length === 0) return;

  const rows = await readContentFileRows(
    c,
    named.map(entry => entry.id),
    tx,
  );
  const origin = {
    callerId: resolveContentActor(c).userId,
    contentTypeId: definition.id,
  };
  const foreign = new Set(
    rows
      .filter(row => !isContentFileOriginAllowed(row, origin))
      .map(row => row.id),
  );
  if (foreign.size > 0 && existing) {
    const held = fileIdsOf(Object.keys(files), await existing());
    for (const id of held) foreign.delete(id);
  }

  const byId = descriptorsByIdOf(
    c,
    rows.filter(row => !foreign.has(row.id)),
  );

  for (const { id, name } of named) {
    const descriptor = byId.get(id);

    // A file the caller may not use answers exactly like one that does not
    // exist, so the error is not a way to learn which ids are taken.
    if (!descriptor) {
      throw new ContentFileReferenceError({
        code: CONTENT_FILE_CODES.missing,
        contentTypeId: definition.id,
        field: name,
        message: `File ${id} does not exist, so "${name}" cannot point at it.`,
      });
    }

    const rejection = validateContentFile(
      contentFileConstraints(files[name]),
      descriptor,
    );
    if (rejection) {
      throw new ContentFileReferenceError({
        code: rejection.code,
        contentTypeId: definition.id,
        field: name,
        message: `File ${id} cannot be used for "${name}": ${rejection.message}`,
      });
    }
  }
};

/**
 * A file identifier a content write may not store.
 *
 * A `ContentInputError`, so a route that knows nothing about files still answers
 * 400. `code` and `field` are carried so one that does can say which rule refused
 * which input, exactly as `ContentAdvancedInputError` does for a missing relation
 * target - and `rethrowAsHttpError` answers with all three.
 */
export class ContentFileReferenceError extends ContentInputError {
  constructor({
    code,
    contentTypeId,
    field,
    message,
  }: {
    code: ContentFileRejection["code"];
    contentTypeId: string;
    field: string;
    message: string;
  }) {
    super(message, { contentTypeId });

    this.name = "ContentFileReferenceError";
    this.code = code;
    this.detail = message;
    this.field = field;
  }

  readonly code: ContentFileRejection["code"];
  /**
   * The sentence as it was written, for the response body.
   *
   * `Error.message` is not it: `ContentEngineError` prefixes every message with
   * `[Content Engine] <contentTypeId>: ` so a misconfigured plugin is obvious in
   * a log, and that prefix is exactly the internal detail a form must not show
   * an editor. Kept beside it rather than by stripping it back off, which would
   * be string surgery on a format that exists for the log's benefit.
   */
  readonly detail: string;
  readonly field: string;
}

/**
 * The `core_files` ids a revision snapshot names.
 *
 * What the revision pin table is built from: a snapshot records
 * `{ coverImage: 42 }`, and 42 has to stay deletable-refusing for as long as that
 * snapshot is retained - the content row's own foreign key stops protecting it the
 * moment the field is pointed somewhere else.
 *
 * A gallery is recorded as `{ gallery: [7, 3, 9] }`, so every entry is pinned
 * individually. That matters more here than for a single field: removing one
 * image from a gallery drops exactly one junction row, and without a pin that
 * one file becomes deletable while every retained revision still shows it.
 * Deduplicated, so a file used by two fields of the same record is one pin.
 */
export const contentSnapshotFileIds = (
  definition: AnyContentTypeDefinition,
  snapshot: { fields?: Record<string, unknown> },
): number[] => {
  const names = Object.keys(contentFileFields(definition));
  if (names.length === 0) return [];

  return [...new Set(fileIdsOf(names, snapshot.fields ?? {}))];
};

/**
 * The descriptor for a file that was just uploaded.
 *
 * Built from what `StorageModel.upload` returns rather than by reading the row
 * back: the insert already returned the id, and the upload already knows the
 * stored name, media type, size and pixel dimensions. One fewer round trip, and
 * the same allowlisted shape a later read produces.
 */
export const contentFileDescriptorFromUpload = (
  result: StorageFileUploadResult,
): ContentFileDescriptor => ({
  id: result.id,
  mimeType: result.mimeType,
  name: result.name,
  size: result.size,
  url: result.url,
  ...(result.dimensions
    ? { height: result.dimensions.height, width: result.dimensions.width }
    : {}),
});

/** Constraints of one file field, for a route that has the descriptor. */
export const contentFileFieldConstraints = (
  fieldValue: ContentFileField,
): ContentFileConstraints => contentFileConstraints(fieldValue);
