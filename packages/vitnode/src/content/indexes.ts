import type {
  ContentFieldMap,
  ContentIndexConfig,
  ResolvedContentIndex,
} from "./types";

import {
  CONTENT_IDENTIFIER_MAX_LENGTH,
  CONTENT_INDEX_NAME_PATTERN,
  CONTENT_SYSTEM_FIELDS,
} from "./const";
import { ContentEngineError } from "./errors";
import { clampWithFingerprint } from "./fingerprint";

/** `createdAt` -> `created_at`, matching the SQL identifiers in migrations. */
export const toSnakeCase = (value: string): string =>
  value.replace(/[A-Z]/g, match => `_${match.toLowerCase()}`);

/** Keeps an index name inside Postgres' 63-character identifier limit. */
export const shortenIdentifier = (name: string): string =>
  clampWithFingerprint(name, CONTENT_IDENTIFIER_MAX_LENGTH);

/**
 * The deterministic name of a generated index: `<table>_<columns>_idx`, or
 * `_key` when it is unique - the suffix Postgres itself uses for unique
 * constraints.
 */
export const contentIndexName = ({
  columns,
  tableName,
  unique = false,
}: {
  columns: readonly string[];
  tableName: string;
  unique?: boolean;
}): string =>
  shortenIdentifier(
    [tableName, ...columns.map(toSnakeCase), unique ? "key" : "idx"].join("_"),
  );

/**
 * The deterministic name of the generated translation table's primary key.
 *
 * Named explicitly rather than left to Drizzle's default so it survives the
 * identifier-length clamp: a long base table name plus `_translations` plus
 * `_itemId_languageId_pk` passes 63 characters easily, and Postgres truncates
 * silently.
 */
export const contentTranslationPrimaryKeyName = (
  translationTableName: string,
): string =>
  shortenIdentifier(`${translationTableName}_item_id_language_id_pk`);

/**
 * Every index the generated translation table carries.
 *
 * The composite primary key already serves lookups by `(itemId, languageId)` and
 * by `itemId` alone (a B-tree can use any prefix of its key), so neither is
 * repeated here. What it cannot serve:
 *
 * 1. `languageId` on its own - "every row in Polish", and the lookup a language
 *    delete has to make before it is allowed to proceed,
 * 2. one unique index per localized slug, scoped to the language - which is what
 *    lets `/en/about` and `/pl/about` coexist while a second English `about` is
 *    a 409,
 * 3. `(languageId, status)` when the content type has publication - the public
 *    read's "every published Polish translation" and the AdminCP's per-locale
 *    completeness counts both start there. It supersedes (1), which is a prefix
 *    of it, so the two are deduplicated below rather than both created.
 */
export const resolveContentTranslationIndexes = ({
  contentTypeId,
  localizedFields,
  publication = false,
  translationTableName,
}: {
  contentTypeId: string;
  localizedFields: ContentFieldMap;
  publication?: boolean;
  translationTableName: string;
}): ResolvedContentIndex[] => {
  const indexes: ResolvedContentIndex[] = [
    ...(publication
      ? [named(translationTableName, { on: ["languageId", "status"] })]
      : [named(translationTableName, { on: ["languageId"] })]),
    ...Object.entries(localizedFields)
      .filter(([, fieldValue]) => fieldValue.kind === "slug")
      .map(([name]) =>
        named(translationTableName, {
          on: ["languageId", name],
          unique: true,
        }),
      ),
  ];

  const byName = new Map<string, ResolvedContentIndex>();
  for (const index of indexes) {
    const collision = byName.get(index.name);
    if (collision) {
      throw new ContentEngineError(
        `Translation indexes on [${collision.on.join(", ")}] and [${index.on.join(", ")}] both resolve to the name "${index.name}".`,
        { contentTypeId },
      );
    }
    byName.set(index.name, index);
  }

  return indexes;
};

/**
 * Identity of an index for deduplication. Column order matters: an index on
 * `(status, createdAt)` cannot serve a lookup on `(createdAt, status)`.
 */
const signatureOf = (columns: readonly string[]): string => columns.join(",");

const assertDeclaredIndex = (
  contentTypeId: string,
  index: ContentIndexConfig,
): void => {
  if (index.on.length === 0) {
    throw new ContentEngineError("An index needs at least one column.", {
      contentTypeId,
    });
  }

  const repeated = index.on.find(
    (column, position) => index.on.indexOf(column) !== position,
  );
  if (repeated !== undefined) {
    throw new ContentEngineError(
      `Index on [${index.on.join(", ")}] lists "${repeated}" twice.`,
      { contentTypeId },
    );
  }

  if (index.name === undefined) return;

  if (!CONTENT_INDEX_NAME_PATTERN.test(index.name)) {
    throw new ContentEngineError(
      `Index name "${index.name}" must be snake_case and start with a lowercase letter.`,
      { contentTypeId },
    );
  }

  if (index.name.length > CONTENT_IDENTIFIER_MAX_LENGTH) {
    throw new ContentEngineError(
      `Index name "${index.name}" is longer than the Postgres identifier limit of ${CONTENT_IDENTIFIER_MAX_LENGTH} characters.`,
      { contentTypeId },
    );
  }
};

const named = (
  tableName: string,
  index: ContentIndexConfig,
): ResolvedContentIndex => ({
  name:
    index.name ??
    contentIndexName({ columns: index.on, tableName, unique: index.unique }),
  on: [...index.on],
  unique: index.unique ?? false,
});

/**
 * Expands the declared indexes into the full set the table will carry, then
 * removes the redundant ones.
 *
 * Five sources feed in, in descending precedence:
 *
 * 1. `indexes` declared on the content type,
 * 2. `field.text({ unique: true })` and every `field.slug()`, which is always
 *    unique - a slug is a URL, and two rows cannot share one,
 * 3. every foreign key (`relation` and `user` fields),
 * 4. `createdAt` and `updatedAt`, which back the default ordering,
 * 5. `(status, publishedAt)` when publication is enabled - one composite index
 *    serving both the published predicate and the default public ordering.
 *
 * Two entries covering the same columns collapse into one: the first name wins,
 * and the index is unique if *any* of them asked for uniqueness. So declaring
 * `{ on: ["category"] }` simply renames the automatic foreign-key index rather
 * than adding a second one, and declaring `{ on: ["code"], unique: true }`
 * beside `field.text({ unique: true })` still yields exactly one index.
 *
 * Names are only checked against *this* content type here. Postgres scopes index
 * names to the schema, so `validateContentTypes` re-checks them across every
 * installed content type - that is the only place the whole set is visible.
 */
export const resolveContentIndexes = ({
  contentTypeId,
  declared,
  fields,
  publication = false,
  tableName,
}: {
  contentTypeId: string;
  declared: readonly ContentIndexConfig[];
  fields: ContentFieldMap;
  publication?: boolean;
  tableName: string;
}): ResolvedContentIndex[] => {
  const seenNames = new Map<string, string[]>();
  const seenSignatures = new Set<string>();

  for (const index of declared) {
    assertDeclaredIndex(contentTypeId, index);

    const signature = signatureOf(index.on);
    if (seenSignatures.has(signature)) {
      throw new ContentEngineError(
        `Two indexes are declared on the same columns [${index.on.join(", ")}]. Remove one of them.`,
        { contentTypeId },
      );
    }
    seenSignatures.add(signature);

    if (index.name === undefined) continue;
    if (seenNames.has(index.name)) {
      throw new ContentEngineError(
        `Index name "${index.name}" is declared twice.`,
        { contentTypeId },
      );
    }
    seenNames.set(index.name, [...index.on]);
  }

  const fieldEntries = Object.entries(fields);
  const candidates: ResolvedContentIndex[] = [
    ...declared.map(index => named(tableName, index)),
    ...fieldEntries
      .filter(([, fieldValue]) => {
        // A slug is a URL segment, so it is unique whether or not you ask.
        if (fieldValue.kind === "slug") return true;

        return fieldValue.kind === "text" && fieldValue.unique === true;
      })
      .map(([name]) => named(tableName, { on: [name], unique: true })),
    ...fieldEntries
      .filter(
        ([, fieldValue]) =>
          fieldValue.kind === "relation" || fieldValue.kind === "user",
      )
      .map(([name]) => named(tableName, { on: [name] })),
    ...CONTENT_SYSTEM_FIELDS.filter(name => name !== "id").map(name =>
      named(tableName, { on: [name] }),
    ),
    ...(publication
      ? [named(tableName, { on: ["status", "publishedAt"] })]
      : []),
  ];

  const bySignature = new Map<string, ResolvedContentIndex>();

  for (const candidate of candidates) {
    const signature = signatureOf(candidate.on);
    const existing = bySignature.get(signature);

    if (!existing) {
      bySignature.set(signature, candidate);
      continue;
    }

    // Same columns, so one index serves both - but a uniqueness requirement
    // from any source has to survive the merge.
    existing.unique ||= candidate.unique;
  }

  const resolved = [...bySignature.values()];
  const byName = new Map<string, ResolvedContentIndex>();

  for (const index of resolved) {
    const collision = byName.get(index.name);
    if (collision) {
      throw new ContentEngineError(
        `Indexes on [${collision.on.join(", ")}] and [${index.on.join(", ")}] both resolve to the name "${index.name}".`,
        { contentTypeId },
      );
    }
    byName.set(index.name, index);
  }

  return resolved;
};
