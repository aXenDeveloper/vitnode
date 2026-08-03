import type {
  BuildColumns,
  ColumnBuilderBase,
  HasDefault,
  NotNull,
} from "drizzle-orm";
import type {
  PgBooleanBuilderInitial,
  PgDoublePrecisionBuilderInitial,
  PgIntegerBuilderInitial,
  PgSerialBuilderInitial,
  PgTableWithColumns,
  PgTextBuilderInitial,
  PgTimestampBuilderInitial,
  PgVarcharBuilderInitial,
} from "drizzle-orm/pg-core";

import type {
  ContentFieldsOf,
  ContentPublicationField,
  ContentSystemField,
  HasColumnDefault,
} from "../types";

/**
 * Columns are declared with the `pgTable(name, t => ({ ... }))` callback form
 * used across the repo, so the builder-level name is always empty and Drizzle
 * derives the real one from the object key.
 */
type ColumnName = "";

type EnumValuesOf<TField> = TField extends {
  values: readonly [
    infer THead extends string,
    ...infer TRest extends string[],
  ];
}
  ? [THead, ...TRest]
  : [string, ...string[]];

/** The Drizzle builder a single field descriptor compiles to. */
type BaseBuilderFor<TField> = TField extends { kind: "boolean" }
  ? PgBooleanBuilderInitial<ColumnName>
  : TField extends { kind: "dateTime" }
    ? PgTimestampBuilderInitial<ColumnName>
    : TField extends { kind: "enum" }
      ? PgVarcharBuilderInitial<ColumnName, EnumValuesOf<TField>, number>
      : TField extends { integer: false; kind: "number" }
        ? PgDoublePrecisionBuilderInitial<ColumnName>
        : TField extends { kind: "number" | "relation" | "user" }
          ? PgIntegerBuilderInitial<ColumnName>
          : TField extends { kind: "textarea" }
            ? PgTextBuilderInitial<ColumnName, [string, ...string[]]>
            : PgVarcharBuilderInitial<
                ColumnName,
                [string, ...string[]],
                number
              >;

type ApplyDefault<TBuilder extends ColumnBuilderBase, TField> =
  HasColumnDefault<TField> extends true ? HasDefault<TBuilder> : TBuilder;

type ApplyModifiers<
  TBuilder extends ColumnBuilderBase,
  TField,
> = TField extends { nullable: true }
  ? ApplyDefault<TBuilder, TField>
  : NotNull<ApplyDefault<TBuilder, TField>>;

// `infer TBuilder extends ColumnBuilderBase` is what proves to TypeScript that
// the conditional above resolves to a builder, so `NotNull`/`HasDefault` apply.
export type ContentColumnBuilder<TField> =
  BaseBuilderFor<TField> extends infer TBuilder extends ColumnBuilderBase
    ? ApplyModifiers<TBuilder, TField>
    : never;

/** `id`, `createdAt` and `updatedAt` - added to every content table. */
export interface ContentSystemColumnBuilders {
  createdAt: NotNull<HasDefault<PgTimestampBuilderInitial<ColumnName>>>;
  id: PgSerialBuilderInitial<ColumnName>;
  updatedAt: NotNull<HasDefault<PgTimestampBuilderInitial<ColumnName>>>;
}

/** `status` and `publishedAt` - added only when publication is enabled. */
export interface ContentPublicationColumnBuilders {
  publishedAt: PgTimestampBuilderInitial<ColumnName>;
  status: NotNull<
    HasDefault<
      PgVarcharBuilderInitial<ColumnName, ["draft", "published"], number>
    >
  >;
}

type PublicationColumnBuilders<TPublication extends boolean> =
  TPublication extends true
    ? ContentPublicationColumnBuilders
    : Record<never, never>;

export type ContentColumnBuilders<
  TFields,
  TPublication extends boolean = false,
> = ContentSystemColumnBuilders &
  PublicationColumnBuilders<TPublication> & {
    [K in keyof TFields]: ContentColumnBuilder<TFields[K]>;
  };

/**
 * The `pgTable` a content type compiles to.
 *
 * Built with Drizzle's own `BuildColumns`, so `$inferSelect` and `$inferInsert`
 * come out of the same machinery a hand-written `pgTable` uses.
 */
export type ContentTable<
  TName extends string,
  TFields,
  TPublication extends boolean = false,
> = PgTableWithColumns<{
  columns: BuildColumns<
    TName,
    ContentColumnBuilders<TFields, TPublication>,
    "pg"
  >;
  dialect: "pg";
  name: TName;
  schema: undefined;
}>;

export type ContentTableFor<TDefinition> = TDefinition extends {
  publication: { enabled: infer TPublication extends boolean };
  tableName: infer TName extends string;
}
  ? ContentTable<TName, ContentFieldsOf<TDefinition>, TPublication>
  : never;

/** Column name -> Drizzle column, used for allowlisted filters and ordering. */
export type ContentColumnName<TDefinition> =
  | ContentSystemField
  | (keyof ContentFieldsOf<TDefinition> & string)
  | (TDefinition extends { publication: { enabled: true } }
      ? ContentPublicationField
      : never);

/**
 * One thunk per `relation` field, resolving to the target table's `id`. Missing
 * or extra keys are a compile error, and the thunk keeps circular content type
 * references safe - Drizzle resolves it lazily, at serialization time.
 */
export type ContentReferences<TFields> = {
  [
    K in keyof TFields as TFields[K] extends { kind: "relation" } ? K : never
  ]: () => AnyIdColumn;
};

// Loosest shape a foreign key target can take; the FK itself is validated by
// Postgres, and by `getTableConfig` in the table tests.
type AnyIdColumn = Parameters<
  PgIntegerBuilderInitial<ColumnName>["references"]
>[0] extends () => infer TColumn
  ? TColumn
  : never;
