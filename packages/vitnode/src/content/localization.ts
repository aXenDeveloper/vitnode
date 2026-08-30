import type {
  ContentFieldDescriptor,
  ContentFieldMap,
  ContentLocalizationConfig,
  ContentLocalizationFallback,
  ResolvedContentLocalizationConfig,
} from "./types";

import {
  CONTENT_IDENTIFIER_MAX_LENGTH,
  CONTENT_LOCALE_MAX_LENGTH,
  CONTENT_LOCALE_PATTERN,
  CONTENT_LOCALIZED_FIELD_KINDS,
  CONTENT_TRANSLATION_SYSTEM_FIELDS,
  CONTENT_TRANSLATION_TABLE_SUFFIX,
  isLocalizableFieldKind,
} from "./const";
import { ContentEngineError } from "./errors";
import { clampWithFingerprint } from "./hash";
import { resolveContentTranslationIndexes } from "./indexes";
import { contentStorageColumns, isContentCollectionField } from "./paths";

/**
 * The one place that decides whether a field is localized.
 *
 * Every subsystem - table generation, schemas, services, routes, migrations -
 * goes through {@link partitionContentFields} rather than testing
 * `field.localized === true` for itself. Two copies of this rule is exactly the
 * pair that drifts, and the consequence of drift is a column generated on one
 * table and read from the other.
 */
export const isLocalizedContentField = (
  fieldValue: ContentFieldDescriptor,
): boolean => fieldValue.localized === true;

export interface ContentFieldPartition {
  /**
   * Fields whose value lives outside the row: a to-many relation (junction
   * table) and a repeatable (child table).
   *
   * Present on the partition rather than left for each caller to filter,
   * because "which fields are columns" is the same question the shared/localized
   * split answers and it has to be answered in the same place. Every existing
   * caller reads `sharedFields` and `localizedFields`, both of which now exclude
   * these - so a Stage 1-5 content type, which declares none, sees exactly the
   * partition it always did.
   */
  collectionFields: ContentFieldMap;
  /** Fields stored in the translation table, one row per language. */
  localizedFields: ContentFieldMap;
  /** Fields stored on the base table. */
  sharedFields: ContentFieldMap;
}

/**
 * Splits a field map into its base-table and translation-table halves.
 *
 * Declaration order is preserved in all three, so the generated column order,
 * the generated schema key order and the migration all stay deterministic.
 *
 * A `group` lands in whichever half its own `localized` flag names, whole: its
 * leaves are flattened into columns of that one table by
 * {@link contentStorageColumns}, never split across both.
 */
export const partitionContentFields = (
  fields: ContentFieldMap,
): ContentFieldPartition => {
  const collectionFields: ContentFieldMap = {};
  const localizedFields: ContentFieldMap = {};
  const sharedFields: ContentFieldMap = {};

  for (const [name, fieldValue] of Object.entries(fields)) {
    if (isContentCollectionField(fieldValue)) {
      collectionFields[name] = fieldValue;
      continue;
    }
    if (isLocalizedContentField(fieldValue)) {
      localizedFields[name] = fieldValue;
      continue;
    }
    sharedFields[name] = fieldValue;
  }

  return { collectionFields, localizedFields, sharedFields };
};

/** `example_articles` -> `example_articles_translations`. */
export const contentTranslationTableName = (tableName: string): string =>
  clampWithFingerprint(
    `${tableName}${CONTENT_TRANSLATION_TABLE_SUFFIX}`,
    CONTENT_IDENTIFIER_MAX_LENGTH,
  );

const disabledLocalization: ResolvedContentLocalizationConfig = {
  defaultLocale: "",
  enabled: false,
  fallback: "none",
  translationIndexes: [],
  translationTableName: "",
};

/** The disabled default, for a content type with no `localization` block. */
export const contentLocalizationDisabled =
  (): ResolvedContentLocalizationConfig => ({
    ...disabledLocalization,
    translationIndexes: [],
  });

const translationSystemFields: readonly string[] =
  CONTENT_TRANSLATION_SYSTEM_FIELDS;

const assertDefaultLocale = (id: string, locale: unknown): string => {
  if (typeof locale !== "string" || locale.trim() === "") {
    throw new ContentEngineError(
      'localization.defaultLocale is required and must be a locale code, e.g. "en". It names the row in `core_languages` every record is first created in.',
      { contentTypeId: id },
    );
  }

  if (locale !== locale.trim()) {
    throw new ContentEngineError(
      `localization.defaultLocale "${locale}" has leading or trailing whitespace.`,
      { contentTypeId: id },
    );
  }

  if (locale.length > CONTENT_LOCALE_MAX_LENGTH) {
    throw new ContentEngineError(
      `localization.defaultLocale "${locale}" is longer than ${CONTENT_LOCALE_MAX_LENGTH} characters, which is the width of \`core_languages.code\`.`,
      { contentTypeId: id },
    );
  }

  if (!CONTENT_LOCALE_PATTERN.test(locale)) {
    throw new ContentEngineError(
      `localization.defaultLocale "${locale}" does not look like a locale code. Expected something like "en", "pl" or "pt-BR".`,
      { contentTypeId: id },
    );
  }

  return locale;
};

/**
 * Every rule a localized field has to satisfy, in one pass.
 *
 * Two of them are about the *slug*, and they are the ones worth the words: a
 * localized slug derived from a shared title would give every language the same
 * URL, and a shared slug derived from a localized title has no single source to
 * derive from. Both are silent data bugs rather than crashes, so they are
 * rejected at definition time.
 */
const assertLocalizedFields = (
  id: string,
  fields: ContentFieldMap,
  localizedFields: ContentFieldMap,
): void => {
  if (Object.keys(localizedFields).length === 0) {
    throw new ContentEngineError(
      "localization is enabled but no field is marked `localized: true`, so the generated translation table would hold nothing but its keys. Mark at least one text, textarea or slug field.",
      { contentTypeId: id },
    );
  }

  for (const [name, fieldValue] of Object.entries(localizedFields)) {
    // A `group` is localizable whatever its leaves are: it moves whole, and its
    // leaves are already restricted to the scalar kinds by `resolveContentAdvanced`.
    // What a leaf holds is a question about the group, not about localization.
    if (
      fieldValue.kind !== "group" &&
      !isLocalizableFieldKind(fieldValue.kind)
    ) {
      throw new ContentEngineError(
        `Field "${name}" is \`localized: true\` but its kind is "${fieldValue.kind}". Only ${CONTENT_LOCALIZED_FIELD_KINDS.join(", ")} fields and \`field.group\` can be localized - an enum's identifiers have to be the same in every language, and a relation's target is shared.`,
        { contentTypeId: id },
      );
    }

    if (translationSystemFields.includes(name)) {
      throw new ContentEngineError(
        `Localized field "${name}" collides with a generated translation column. Rename it - the translation table always carries ${translationSystemFields.join(", ")}.`,
        { contentTypeId: id },
      );
    }
  }

  // A localized group's leaves become columns on the *translation* table, where
  // the reserved names are different from the base table's. `seo.version` would
  // pass every base-table check and then shadow the translation's optimistic
  // lock, so it is caught here rather than at the first conditional UPDATE.
  for (const columnName of Object.keys(
    contentStorageColumns(localizedFields),
  )) {
    if (!translationSystemFields.includes(columnName)) continue;

    throw new ContentEngineError(
      `A localized group leaf compiles to the column "${columnName}", which the translation table generates for itself. Rename the leaf - the translation table always carries ${translationSystemFields.join(", ")}.`,
      { contentTypeId: id },
    );
  }

  for (const [name, fieldValue] of Object.entries(fields)) {
    if (fieldValue.kind !== "slug" || fieldValue.source === undefined) continue;

    // `assertSlugSources` in `define.ts` has already proven the source exists
    // and is a text field; this only checks the two halves agree about *where*
    // the value lives.
    const source = fields[fieldValue.source];
    if (!source) continue;

    const slugLocalized = isLocalizedContentField(fieldValue);
    const sourceLocalized = isLocalizedContentField(source);

    if (slugLocalized && !sourceLocalized) {
      throw new ContentEngineError(
        `Localized slug "${name}" is sourced from the shared field "${fieldValue.source}". Every language would derive the same URL. Mark "${fieldValue.source}" \`localized: true\` too, or send the slug explicitly.`,
        { contentTypeId: id },
      );
    }

    if (!slugLocalized && sourceLocalized) {
      throw new ContentEngineError(
        `Shared slug "${name}" is sourced from the localized field "${fieldValue.source}", which has a different value in every language - so there is no single value to derive from. Mark "${name}" \`localized: true\`, or point it at a shared text field.`,
        { contentTypeId: id },
      );
    }
  }
};

/**
 * Checks and fills in `localization`.
 *
 * Runs after every other resolver, because the Stage 5A boundaries are stated in
 * terms of capabilities they have already settled. Like every other resolver
 * here it repeats what the types say: a JavaScript caller, or a value that
 * widened somewhere upstream, can reach this with anything at all.
 */
export const resolveContentLocalization = ({
  fields,
  id,
  localization,
  publication,
  tableName,
}: {
  fields: ContentFieldMap;
  id: string;
  localization: ContentLocalizationConfig | undefined;
  publication: boolean;
  tableName: string;
}): ResolvedContentLocalizationConfig => {
  const { localizedFields } = partitionContentFields(fields);

  if (!localization?.enabled) {
    const stray = Object.keys(localizedFields)[0];
    if (stray !== undefined) {
      throw new ContentEngineError(
        `Field "${stray}" is \`localized: true\` but the content type has no \`localization: { enabled: true, defaultLocale }\` block, so there is no translation table for it to live in.`,
        { contentTypeId: id },
      );
    }

    return contentLocalizationDisabled();
  }

  const defaultLocale = assertDefaultLocale(id, localization.defaultLocale);
  assertLocalizedFields(id, fields, localizedFields);

  const fallback: ContentLocalizationFallback = localization.fallback ?? "none";
  const translationTableName = contentTranslationTableName(tableName);

  return {
    defaultLocale,
    enabled: true,
    fallback,
    translationIndexes: resolveContentTranslationIndexes({
      contentTypeId: id,
      localizedFields,
      publication,
      translationTableName,
    }),
    translationTableName,
  };
};
