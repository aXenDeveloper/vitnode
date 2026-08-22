import type { Context } from "hono";

import { inArray } from "drizzle-orm";

import type { StorageFileUploadResult } from "../../api/models/storage";
import type {
  ContentFileConstraints,
  ContentFileDescriptor,
  ContentFileRejection,
} from "../files";
import type { AnyContentTypeDefinition, ContentFileField } from "../types";
import type { ContentDatabase } from "./service";

import { core_files } from "../../database/files";
import { parseImageDimensions } from "../../lib/api/upload";
import { CONTENT_FILE_CODES } from "../const";
import { ContentInputError } from "../errors";
import { contentFileConstraints, validateContentFile } from "../files";
import { partitionContentFields } from "../localization";

/**
 * The file fields of a content type, by name.
 *
 * Always shared - `localized: true` is refused on a file field - so this reads
 * the shared half of the partition and nothing else. An empty object for every
 * content type that declares none, which is what lets every caller below be a
 * cheap early return rather than a conditional at the call site.
 */
export const contentFileFields = (
  definition: AnyContentTypeDefinition,
): Record<string, ContentFileField> => {
  const { sharedFields } = partitionContentFields(definition.fields);
  const files: Record<string, ContentFileField> = {};

  for (const [name, fieldValue] of Object.entries(sharedFields)) {
    if (fieldValue.kind === "file") files[name] = fieldValue;
  }

  return files;
};

/** The columns a descriptor is built from. Never `key`, and never `metadata`. */
const fileSelection = {
  id: core_files.id,
  key: core_files.key,
  metadata: core_files.metadata,
  mimeType: core_files.mimeType,
  name: core_files.name,
  size: core_files.size,
};

interface ContentFileRow {
  id: number;
  key: string;
  metadata: null | Record<string, unknown>;
  mimeType: null | string;
  name: string;
  size: number;
}

/**
 * One `core_files` row, reduced to the shape every surface may see.
 *
 * The allowlist is the function: `key` is read to build the URL and then
 * dropped, `metadata` is read for the pixel dimensions and then dropped, and
 * `userId` and `pluginId` are never selected at all. So "forward the file row"
 * is not something a caller can do by accident.
 *
 * `url` is `""` when the install has no storage adapter configured. Every row in
 * `core_files` was uploaded through one, so this only happens after an adapter is
 * removed - and an empty string is the honest answer, where `getUrl` would throw
 * a 500 into the middle of an otherwise fine list response.
 */
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
    ...(dimensions
      ? { height: dimensions.height, width: dimensions.width }
      : {}),
  };
};

/**
 * Reads the descriptors for a set of `core_files` ids, in one statement.
 *
 * One query for a whole page, never one per row: a list of twenty articles with a
 * cover image each is one `WHERE id IN (...)`. An id with no row is simply absent
 * from the map, which every caller reads as "no file" - a deleted file cannot
 * happen while a content row points at it, but a *snapshot* may name one.
 */
export const resolveContentFileDescriptors = async (
  c: Context,
  ids: readonly number[],
  tx?: ContentDatabase,
): Promise<Map<number, ContentFileDescriptor>> => {
  const unique = [...new Set(ids.filter(id => Number.isInteger(id) && id > 0))];
  if (unique.length === 0) return new Map();

  const rows = await (tx ?? c.get("db"))
    .select(fileSelection)
    .from(core_files)
    .where(inArray(core_files.id, unique));

  const hasAdapter = !!c.get("core").storage?.adapter;
  const storage = c.get("storage");
  const url = (key: string): string => (hasAdapter ? storage.getUrl(key) : "");

  return new Map(
    (rows as ContentFileRow[]).map(row => [row.id, toDescriptor(row, url)]),
  );
};

/** The file ids one set of values actually names, ignoring absent and null. */
const fileIdsOf = (
  names: readonly string[],
  values: Record<string, unknown>,
): number[] =>
  names
    .map(name => values[name])
    .filter((value): value is number => typeof value === "number" && value > 0);

/**
 * Attaches each row's resolved file descriptors under `files`.
 *
 * A **sibling** of the row rather than a replacement of the column, which is the
 * opposite of what the public projection does - and deliberately: an admin row is
 * what the edit form opens on, and the form submits `coverImage: 42` back. Keeping
 * the identifier as the value and the descriptor beside it means the form has both
 * without converting either way.
 *
 * `files` is `{}` for a content type with no file fields, so every generated list
 * and detail response that had no files before is byte-identical.
 */
export const withContentRowFiles = async <TRow extends object>(
  c: Context,
  definition: AnyContentTypeDefinition,
  rows: readonly TRow[],
): Promise<
  (TRow & { files: Record<string, ContentFileDescriptor | null> })[]
> => {
  const names = Object.keys(contentFileFields(definition));
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
        names.map(name => {
          const id = values[name];

          return [name, typeof id === "number" ? (byId.get(id) ?? null) : null];
        }),
      ),
    };
  });
};

/**
 * Replaces every exposed file id on a **public** row with its descriptor.
 *
 * In place of the column rather than beside it, because a public reader has no
 * route that turns a `core_files.id` into anything: there is no public files API
 * and there should not be one. The descriptor is already the allowlisted shape,
 * so the projector needs no file-specific branch - it forwards whatever the
 * column holds, exactly as it does for a string.
 *
 * Only the fields `publicApi.fields` names. A file field the allowlist leaves out
 * is not selected in the first place, so there is nothing here to resolve.
 */
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
        const id = row[name];

        return [name, typeof id === "number" ? (byId.get(id) ?? null) : null];
      }),
    ),
  }));
};

/**
 * Re-checks every file a write names against the field that will hold it.
 *
 * A successful upload is **not** validation of an assignment. The upload route
 * checked the file it received against the field it was uploaded for; this checks
 * the `core_files` row an identifier names against the field it is being written
 * to - which is a different question, and the one that stops
 * `{ animation: <the id of a PDF somebody uploaded elsewhere> }` from being
 * stored by a hand-written request.
 *
 * Four questions, the same four the upload asked: does the row exist, is it
 * within `maxBytes`, is its media type allowed, and is its extension allowed.
 * `validateContentFile` is the one implementation of the last three, so the
 * answers cannot differ between the two moments.
 *
 * A no-op - not one statement - for a content type with no file fields, and for a
 * payload that mentions none of them.
 */
export const assertContentFileReferences = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  values: Record<string, unknown>,
  tx?: ContentDatabase,
): Promise<void> => {
  const files = contentFileFields(definition);
  const named = Object.keys(files).filter(
    name => typeof values[name] === "number",
  );
  if (named.length === 0) return;

  const byId = await resolveContentFileDescriptors(
    c,
    named.map(name => values[name] as number),
    tx,
  );

  for (const name of named) {
    const id = values[name] as number;
    const descriptor = byId.get(id);

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
