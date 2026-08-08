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
  ContentLeafPath,
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

export type ContentTranslationColumnBuilders<
  TFields,
  TPublication extends boolean = false,
> = ContentTranslationSystemColumnBuilders &
  PublicationColumnBuilders<TPublication> & {
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
  TPublication extends boolean = false,
> = PgTableWithColumns<{
  columns: BuildColumns<
    TName,
    ContentTranslationColumnBuilders<TFields, TPublication>,
    "pg"
  >;
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
type LocalizedFieldsOf<TDefinition> = ContentStorageFields<{
  [
    K in ContentLocalizedFieldName<TDefinition> &
      keyof ContentFieldsOf<TDefinition>
  ]: ContentFieldsOf<TDefinition>[K];
}>;

/**
 * The translation table for one definition.
 *
 * `string` rather than the literal translation table name: that name is derived
 * at *runtime* from `tableName` (suffixed, then clamped to 63 characters with a
 * fingerprint), and re-deriving the clamp in the type system would be a second
 * implementation of it. Nothing needs the literal - Drizzle only uses the name
 * parameter to prefix column names it never exposes by literal type.
 */
export type ContentTranslationTableFor<TDefinition> = TDefinition extends {
  publication: { enabled: infer TPublication extends boolean };
}
  ? ContentTranslationTable<
      string,
      LocalizedFieldsOf<TDefinition>,
      TPublication
    >
  : never;

/**
 * Column name -> Drizzle column on the translation table.
 *
 * The publication pair is gated exactly like {@link ContentColumnName} gates it
 * on the base table: a translation only carries `status` and `publishedAt` when
 * the content type has a lifecycle for them to describe.
 */
export type ContentTranslationColumnName<TDefinition> =
  | ContentLocalizedFieldName<TDefinition>
  | ContentTranslationSystemField
  | (TDefinition extends { publication: { enabled: true } }
      ? ContentPublicationField
      : never);

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
 * The type-level twin of `contentStorageColumns`.
 *
 * A field map, flattened into the columns it actually generates: scalars keep
 * their names, a group contributes `seoTitle` per leaf, and the two collection
 * kinds vanish because neither is a column here. Spelled out in the type system
 * as well as at runtime because `$inferSelect` and `$inferInsert` are what a
 * plugin's own hand-written queries are checked against - a table type that
 * still said `seo: <group>` would type-check code Postgres then rejects.
 */
export type ContentStorageFields<TFields> = GroupLeafColumnsOf<TFields> &
  ScalarFieldsOf<TFields>;

type ScalarFieldsOf<TFields> = {
  [
    K in keyof TFields as TFields[K] extends { kind: "group" | "repeatable" }
      ? never
      : TFields[K] extends { kind: "relation"; multiple: true }
        ? never
        : K
  ]: TFields[K];
};

/**
 * Every group leaf column of a field map, keyed by its generated column name.
 *
 * Written as **one** mapped type over the union of canonical paths rather than
 * as a per-group union folded back with the usual `UnionToIntersection` trick.
 * That trick puts the union in a function-parameter position, which makes
 * `TDefinition` contravariant in `ContentTableFor` and therefore invariant in
 * `ContentModel` - and an invariant `ContentModel<T>` is no longer assignable to
 * `ContentModel<AnyContentTypeDefinition>`, which every route builder and every
 * registry needs. It is the same trap `ResolvedContentAdminConfig` documents,
 * reached from a different direction.
 */
type GroupLeafColumnsOf<TFields> = {
  [
    TPath in GroupLeafPathsOf<TFields> as ColumnNameOfPath<TPath>
  ]: LeafDescriptorAt<TFields, TPath>;
};

/** `"seo.title" | "seo.description"`, over a field map's groups. */
type GroupLeafPathsOf<TFields> = {
  [K in keyof TFields]: TFields[K] extends {
    fields: infer TInner;
    kind: "group";
  }
    ? `${K & string}.${keyof TInner & string}`
    : never;
}[keyof TFields];

/** The type-level twin of `contentLeafColumnName`. */
type ColumnNameOfPath<TPath> = TPath extends `${infer TOwner}.${infer TLeaf}`
  ? `${TOwner}${Capitalize<TLeaf>}`
  : never;

type LeafDescriptorAt<TFields, TPath> =
  TPath extends `${infer TOwner}.${infer TLeaf}`
    ? TOwner extends keyof TFields
      ? TFields[TOwner] extends { fields: infer TInner }
        ? TLeaf extends keyof TInner
          ? TInner[TLeaf]
          : never
        : never
      : never
    : never;

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
  ? ContentTable<
      TName,
      ContentStorageFields<SharedFieldsOf<TDefinition>>,
      TPublication,
      TEditorial
    >
  : never;

/**
 * Column name -> Drizzle column, used for allowlisted filters and ordering.
 *
 * Shared fields only: a localized field is a column on the translation table,
 * and {@link ContentTranslationColumnName} is the union that names those.
 *
 * A group appears as its generated leaf columns **and** under its canonical
 * paths: `contentTableColumns` registers `seo.title` as an alias of `seoTitle`,
 * so a filter, an `orderBy` or a search that was configured in paths resolves
 * without every one of them learning the mapping.
 */
export type ContentColumnName<TDefinition> =
  | ContentLeafPath<ContentFieldsOf<TDefinition>>
  | ContentSystemField
  | (keyof ContentStorageFields<SharedFieldsOf<TDefinition>> & string)
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
 *
 * A **to-many** relation needs one too: its foreign key is `relatedItemId` on
 * the generated junction table rather than a column on the row, but the target
 * it points at is exactly as much a fact the database module has to supply.
 *
 * A **self**-relation does not, and must not: `() => thisContent.table.id`
 * would reference the model inside its own initializer, and TypeScript resolves
 * that by widening the model to `any` - silently taking every typed service,
 * schema and column map with it. `createContentModel` resolves it from the
 * table it is building, which is the only place that reference exists anyway.
 */
export type ContentReferences<TFields> = {
  [
    K in keyof TFields as TFields[K] extends { kind: "relation"; self: true }
      ? never
      : TFields[K] extends { kind: "relation" }
        ? K
        : never
  ]: () => AnyIdColumn;
};

/**
 * The generated junction table for one to-many relation field.
 *
 * `string` for the table name for the same reason
 * {@link ContentTranslationTableFor} uses one: the name is derived at runtime
 * and clamped with a fingerprint, and re-deriving that clamp in the type system
 * would be a second implementation of it.
 */
export type ContentJunctionTable = PgTableWithColumns<{
  columns: BuildColumns<
    string,
    {
      createdAt: NotNull<HasDefault<PgTimestampBuilderInitial<ColumnName>>>;
      itemId: NotNull<PgIntegerBuilderInitial<ColumnName>>;
      position: NotNull<PgIntegerBuilderInitial<ColumnName>>;
      relatedItemId: NotNull<PgIntegerBuilderInitial<ColumnName>>;
    },
    "pg"
  >;
  dialect: "pg";
  name: string;
  schema: undefined;
}>;

/** The generated child table for one repeatable field. */
export type ContentRepeatableChildTable<TFields> = PgTableWithColumns<{
  columns: BuildColumns<
    string,
    {
      [K in keyof TFields]: ContentColumnBuilder<TFields[K]>;
    } & {
      createdAt: NotNull<HasDefault<PgTimestampBuilderInitial<ColumnName>>>;
      id: PgSerialBuilderInitial<ColumnName>;
      itemId: NotNull<PgIntegerBuilderInitial<ColumnName>>;
      position: NotNull<PgIntegerBuilderInitial<ColumnName>>;
      updatedAt: NotNull<HasDefault<PgTimestampBuilderInitial<ColumnName>>>;
    },
    "pg"
  >;
  dialect: "pg";
  name: string;
  schema: undefined;
}>;

/** Every generated collection table of one content type, by field name. */
export interface ContentAdvancedTables {
  junctions: Record<string, ContentJunctionTable>;
  repeatables: Record<string, ContentRepeatableChildTable<unknown>>;
}

// Loosest shape a foreign key target can take; the FK itself is validated by
// Postgres, and by `getTableConfig` in the table tests.
type AnyIdColumn = Parameters<
  PgIntegerBuilderInitial<ColumnName>["references"]
>[0] extends () => infer TColumn
  ? TColumn
  : never;
