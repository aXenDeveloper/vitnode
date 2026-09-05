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
  isContentReferenceCollection,
  readContentLeaf,
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

const toSnapshotValue = (value: unknown): ContentSnapshotScalar => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();

  const type = typeof value;
  if (type === "boolean" || type === "number" || type === "string") {
    return value as ContentSnapshotScalar;
  }

  return null;
};

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
      // Reads the flattened column on a database row and the nested value on a
      // logical one - a base snapshot is taken from the first, a translation
      // snapshot from the second, and both have to produce the same shape.
      const snapshot = toSnapshotValue(readContentLeaf(values, name, leaf));
      if (snapshot !== null) allNull = false;

      nested[leaf] = snapshot;
    }

    return fieldValue.nullable && allNull ? null : nested;
  }

  if (isContentReferenceCollection(fieldValue)) {
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

export const contentSnapshotRow = (
  snapshot: ContentRevisionSnapshot,
): Record<string, unknown> => ({
  ...snapshot.fields,
  createdAt: snapshot.createdAt,
  id: snapshot.id,
  publishedAt: snapshot.publication?.publishedAt ?? null,
  updatedAt: snapshot.updatedAt,
});

export const projectRevisionSnapshot = (
  definition: AnyContentTypeDefinition,
  snapshot: ContentRevisionSnapshot,
): Record<string, ContentSnapshotValue> => {
  const { collectionFields, sharedFields } = partitionContentFields(
    definition.fields,
  );

  return projectSnapshotFields(
    { ...sharedFields, ...collectionFields },
    snapshot.fields,
  );
};

const projectSnapshotFields = (
  restorable: ContentFieldMap,
  stored: Record<string, ContentSnapshotValue>,
): Record<string, ContentSnapshotValue> => {
  const projected: Record<string, ContentSnapshotValue> = {};

  for (const [name, fieldValue] of Object.entries(restorable)) {
    if (!(name in stored)) continue;

    const value = stored[name];

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

export const contentTranslationRevisionSnapshot = (
  definition: AnyContentTypeDefinition,
  row: object,
  { languageId, locale }: { languageId: number; locale: string },
): ContentTranslationRevisionSnapshot => {
  const values = row as Record<string, unknown>;
  const fields: Record<string, ContentSnapshotValue> = {};
  const { localizedFields } = partitionContentFields(definition.fields);

  // The same field snapshotter the shared half uses, so a localized group is
  // recorded in its canonical nested shape rather than run through the scalar
  // coercion - which returns `null` for an object, and would silently record
  // every localized group as absent.
  for (const [name, fieldValue] of Object.entries(localizedFields)) {
    fields[name] = toFieldSnapshot(name, fieldValue, values);
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

export const projectTranslationRevisionSnapshot = (
  definition: AnyContentTypeDefinition,
  snapshot: ContentTranslationRevisionSnapshot,
): Record<string, ContentSnapshotValue> => {
  const { localizedFields } = partitionContentFields(definition.fields);

  return projectSnapshotFields(localizedFields, snapshot.fields);
};
