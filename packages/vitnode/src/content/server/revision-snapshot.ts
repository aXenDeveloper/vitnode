import type {
  ContentRevisionSnapshot,
  ContentSnapshotValue,
  ContentTranslationRevisionSnapshot,
} from "../revisions";
import type { AnyContentTypeDefinition } from "../types";

import { CONTENT_REVISION_SNAPSHOT_VERSION } from "../const";
import { partitionContentFields } from "../localization";

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
 * **Shared fields only.** A localized field is not a column on the base row, so
 * recording it here would write `null` for every language at once - and restoring
 * that snapshot would then try to blank a column the base table does not have.
 * Each language's values are snapshotted by
 * {@link contentTranslationRevisionSnapshot} instead, against its own history.
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
  const { sharedFields } = partitionContentFields(definition.fields);

  for (const name of Object.keys(sharedFields)) {
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
  const { sharedFields } = partitionContentFields(definition.fields);

  for (const name of Object.keys(sharedFields)) {
    if (!(name in snapshot.fields)) continue;

    projected[name] = snapshot.fields[name];
  }

  return projected;
};

/**
 * Builds the snapshot stored on a *translation* revision.
 *
 * The localized half of {@link contentRevisionSnapshot}, and the split is the
 * security boundary as much as a modelling one: a translation snapshot that
 * carried shared values would let a restore performed with `can_translate`
 * rewrite fields only `can_edit` may touch.
 *
 * `locale` is recorded alongside `languageId` because the revision row's language
 * reference has no foreign key - a language can be deleted, and the history has
 * to stay readable when it is.
 */
export const contentTranslationRevisionSnapshot = (
  definition: AnyContentTypeDefinition,
  row: object,
  { languageId, locale }: { languageId: number; locale: string },
): ContentTranslationRevisionSnapshot => {
  const values = row as Record<string, unknown>;
  const fields: Record<string, ContentSnapshotValue> = {};
  const { localizedFields } = partitionContentFields(definition.fields);

  for (const name of Object.keys(localizedFields)) {
    fields[name] = toSnapshotValue(values[name]);
  }

  const snapshot: ContentTranslationRevisionSnapshot = {
    contentTypeId: definition.id,
    createdAt: toIso(values.createdAt),
    fields,
    itemId: typeof values.itemId === "number" ? values.itemId : 0,
    languageId,
    locale,
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

/** The localized counterpart of {@link contentSnapshotRow}. */
export const contentTranslationSnapshotRow = (
  snapshot: ContentTranslationRevisionSnapshot,
): Record<string, unknown> => ({
  ...snapshot.fields,
  createdAt: snapshot.createdAt,
  itemId: snapshot.itemId,
  languageId: snapshot.languageId,
  publishedAt: snapshot.publication?.publishedAt ?? null,
  updatedAt: snapshot.updatedAt,
  version: snapshot.version,
});

/**
 * The part of a translation snapshot a restore may apply: currently declared
 * *localized* fields only.
 *
 * The same schema-evolution rules the shared projection follows - a field the
 * content type has since dropped is ignored, one added since is absent - and the
 * same exclusion of generated columns. `status` and `publishedAt` are lifecycle
 * state that only publish and unpublish may move, so restoring field values never
 * takes a translation off the internet or puts it on.
 */
export const projectTranslationRevisionSnapshot = (
  definition: AnyContentTypeDefinition,
  snapshot: ContentTranslationRevisionSnapshot,
): Record<string, ContentSnapshotValue> => {
  const projected: Record<string, ContentSnapshotValue> = {};
  const { localizedFields } = partitionContentFields(definition.fields);

  for (const name of Object.keys(localizedFields)) {
    if (!(name in snapshot.fields)) continue;

    projected[name] = snapshot.fields[name];
  }

  return projected;
};
