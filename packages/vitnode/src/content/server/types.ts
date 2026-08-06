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
  ContentEditorialField,
  ContentFieldsOf,
  ContentLocalizedFieldName,
  ContentPublicationField,
  ContentSharedFieldName,
  ContentSystemField,
  ContentTranslationSystemField,
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

/** `version` - added only when the editorial workflow is enabled. */
export interface ContentEditorialColumnBuilders {
  version: NotNull<HasDefault<PgIntegerBuilderInitial<ColumnName>>>;
}

type EditorialColumnBuilders<TEditorial extends boolean> =
  TEditorial extends true
    ? ContentEditorialColumnBuilders
    : Record<never, never>;

export type ContentColumnBuilders<
  TFields,
  TPublication extends boolean = false,
  TEditorial extends boolean = false,
> = ContentSystemColumnBuilders &
  EditorialColumnBuilders<TEditorial> &
  PublicationColumnBuilders<TPublication> & {
    [K in keyof TFields]: ContentColumnBuilder<TFields[K]>;
  };

/** `itemId`, `languageId`, `version` and the timestamps. */
export interface ContentTranslationSystemColumnBuilders {
  createdAt: NotNull<HasDefault<PgTimestampBuilderInitial<ColumnName>>>;
  itemId: NotNull<PgIntegerBuilderInitial<ColumnName>>;
  languageId: NotNull<PgIntegerBuilderInitial<ColumnName>>;
  updatedAt: NotNull<HasDefault<PgTimestampBuilderInitial<ColumnName>>>;
  version: NotNull<HasDefault<PgIntegerBuilderInitial<ColumnName>>>;
}

export type ContentTranslationColumnBuilders<TFields> =
  ContentTranslationSystemColumnBuilders & {
    [K in keyof TFields]: ContentColumnBuilder<TFields[K]>;
  };

/**
 * The `pgTable` a localized content type's translations compile to.
 *
 * Built with Drizzle's own `BuildColumns`, exactly like {@link ContentTable}, so
 * `$inferSelect` and `$inferInsert` come out of the same machinery a
 * hand-written `pgTable` uses.
 */
export type ContentTranslationTable<
  TName extends string,
  TFields,
> = PgTableWithColumns<{
  columns: BuildColumns<TName, ContentTranslationColumnBuilders<TFields>, "pg">;
  dialect: "pg";
  name: TName;
  schema: undefined;
}>;

/**
 * The localized half of a field map, as a record.
 *
 * Spelled with a mapped type rather than `Pick` so the erased
 * `AnyContentTypeDefinition` - whose localized name union is `never` - resolves
 * to an empty record instead of to `never`.
 */
type LocalizedFieldsOf<TDefinition> = {
  [
    K in ContentLocalizedFieldName<TDefinition> &
      keyof ContentFieldsOf<TDefinition>
  ]: ContentFieldsOf<TDefinition>[K];
};

/**
 * The translation table for one definition.
 *
 * `string` rather than the literal translation table name: that name is derived
 * at *runtime* from `tableName` (suffixed, then clamped to 63 characters with a
 * fingerprint), and re-deriving the clamp in the type system would be a second
 * implementation of it. Nothing needs the literal - Drizzle only uses the name
 * parameter to prefix column names it never exposes by literal type.
 */
export type ContentTranslationTableFor<TDefinition> = ContentTranslationTable<
  string,
  LocalizedFieldsOf<TDefinition>
>;

/** Column name -> Drizzle column on the translation table. */
export type ContentTranslationColumnName<TDefinition> =
  ContentLocalizedFieldName<TDefinition> | ContentTranslationSystemField;

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
  TEditorial extends boolean = false,
> = PgTableWithColumns<{
  columns: BuildColumns<
    TName,
    ContentColumnBuilders<TFields, TPublication, TEditorial>,
    "pg"
  >;
  dialect: "pg";
  name: TName;
  schema: undefined;
}>;

/**
 * The shared half of a field map, as a record. See {@link LocalizedFieldsOf} for
 * why it is a mapped type rather than a `Pick`.
 */
type SharedFieldsOf<TDefinition> = {
  [
    K in ContentSharedFieldName<TDefinition> &
      keyof ContentFieldsOf<TDefinition>
  ]: ContentFieldsOf<TDefinition>[K];
};

/**
 * The base `pgTable` for one definition.
 *
 * Shared fields only. For a content type without localization every field is
 * shared, so this is exactly the table it always generated.
 */
export type ContentTableFor<TDefinition> = TDefinition extends {
  editorial: { enabled: infer TEditorial extends boolean };
  publication: { enabled: infer TPublication extends boolean };
  tableName: infer TName extends string;
}
  ? ContentTable<TName, SharedFieldsOf<TDefinition>, TPublication, TEditorial>
  : never;

/**
 * Column name -> Drizzle column, used for allowlisted filters and ordering.
 *
 * Shared fields only: a localized field is a column on the translation table,
 * and {@link ContentTranslationColumnName} is the union that names those.
 */
export type ContentColumnName<TDefinition> =
  | ContentSharedFieldName<TDefinition>
  | ContentSystemField
  | (TDefinition extends { editorial: { enabled: true } }
      ? ContentEditorialField
      : never)
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
