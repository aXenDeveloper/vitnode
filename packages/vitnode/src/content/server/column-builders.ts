import type { AnyPgColumn, AnyPgColumnBuilder } from "drizzle-orm/pg-core";

import {
  boolean,
  doublePrecision,
  integer,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

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

export const buildSystemColumns = (): Record<string, AnyPgColumnBuilder> => ({
  id: serial().primaryKey(),
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

export const buildEditorialColumns = (): Record<
  string,
  AnyPgColumnBuilder
> => ({
  version: integer().notNull().default(1),
});

export const buildTranslationSystemColumns = ({
  itemReference,
  languageReference,
  onItemDelete = "cascade",
}: {
  itemReference: ColumnReferenceThunk;
  languageReference: ColumnReferenceThunk;
  onItemDelete?: "cascade";
}): Record<string, AnyPgColumnBuilder> => ({
  itemId: integer()
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
}: {
  contentTypeId: string;
  fieldValue: ContentFieldDescriptor;
  name: string;
  reference?: ColumnReferenceThunk;
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

      const column = integer().references(reference, {
        onDelete: fieldValue.onDelete,
        // Identifiers are `serial`, so an update is only ever a repair; cascade
        // keeps children pointing at the right row either way.
        onUpdate: "cascade",
      });

      return nullable ? column : column.notNull();
    }
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
    case "textarea":
      return withModifiers(text(), {
        defaultValue: fieldValue.defaultValue,
        nullable,
      });
  }
};
