import type {
  ContentRevisionSnapshot,
  ContentSnapshotScalar,
  ContentSnapshotValue,
  ContentTranslationRevisionSnapshot,
} from "../revisions";
import type { AnyContentTypeDefinition, ContentFieldMap } from "../types";

import { CONTENT_REVISION_SNAPSHOT_VERSION } from "../const";
import { partitionContentFields } from "../localization";
import {
  contentInnerFields,
  contentLeafColumnName,
  isContentRelationCollection,
} from "../paths";

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
const toSnapshotValue = (value: unknown): ContentSnapshotScalar => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();

  const type = typeof value;
  if (type === "boolean" || type === "number" || type === "string") {
    return value as ContentSnapshotScalar;
  }

  return null;
};

/**
 * One field's value, in the **logical** shape.
 *
 * A group is snapshotted as the nested object it is, read out of the flattened
 * columns the row actually carries - so a snapshot never mentions `seo_title`,
 * and a later rename of the column-naming rule cannot invalidate the history. A
 * nullable group whose every leaf is empty is `null`, exactly as a read of it
 * would be.
 *
 * A collection is snapshotted as **identity**: a to-many relation as its ids in
 * stored order, a repeatable as its children each keyed by its own `id`. That is
 * what makes a restore able to put the same rows back rather than copies of
 * them, and what keeps one record's history from carrying another record's data.
 */
const toFieldSnapshot = (
  name: string,
  fieldValue: ContentFieldMap[string],
  values: Record<string, unknown>,
): ContentSnapshotValue => {
  if (fieldValue.kind === "group") {
    const inner = contentInnerFields(fieldValue);
    const leaves = Object.keys(inner);
    const nested: Record<string, ContentSnapshotScalar> = {};
    let allNull = true;

    for (const leaf of leaves) {
      // Read from the column when the row is a database row, and from the
      // nested value when it is already logical - a restore hands over the
      // second, and both have to snapshot identically.
      const raw =
        values[contentLeafColumnName(name, leaf)] ??
        (values[name] as null | Record<string, unknown> | undefined)?.[leaf] ??
        null;
      const snapshot = toSnapshotValue(raw);
      if (snapshot !== null) allNull = false;

      nested[leaf] = snapshot;
    }

    return fieldValue.nullable && allNull ? null : nested;
  }

  if (isContentRelationCollection(fieldValue)) {
    const value = values[name];

    return Array.isArray(value)
      ? value.map(id => Number(id)).filter(id => Number.isInteger(id))
      : [];
  }

  if (fieldValue.kind === "repeatable") {
    const value = values[name];
    if (!Array.isArray(value)) return [];

    const leaves = Object.keys(contentInnerFields(fieldValue));

    return (value as Record<string, unknown>[]).map(row => ({
      id: toSnapshotValue(row.id),
      ...Object.fromEntries(
        leaves.map(leaf => [leaf, toSnapshotValue(row[leaf])]),
      ),
    }));
  }

  return toSnapshotValue(values[name]);
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
  const { collectionFields, sharedFields } = partitionContentFields(
    definition.fields,
  );

  // Collections included, in declaration order alongside the shared fields: a
  // record's categories and its FAQ entries are part of its editable state, so
  // a history that left them out could not restore the state it claims to.
  const snapshotFields: ContentFieldMap = {
    ...sharedFields,
    ...collectionFields,
  };
  for (const [name, fieldValue] of Object.entries(snapshotFields)) {
    fields[name] = toFieldSnapshot(name, fieldValue, values);
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
  const { collectionFields, sharedFields } = partitionContentFields(
    definition.fields,
  );
  const restorable: ContentFieldMap = {
    ...sharedFields,
    ...collectionFields,
  };

  for (const [name, fieldValue] of Object.entries(restorable)) {
    if (!(name in snapshot.fields)) continue;

    const value = snapshot.fields[name];

    // A leaf the group has since dropped is ignored, for exactly the reason a
    // dropped field is: the snapshot records the past, and the past is allowed
    // to mention things that no longer exist. Left in, it would hit the strict
    // object schema and turn every old revision into a permanent 422.
    if (fieldValue.kind === "group" || fieldValue.kind === "repeatable") {
      const leaves = Object.keys(contentInnerFields(fieldValue));

      if (fieldValue.kind === "group") {
        projected[name] =
          value === null || typeof value !== "object" || Array.isArray(value)
            ? null
            : pickLeaves(value, leaves);
        continue;
      }

      projected[name] = Array.isArray(value)
        ? (value as Record<string, ContentSnapshotScalar>[]).map(row => ({
            // `id` is carried through so a restore can match the child rather
            // than recreate it; `prepareRestore` drops the ones that are gone.
            ...(typeof row.id === "number" ? { id: row.id } : {}),
            ...pickLeaves(row, leaves),
          }))
        : [];
      continue;
    }

    projected[name] = value;
  }

  return projected;
};

const pickLeaves = (
  values: Record<string, ContentSnapshotScalar>,
  leaves: readonly string[],
): Record<string, ContentSnapshotScalar> =>
  Object.fromEntries(
    leaves.filter(leaf => leaf in values).map(leaf => [leaf, values[leaf]]),
  );

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
