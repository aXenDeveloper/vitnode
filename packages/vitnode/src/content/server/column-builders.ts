import type { AnyPgColumn, PgColumnBuilderBase } from "drizzle-orm/pg-core";

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

/**
 * The three columns every content table gets, matching the conventions used by
 * all 22 core tables: a `serial` primary key, `defaultNow()` on `createdAt`,
 * and `defaultNow().$onUpdate(...)` on `updatedAt`.
 */
export const buildSystemColumns = (): Record<string, PgColumnBuilderBase> => ({
  id: serial().primaryKey(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * The two columns `publication: { enabled: true }` adds.
 *
 * `status` is `varchar` rather than a Postgres enum, matching how `field.enum`
 * is already materialised, so adding a status later is not a type migration. It
 * carries `DEFAULT 'draft' NOT NULL` so drizzle-kit backfills an existing table
 * in a single statement - every pre-existing row becomes a draft.
 *
 * `published_at` is nullable with no default: it means "first published at",
 * and `unpublish` deliberately leaves it alone.
 */
export const buildPublicationColumns = (): Record<
  string,
  PgColumnBuilderBase
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
 * The one column `editorial: { enabled: true }` adds.
 *
 * `DEFAULT 1 NOT NULL`, so drizzle-kit backfills an existing table in a single
 * statement and every pre-existing row starts at version 1 - the same property
 * that makes adding `status DEFAULT 'draft'` safe.
 *
 * Never written by `create` or `update`: the editorial service increments it in
 * the same conditional `UPDATE` that guards on it, which is what makes the
 * check-and-set atomic.
 */
export const buildEditorialColumns = (): Record<
  string,
  PgColumnBuilderBase
> => ({
  version: integer().notNull().default(1),
});

/**
 * The columns every generated translation table carries.
 *
 * `itemId` and `languageId` are the composite primary key, added by
 * `createContentTranslationTable` - both are `NOT NULL` here because a key
 * column has to be, and both are written by the service rather than by a
 * request.
 *
 * `version` mirrors the editorial column deliberately: a translation has *its
 * own* optimistic lock, so an edit in Polish and an edit in English cannot
 * conflict with each other. It defaults to 1 and is only ever moved by the
 * conditional `UPDATE` that guards on it.
 */
export const buildTranslationSystemColumns = ({
  itemReference,
  languageReference,
  onItemDelete = "cascade",
}: {
  itemReference: ColumnReferenceThunk;
  languageReference: ColumnReferenceThunk;
  onItemDelete?: "cascade";
}): Record<string, PgColumnBuilderBase> => ({
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

/**
 * Applies `NOT NULL` and the column default.
 *
 * Written as a generic over the concrete builder so each `default(...)` call
 * sees the narrowed value type - a single shared `default()` at the end would
 * have to accept the union of every field kind's value.
 */
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

/**
 * Compiles one field descriptor into a Drizzle column builder.
 *
 * `nullable` drives `NOT NULL`, and a declared `defaultValue` becomes the
 * column default so Postgres and the generated Zod schema agree.
 */
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
}): PgColumnBuilderBase => {
  const { nullable } = fieldValue;

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
