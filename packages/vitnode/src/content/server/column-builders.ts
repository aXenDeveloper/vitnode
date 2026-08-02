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
