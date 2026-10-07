import type { AnyPgColumn, AnyPgColumnBuilder } from "drizzle-orm/pg-core";

import {
  bigint,
  boolean,
  doublePrecision,
  integer,
  jsonb,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import type { AnyBlockInstance } from "../../blocks/types";
import type { ContentIdStrategy } from "../ids";
import type { ContentFieldDescriptor } from "../types";

import {
  CONTENT_ENUM_DEFAULT_LENGTH,
  CONTENT_PUBLICATION_STATUS_LENGTH,
  CONTENT_PUBLICATION_STATUSES,
  CONTENT_SLUG_DEFAULT_LENGTH,
  CONTENT_TEXT_DEFAULT_LENGTH,
} from "../const";
import { ContentEngineError } from "../errors";

export type ColumnReferenceThunk = () => AnyPgColumn;

/**
 * A content table's primary key, per id strategy.
 *
 * - `serial`: exactly the column every content type has always had.
 * - `uuid`: `gen_random_uuid()`, so an insert that names no id still gets one.
 * - `bigint`: an identity column in Drizzle's `string` mode - `bigserial` has no
 *   string mode, and a JavaScript number would round anything above 2^53.
 *   `BY DEFAULT` rather than `ALWAYS`, so an import can keep its own ids and a
 *   sequence can be moved with `setval`.
 */
export const buildIdPrimaryKey = (
  strategy: ContentIdStrategy,
): AnyPgColumnBuilder => {
  if (strategy === "uuid") return uuid().primaryKey().defaultRandom();
  if (strategy === "bigint") {
    return bigint({ mode: "string" })
      .primaryKey()
      .generatedByDefaultAsIdentity();
  }

  return serial().primaryKey();
};

/**
 * A foreign key column of the type a `strategy` primary key has, nullable until
 * the caller says otherwise.
 * Every column that points at a content row - a to-one relation, a junction's
 * two sides, a translation's or a child row's owner - is built here, so the
 * types cannot disagree with the key they reference.
 */
export const buildIdForeignKey = (strategy: ContentIdStrategy) =>
  strategy === "uuid"
    ? uuid()
    : strategy === "bigint"
      ? bigint({ mode: "string" })
      : integer();

export const buildSystemColumns = (
  strategy: ContentIdStrategy = "serial",
): Record<string, AnyPgColumnBuilder> => ({
  id: buildIdPrimaryKey(strategy),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const buildPublicationColumns = (): Record<
  string,
  AnyPgColumnBuilder
> => ({
  publishedAt: timestamp(),
  status: varchar({
    enum: CONTENT_PUBLICATION_STATUSES,
    length: CONTENT_PUBLICATION_STATUS_LENGTH,
  })
    .notNull()
    .default("draft"),
});

/**
 * `hiddenAt` and `hiddenBy` - added only when visibility is enabled.
 *
 * `hiddenAt` is the whole state: a record is hidden exactly when it is set, so
 * there is no second flag that could disagree with it. `hiddenBy` is who did it,
 * and goes back to `NULL` with the account rather than blocking its deletion.
 */
export const buildVisibilityColumns = (
  userReference: ColumnReferenceThunk,
): Record<string, AnyPgColumnBuilder> => ({
  hiddenAt: timestamp(),
  hiddenBy: integer().references(userReference, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
});

export const buildEditorialColumns = (): Record<
  string,
  AnyPgColumnBuilder
> => ({
  version: integer().notNull().default(1),
});

export const buildTranslationSystemColumns = ({
  itemReference,
  itemStrategy = "serial",
  languageReference,
  onItemDelete = "cascade",
}: {
  itemReference: ColumnReferenceThunk;
  /** The owning content type's id strategy, which `itemId` follows. */
  itemStrategy?: ContentIdStrategy;
  languageReference: ColumnReferenceThunk;
  onItemDelete?: "cascade";
}): Record<string, AnyPgColumnBuilder> => ({
  itemId: buildIdForeignKey(itemStrategy)
    .notNull()
    // Cascade: a record's translations are part of the record, so removing it
    // takes them with it in one statement - there is no loop over locales
    // anywhere, and no window in which a translation outlives its row.
    .references(itemReference, { onDelete: onItemDelete, onUpdate: "cascade" }),
  languageId: integer()
    .notNull()
    // Restrict, unlike `core_languages_words`, which cascades. Deleting a
    // language must not silently delete every article written in it: the
    // AdminCP's language screen should refuse, and the person should decide
    // what happens to the content first.
    .references(languageReference, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  version: integer().notNull().default(1),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const buildTranslationPublicationColumns = (): Record<
  string,
  AnyPgColumnBuilder
> => buildPublicationColumns();

const withModifiers = <
  TBuilder extends {
    default: (value: TValue) => TBuilder;
    notNull: () => TBuilder;
  },
  TValue,
>(
  builder: TBuilder,
  { defaultValue, nullable }: { defaultValue?: TValue; nullable: boolean },
): TBuilder => {
  const withNull = nullable ? builder : builder.notNull();

  return defaultValue === undefined ? withNull : withNull.default(defaultValue);
};

export const buildContentColumn = ({
  contentTypeId,
  fieldValue,
  name,
  reference,
  referenceStrategy = "serial",
}: {
  contentTypeId: string;
  fieldValue: ContentFieldDescriptor;
  name: string;
  reference?: ColumnReferenceThunk;
  /** For a to-one `relation`: the target's id strategy, which the column follows. */
  referenceStrategy?: ContentIdStrategy;
}): AnyPgColumnBuilder => {
  const { nullable } = fieldValue;

  // A group is several columns and a repeatable is a table, so neither reaches
  // here: `contentStorageColumns` flattens the first and drops the second before
  // the table generator ever sees them. Reaching this line means a caller
  // skipped that flattening, which would otherwise show up as an untyped column
  // in the migration rather than as a message.
  if (fieldValue.kind === "group" || fieldValue.kind === "repeatable") {
    throw new ContentEngineError(
      `Field "${name}" is a ${fieldValue.kind} and has no column of its own. Flatten the field map with \`contentStorageColumns\` before building columns from it.`,
      { contentTypeId },
    );
  }

  if (
    (fieldValue.kind === "relation" || fieldValue.kind === "user") &&
    fieldValue.multiple
  ) {
    throw new ContentEngineError(
      `Field "${name}" is a to-many ${fieldValue.kind === "user" ? "user field" : "relation"}, whose values live in a generated junction table rather than in a column.`,
      { contentTypeId },
    );
  }

  switch (fieldValue.kind) {
    case "blocks":
      return jsonb().$type<AnyBlockInstance[]>().notNull().default([]);
    case "boolean":
      return withModifiers(boolean(), {
        defaultValue: fieldValue.defaultValue,
        nullable,
      });
    case "dateTime": {
      const column = nullable ? timestamp() : timestamp().notNull();

      return fieldValue.defaultNow ? column.defaultNow() : column;
    }
    case "enum":
      return withModifiers(
        varchar({
          enum: fieldValue.values as [string, ...string[]],
          length: fieldValue.length ?? CONTENT_ENUM_DEFAULT_LENGTH,
        }),
        { defaultValue: fieldValue.defaultValue, nullable },
      );
    case "file": {
      if (!reference) {
        throw new ContentEngineError(
          `Field "${name}" is a file reference but the \`core_files\` column was not resolved. This is an internal error.`,
          { contentTypeId },
        );
      }

      // RESTRICT, always, and not a per-field choice. `cascade` would delete an
      // article because somebody tidied up the Files screen, and `set null`
      // would blank a cover image with nothing to show it ever had one. Refusing
      // the *file* deletion is the only outcome that loses nothing - and it is
      // what makes `StorageModel.deleteFile` able to answer 409 rather than
      // leaving a content row pointing at bytes that are gone.
      const column = integer().references(reference, {
        onDelete: "restrict",
        onUpdate: "cascade",
      });

      return nullable ? column : column.notNull();
    }
    case "number":
      return withModifiers(fieldValue.integer ? integer() : doublePrecision(), {
        defaultValue: fieldValue.defaultValue,
        nullable,
      });
    case "relation":
    case "user": {
      if (!reference) {
        throw new ContentEngineError(
          `Field "${name}" is a ${fieldValue.kind} reference but no target column was resolved.`,
          { contentTypeId },
        );
      }

      // The column has the type of the key it points at: `integer` for a user
      // or a serial target, `uuid` or `bigint` for the other strategies.
      const column = (
        fieldValue.kind === "relation"
          ? buildIdForeignKey(referenceStrategy)
          : integer()
      ).references(reference, {
        onDelete: fieldValue.onDelete,
        // Identifiers are generated and never rewritten, so an update is only
        // ever a repair; cascade keeps children pointing at the right row.
        onUpdate: "cascade",
      });

      return nullable ? column : column.notNull();
    }
    // The very column a `textarea` generates, so switching a field between the
    // two is a change of contract and never a migration.
    case "richText":
    case "textarea":
      return withModifiers(text(), {
        defaultValue: fieldValue.defaultValue,
        nullable,
      });
    case "slug":
      // Always NOT NULL and never defaulted: a row nobody can address by URL
      // is not worth allowing, and there is no sensible default URL.
      return varchar({
        length: fieldValue.maxLength ?? CONTENT_SLUG_DEFAULT_LENGTH,
      }).notNull();
    case "text":
      return withModifiers(
        varchar({
          length: fieldValue.maxLength ?? CONTENT_TEXT_DEFAULT_LENGTH,
        }),
        { defaultValue: fieldValue.defaultValue, nullable },
      );
  }
};

/**
 * The plain-text twin of a searchable `richText` column. Nullable and never
 * defaulted: it is derived on every write, and `NULL` is what a row written
 * before the column existed holds until it is backfilled.
 */
export const buildContentSearchTextColumn = (): AnyPgColumnBuilder => text();
