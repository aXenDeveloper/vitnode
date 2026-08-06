import type {
  ContentRevisionSnapshot,
  ContentSnapshotValue,
} from "../revisions";
import type { AnyContentTypeDefinition } from "../types";

import { CONTENT_REVISION_SNAPSHOT_VERSION } from "../const";

const toIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;

  return new Date(0).toISOString();
};

const toIsoOrNull = (value: unknown): null | string => {
  if (value === null || value === undefined) return null;

  return toIso(value);
};

/**
 * One column value, flattened to something `JSON.parse` gives back unchanged.
 *
 * A `Date` becomes an ISO string; a relation or user is already the foreign key
 * integer; everything else is a primitive. Anything unrecognised becomes `null`
 * rather than being stringified, so a future column type cannot smuggle
 * `"[object Object]"` into a snapshot and have a restore write it back.
 */
const toSnapshotValue = (value: unknown): ContentSnapshotValue => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();

  const type = typeof value;
  if (type === "boolean" || type === "number" || type === "string") {
    return value as ContentSnapshotValue;
  }

  return null;
};

/**
 * Builds the snapshot stored on a revision.
 *
 * Deterministic: field names are emitted in the content type's own declaration
 * order, so two equal states serialise byte for byte and a diff test is a table
 * rather than a set comparison.
 *
 * The publication columns are recorded but are *not* restorable - they are
 * absent from `schemas.update`, so a restore structurally cannot move them.
 * They are here so the history can show what the lifecycle was at the time.
 */
export const contentRevisionSnapshot = (
  definition: AnyContentTypeDefinition,
  row: object,
): ContentRevisionSnapshot => {
  const values = row as Record<string, unknown>;
  const fields: Record<string, ContentSnapshotValue> = {};

  for (const name of Object.keys(definition.fields)) {
    fields[name] = toSnapshotValue(values[name]);
  }

  const snapshot: ContentRevisionSnapshot = {
    contentTypeId: definition.id,
    createdAt: toIso(values.createdAt),
    fields,
    id: typeof values.id === "number" ? values.id : 0,
    schemaVersion: CONTENT_REVISION_SNAPSHOT_VERSION,
    updatedAt: toIso(values.updatedAt),
    version: typeof values.version === "number" ? values.version : 1,
  };

  if (definition.publication.enabled) {
    snapshot.publication = {
      publishedAt: toIsoOrNull(values.publishedAt),
      status: typeof values.status === "string" ? values.status : "draft",
    };
  }

  return snapshot;
};

/**
 * A snapshot, shaped like the row it was taken from.
 *
 * Flat rather than nested, because the public projector reads a row by column
 * name and must not learn that a preview exists - one projection, one
 * allowlist, no second code path where a private field could slip through.
 *
 * Timestamps stay ISO strings. Hono serialises a `Date` to exactly that, so the
 * response body is byte-identical to a live read.
 */
export const contentSnapshotRow = (
  snapshot: ContentRevisionSnapshot,
): Record<string, unknown> => ({
  ...snapshot.fields,
  createdAt: snapshot.createdAt,
  id: snapshot.id,
  publishedAt: snapshot.publication?.publishedAt ?? null,
  updatedAt: snapshot.updatedAt,
});

/**
 * The part of a snapshot a restore may apply: currently declared fields only.
 *
 * A field the content type has since dropped is ignored rather than rejected -
 * the snapshot is a record of the past, and the past is allowed to mention
 * things that no longer exist. A field added since is simply absent, so the
 * record keeps whatever it holds now.
 *
 * The generated columns are never projected. `id`, `version` and the timestamps
 * belong to the row's identity, and `status`/`publishedAt` are lifecycle state
 * that only publish and unpublish may move.
 */
export const projectRevisionSnapshot = (
  definition: AnyContentTypeDefinition,
  snapshot: ContentRevisionSnapshot,
): Record<string, ContentSnapshotValue> => {
  const projected: Record<string, ContentSnapshotValue> = {};

  for (const name of Object.keys(definition.fields)) {
    if (!(name in snapshot.fields)) continue;

    projected[name] = snapshot.fields[name];
  }

  return projected;
};
