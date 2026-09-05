import type {
  AnyPgColumnBuilder,
  PgBooleanBuilder,
  PgBuildColumns,
  PgDoublePrecisionBuilder,
  PgIntegerBuilder,
  PgSerialBuilder,
  PgTableWithColumns,
  PgTextBuilder,
  PgTimestampBuilder,
  PgVarcharBuilder,
  SetHasDefault,
  SetNotNull,
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

type EnumValuesOf<TField> = TField extends {
  values: readonly [
    infer THead extends string,
    ...infer TRest extends string[],
  ];
}
  ? [THead, ...TRest]
  : [string, ...string[]];

type BaseBuilderFor<TField> = TField extends { kind: "boolean" }
  ? PgBooleanBuilder
  : TField extends { kind: "dateTime" }
    ? PgTimestampBuilder
    : TField extends { kind: "enum" }
      ? PgVarcharBuilder<EnumValuesOf<TField>>
      : TField extends { integer: false; kind: "number" }
        ? PgDoublePrecisionBuilder
        : TField extends { kind: "number" | "relation" | "user" }
          ? PgIntegerBuilder
          : TField extends { kind: "textarea" }
            ? PgTextBuilder
            : PgVarcharBuilder;

type ApplyDefault<TBuilder extends AnyPgColumnBuilder, TField> =
  HasColumnDefault<TField> extends true ? SetHasDefault<TBuilder> : TBuilder;

type ApplyModifiers<
  TBuilder extends AnyPgColumnBuilder,
  TField,
> = TField extends { nullable: true }
  ? ApplyDefault<TBuilder, TField>
  : SetNotNull<ApplyDefault<TBuilder, TField>>;

// `infer TBuilder extends AnyPgColumnBuilder` is what proves to TypeScript that
// the conditional above resolves to a builder, so `NotNull`/`HasDefault` apply.
export type ContentColumnBuilder<TField> =
  BaseBuilderFor<TField> extends infer TBuilder extends AnyPgColumnBuilder
    ? ApplyModifiers<TBuilder, TField>
    : never;

/** `id`, `createdAt` and `updatedAt` - added to every content table. */
export interface ContentSystemColumnBuilders {
  createdAt: SetNotNull<SetHasDefault<PgTimestampBuilder>>;
  id: PgSerialBuilder;
  updatedAt: SetNotNull<SetHasDefault<PgTimestampBuilder>>;
}

/** `status` and `publishedAt` - added only when publication is enabled. */
export interface ContentPublicationColumnBuilders {
  publishedAt: PgTimestampBuilder;
  status: SetNotNull<SetHasDefault<PgVarcharBuilder<["draft", "published"]>>>;
}

type PublicationColumnBuilders<TPublication extends boolean> =
  TPublication extends true
    ? ContentPublicationColumnBuilders
    : Record<never, never>;

/** `version` - added only when the editorial workflow is enabled. */
export interface ContentEditorialColumnBuilders {
  version: SetNotNull<SetHasDefault<PgIntegerBuilder>>;
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
  createdAt: SetNotNull<SetHasDefault<PgTimestampBuilder>>;
  itemId: SetNotNull<PgIntegerBuilder>;
  languageId: SetNotNull<PgIntegerBuilder>;
  updatedAt: SetNotNull<SetHasDefault<PgTimestampBuilder>>;
  version: SetNotNull<SetHasDefault<PgIntegerBuilder>>;
}

export type ContentTranslationColumnBuilders<
  TFields,
  TPublication extends boolean = false,
> = ContentTranslationSystemColumnBuilders &
  PublicationColumnBuilders<TPublication> & {
    [K in keyof TFields]: ContentColumnBuilder<TFields[K]>;
  };

export type ContentTranslationTable<
  TName extends string,
  TFields,
  TPublication extends boolean = false,
> = PgTableWithColumns<{
  columns: PgBuildColumns<
    TName,
    ContentTranslationColumnBuilders<TFields, TPublication>
  >;
  dialect: "pg";
  name: TName;
  schema: undefined;
}>;

type LocalizedFieldsOf<TDefinition> = ContentStorageFields<{
  [
    K in ContentLocalizedFieldName<TDefinition> &
      keyof ContentFieldsOf<TDefinition>
  ]: ContentFieldsOf<TDefinition>[K];
}>;

export type ContentTranslationTableFor<TDefinition> = TDefinition extends {
  publication: { enabled: infer TPublication extends boolean };
}
  ? ContentTranslationTable<
      string,
      LocalizedFieldsOf<TDefinition>,
      TPublication
    >
  : never;

export type ContentTranslationColumnName<TDefinition> =
  | ContentLocalizedFieldName<TDefinition>
  | ContentTranslationSystemField
  | (TDefinition extends { publication: { enabled: true } }
      ? ContentPublicationField
      : never);

export type ContentTable<
  TName extends string,
  TFields,
  TPublication extends boolean = false,
  TEditorial extends boolean = false,
> = PgTableWithColumns<{
  columns: PgBuildColumns<
    TName,
    ContentColumnBuilders<TFields, TPublication, TEditorial>
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
  columns: PgBuildColumns<
    string,
    {
      createdAt: SetNotNull<SetHasDefault<PgTimestampBuilder>>;
      itemId: SetNotNull<PgIntegerBuilder>;
      position: SetNotNull<PgIntegerBuilder>;
      relatedItemId: SetNotNull<PgIntegerBuilder>;
    }
  >;
  dialect: "pg";
  name: string;
  schema: undefined;
}>;

/** The generated child table for one repeatable field. */
export type ContentRepeatableChildTable<TFields> = PgTableWithColumns<{
  columns: PgBuildColumns<
    string,
    {
      [K in keyof TFields]: ContentColumnBuilder<TFields[K]>;
    } & {
      createdAt: SetNotNull<SetHasDefault<PgTimestampBuilder>>;
      id: PgSerialBuilder;
      itemId: SetNotNull<PgIntegerBuilder>;
      position: SetNotNull<PgIntegerBuilder>;
      updatedAt: SetNotNull<SetHasDefault<PgTimestampBuilder>>;
    }
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
  PgIntegerBuilder["references"]
>[0] extends () => infer TColumn
  ? TColumn
  : never;
