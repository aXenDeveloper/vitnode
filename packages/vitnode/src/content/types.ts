import type { CONTENT_SYSTEM_FIELDS } from "./const";
import type { ContentSchemas } from "./schemas";

export type ContentSystemField = (typeof CONTENT_SYSTEM_FIELDS)[number];

export type ContentOnDelete = "cascade" | "restrict" | "set null";

/** Flattens intersections so editor tooltips show the real shape. */
export type Prettify<T> = { [K in keyof T]: T[K] } & {};

// ---------------------------------------------------------------------------
// Field descriptors
//
// Descriptors are plain, JSON-shaped data: no Drizzle, no React, no Hono. Only
// `relation.target` is a function, and only so two content types can reference
// each other without a circular import. `required` and `nullable` are literal
// type parameters because create-input optionality and value nullability are
// derived from them.
// ---------------------------------------------------------------------------

export interface ContentFieldShared<
  TRequired extends boolean = boolean,
  TNullable extends boolean = boolean,
> {
  /** Free text or an i18n key surfaced in AdminCP and OpenAPI. */
  description?: string;
  /** Column accepts NULL, and `null` is a legal value. */
  nullable: TNullable;
  /** Must be present in the create payload. */
  required: TRequired;
}

export interface ContentTextField<
  TRequired extends boolean = boolean,
  TNullable extends boolean = boolean,
  TDefault extends string | undefined = string | undefined,
> extends ContentFieldShared<TRequired, TNullable> {
  // Declared non-optional (but possibly `undefined`) so `HasColumnDefault` can
  // tell "no default" from "defaulted": an optional property would always
  // include `undefined` in its type and the distinction would be lost.
  defaultValue: TDefault;
  kind: "text";
  maxLength?: number;
  minLength?: number;
  /** Adds a unique index on the column. See {@link ContentIndexInput}. */
  unique?: boolean;
}

export interface ContentTextareaField<
  TRequired extends boolean = boolean,
  TNullable extends boolean = boolean,
  TDefault extends string | undefined = string | undefined,
> extends ContentFieldShared<TRequired, TNullable> {
  defaultValue: TDefault;
  kind: "textarea";
  maxLength?: number;
  minLength?: number;
}

export interface ContentNumberField<
  TRequired extends boolean = boolean,
  TNullable extends boolean = boolean,
  TDefault extends number | undefined = number | undefined,
> extends ContentFieldShared<TRequired, TNullable> {
  defaultValue: TDefault;
  /** `true` -> `integer`, `false` -> `double precision`. Always explicit. */
  integer: boolean;
  kind: "number";
  max?: number;
  min?: number;
}

export interface ContentBooleanField<
  TRequired extends boolean = boolean,
  TNullable extends boolean = boolean,
  TDefault extends boolean | undefined = boolean | undefined,
> extends ContentFieldShared<TRequired, TNullable> {
  defaultValue: TDefault;
  kind: "boolean";
}

export interface ContentEnumField<
  TValues extends readonly [string, ...string[]] = readonly [
    string,
    ...string[],
  ],
  TRequired extends boolean = boolean,
  TNullable extends boolean = boolean,
  TDefault extends TValues[number] | undefined = TValues[number] | undefined,
> extends ContentFieldShared<TRequired, TNullable> {
  defaultValue: TDefault;
  /** AdminCP presentation only - storage is always `varchar`. */
  display?: "radio" | "select";
  kind: "enum";
  /** `varchar` length; defaults to 64. */
  length?: number;
  values: TValues;
}

export interface ContentDateTimeField<
  TRequired extends boolean = boolean,
  TNullable extends boolean = boolean,
  TDefaultNow extends boolean = boolean,
> extends ContentFieldShared<TRequired, TNullable> {
  defaultNow: TDefaultNow;
  kind: "dateTime";
}

export interface ContentUserField<
  TRequired extends boolean = boolean,
  TNullable extends boolean = boolean,
> extends ContentFieldShared<TRequired, TNullable> {
  kind: "user";
  onDelete: ContentOnDelete;
}

export interface ContentRelationField<
  TRequired extends boolean = boolean,
  TNullable extends boolean = boolean,
> extends ContentFieldShared<TRequired, TNullable> {
  kind: "relation";
  onDelete: ContentOnDelete;
  /** Thunk so two content types can reference each other. */
  target: () => AnyContentTypeDefinition;
}

export type ContentFieldDescriptor =
  | ContentBooleanField
  | ContentDateTimeField
  | ContentEnumField
  | ContentNumberField
  | ContentRelationField
  | ContentTextareaField
  | ContentTextField
  | ContentUserField;

export type ContentFieldKind = ContentFieldDescriptor["kind"];

export type ContentFieldMap = Record<string, ContentFieldDescriptor>;

/**
 * Type-parameter constraint for a field map - deliberately shallow.
 *
 * A constraint becomes a contextual type for the argument, so constraining to
 * `ContentFieldMap` would contextually type every `field.*()` call with
 * `ContentFieldDescriptor` and widen `required`, `nullable` and enum `values`
 * back to their generic defaults. Mentioning only `kind` still rejects
 * non-descriptors while leaving literal inference intact, and the reserved
 * system columns stay a compile error.
 */
export type ContentFieldsConstraint = Partial<
  Record<ContentSystemField, never>
> &
  Record<string, { kind: ContentFieldKind }>;

/** Fields that hold a foreign key to another row. */
export type ContentReferenceField = ContentRelationField | ContentUserField;

// ---------------------------------------------------------------------------
// Value inference
// ---------------------------------------------------------------------------

type ApplyNullable<TValue, TField> = TField extends { nullable: true }
  ? null | TValue
  : TValue;

/**
 * The value as it comes back from the API (`select`).
 *
 * Structural on purpose: `TField` is unconstrained so this also works with the
 * shallow {@link ContentFieldsConstraint}.
 */
export type ContentFieldValue<TField> = ApplyNullable<
  TField extends { kind: "boolean" }
    ? boolean
    : TField extends { kind: "dateTime" }
      ? Date
      : TField extends { values: readonly (infer TValue)[] }
        ? TValue
        : TField extends { kind: "number" | "relation" | "user" }
          ? number
          : string,
  TField
>;

/**
 * The value as it is sent to the API. Identical to the select value except for
 * `dateTime`, which crosses the wire (and the AutoForm) as an ISO 8601 string -
 * `z.toJSONSchema` throws on `z.date()`, so a form schema can never hold one.
 */
export type ContentFieldInput<TField> = ApplyNullable<
  TField extends { kind: "boolean" }
    ? boolean
    : TField extends { kind: "dateTime" }
      ? string
      : TField extends { values: readonly (infer TValue)[] }
        ? TValue
        : TField extends { kind: "number" | "relation" | "user" }
          ? number
          : string,
  TField
>;

/**
 * Whether the generated column carries a Postgres default. Drives `hasDefault`
 * on the Drizzle column, and therefore `$inferInsert`.
 */
export type HasColumnDefault<TField> = TField extends { kind: "dateTime" }
  ? TField extends { defaultNow: true }
    ? true
    : false
  : TField extends { defaultValue: infer TDefault }
    ? [TDefault] extends [undefined]
      ? false
      : true
    : false;

type RequiredFieldKeys<TFields> = {
  [K in keyof TFields]: TFields[K] extends { required: true } ? K : never;
}[keyof TFields];

// ---------------------------------------------------------------------------
// Admin metadata
// ---------------------------------------------------------------------------

export interface ContentAdminLabel {
  plural: string;
  singular: string;
}

export interface ContentAdminListConfig<TFields = ContentFieldMap> {
  /** Columns shown in the DataTable, in order. Defaults to every field. */
  columns?: (ContentSystemField | keyof TFields)[];
  defaultOrder?: "asc" | "desc";
  defaultOrderBy?: ContentSystemField | keyof TFields;
  /** Allowlist for `orderBy`. System columns are always allowed. */
  orderableFields?: (keyof TFields)[];
  /** Only `text` and `textarea` fields may be searched. */
  searchableFields?: (keyof TFields)[];
}

export interface ContentAdminConfig<TFields = ContentFieldMap> {
  form?: { fields?: (keyof TFields)[] };
  label: ContentAdminLabel;
  list?: ContentAdminListConfig<TFields>;
  navigation?: { enabled?: boolean };
  /**
   * Staff permission module name. Defaults to a slug of `label.plural`, e.g.
   * "Articles" -> `articles`.
   */
  permissionModule?: string;
  /** Field used as the human-readable title in toasts and relation pickers. */
  titleField?: keyof TFields;
}

/**
 * `admin` after `defineContentType` has filled in every default.
 *
 * Deliberately not generic over the field map: keeping `keyof TFields` here
 * would make `ContentTypeDefinition` invariant, and a concrete definition could
 * no longer be assigned to `AnyContentTypeDefinition` - which every relation
 * thunk and every registry needs. Field names are validated at define time, so
 * the narrower type bought nothing.
 */
export interface ResolvedContentAdminConfig {
  form: { fields: string[] };
  label: ContentAdminLabel;
  list: {
    columns: string[];
    defaultOrder: "asc" | "desc";
    defaultOrderBy: string;
    orderableFields: string[];
    searchableFields: string[];
  };
  navigation: { enabled: boolean };
  titleField: null | string;
}

/**
 * Authoring shape - column names are checked against the field map.
 *
 * A declared index and a generated one covering the same columns collapse into
 * a single index; see `resolveContentIndexes`.
 */
export interface ContentIndexInput<TFields = ContentFieldMap> {
  /** Defaults to `<table>_<columns>_idx`, or `_key` when unique. */
  name?: string;
  on: [
    ContentSystemField | (keyof TFields & string),
    ...(ContentSystemField | (keyof TFields & string))[],
  ];
  unique?: boolean;
}

/**
 * Stored shape. Non-generic for the same reason as
 * {@link ResolvedContentAdminConfig} - `keyof TFields` would make
 * `ContentTypeDefinition` invariant.
 */
export interface ContentIndexConfig {
  name?: string;
  on: string[];
  unique?: boolean;
}

/**
 * An index after `defineContentType` has expanded the automatic ones, resolved
 * every name and dropped the duplicates. This is what the table generator
 * materialises, one to one.
 */
export interface ResolvedContentIndex {
  name: string;
  on: string[];
  unique: boolean;
}

// ---------------------------------------------------------------------------
// Definition
// ---------------------------------------------------------------------------

export interface ContentTypeDefinition<
  TId extends string = string,
  TFields = ContentFieldMap,
> {
  admin: ResolvedContentAdminConfig;
  fields: TFields;
  id: TId;
  /** Declared indexes plus the automatic ones, deduplicated and named. */
  indexes: ResolvedContentIndex[];
  /** Derived from `admin.permissionModule` or `admin.label.plural`. */
  permissionModule: string;
  /** Zod schemas generated from `fields`. */
  schemas: ContentSchemas<ContentTypeDefinition<TId, TFields>>;
  tableName: string;
}

/** Use in constraints where the concrete field map does not matter. */
export type AnyContentTypeDefinition = ContentTypeDefinition;

export type ContentFieldsOf<TDefinition> = TDefinition extends {
  fields: infer TFields;
}
  ? TFields
  : never;

export type ContentSelect<TDefinition> = Prettify<
  {
    [K in keyof ContentFieldsOf<TDefinition>]: ContentFieldValue<
      ContentFieldsOf<TDefinition>[K]
    >;
  } & { createdAt: Date; id: number; updatedAt: Date }
>;

export type ContentCreateInput<TDefinition> = Prettify<
  {
    [
      K in Exclude<
        keyof ContentFieldsOf<TDefinition>,
        RequiredFieldKeys<ContentFieldsOf<TDefinition>>
      >
    ]?: ContentFieldInput<ContentFieldsOf<TDefinition>[K]>;
  } & {
    [K in RequiredFieldKeys<ContentFieldsOf<TDefinition>>]: ContentFieldInput<
      ContentFieldsOf<TDefinition>[K]
    >;
  }
>;

export type ContentUpdateInput<TDefinition> = Prettify<
  Partial<ContentCreateInput<TDefinition>>
>;

export type ContentFieldName<TDefinition> = keyof ContentFieldsOf<TDefinition> &
  string;

type FieldNamesOfKind<TDefinition, TKind extends ContentFieldKind> = string &
  {
    [
      K in keyof ContentFieldsOf<TDefinition>
    ]: ContentFieldsOf<TDefinition>[K] extends {
      kind: TKind;
    }
      ? K
      : never;
  }[keyof ContentFieldsOf<TDefinition>];

/**
 * Kinds the generated filter schema understands. `textarea` and `dateTime` are
 * absent on purpose: equality on a body of prose or on an exact timestamp is
 * never what anyone means.
 */
export type FilterableContentFieldKind =
  "boolean" | "enum" | "number" | "relation" | "text" | "user";

export type FilterableContentFieldName<TDefinition> = FieldNamesOfKind<
  TDefinition,
  FilterableContentFieldKind
>;

/** Equality filters accepted by `service.findMany`, one key per filterable field. */
export type ContentFilterInput<TDefinition> = Partial<{
  [K in FilterableContentFieldName<TDefinition>]: ContentFieldInput<
    ContentFieldsOf<TDefinition>[K]
  >;
}>;

/**
 * Columns `service.findMany` may order by.
 *
 * A compile-time approximation, and deliberately so: `admin.list.orderableFields`
 * is stored on the *resolved* (non-generic) admin config, so the configured
 * array is not recoverable as a type. Every field name is accepted here, and
 * the narrower runtime allowlist rejects the ones that were not configured.
 */
export type ContentOrderableFieldName<TDefinition> =
  ContentFieldName<TDefinition> | ContentSystemField;

/** Fields with a picker - the only ones `service.options` can enumerate. */
export type ContentReferenceFieldName<TDefinition> = FieldNamesOfKind<
  TDefinition,
  "relation" | "user"
>;
