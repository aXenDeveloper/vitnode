import type {
  CONTENT_FILTERABLE_FIELD_KINDS,
  CONTENT_PUBLIC_EXPOSABLE_COLUMNS,
  CONTENT_PUBLICATION_FIELDS,
  CONTENT_PUBLICATION_STATUSES,
  CONTENT_SYSTEM_FIELDS,
} from "./const";
import type { ContentSchemas } from "./schemas";

export type ContentSystemField = (typeof CONTENT_SYSTEM_FIELDS)[number];

export type ContentPublicationField =
  (typeof CONTENT_PUBLICATION_FIELDS)[number];

export type ContentPublicationStatus =
  (typeof CONTENT_PUBLICATION_STATUSES)[number];

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

/**
 * Whether a slug has to be present in the create payload.
 *
 * Exactly the inverse of "it has a source": with one the engine can always
 * derive the value, without one nobody else can. That makes `required` a
 * consequence of `source` rather than a second knob, so `field.slug` does not
 * take it - the two could otherwise be set to contradict each other.
 */
export type ContentSlugRequired<TSource> = TSource extends string
  ? false
  : true;

/**
 * A URL segment: lowercase, ASCII, dash separated, unique across the table.
 *
 * Never nullable and never defaulted - a row without a slug could not be
 * addressed. `source` names the `text` field the value is derived from when a
 * create payload leaves it out; an update never re-derives it, so published
 * URLs stay put.
 */
export interface ContentSlugField<
  TSource extends string | undefined = string | undefined,
> extends ContentFieldShared<ContentSlugRequired<TSource>, false> {
  kind: "slug";
  /** `varchar` length and the truncation point. Defaults to 160. */
  maxLength?: number;
  source: TSource;
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
  | ContentSlugField
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
 *
 * `TPublication` extends the same trick to `status` and `publishedAt`, but only
 * when the content type opted into publication - a Stage 1 type is free to keep
 * declaring its own `status` enum.
 */
export type ContentFieldsConstraint<TPublication extends boolean = false> =
  Partial<Record<ContentSystemField, never>> &
    Record<string, { kind: ContentFieldKind }> &
    (TPublication extends true
      ? Partial<Record<ContentPublicationField, never>>
      : unknown);

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

/**
 * `status` and `publishedAt` are addressable in the admin config only once the
 * content type opted into publication.
 */
type ContentPublicationColumn<TPublication extends boolean> =
  TPublication extends true ? ContentPublicationField : never;

export interface ContentAdminListConfig<
  TFields = ContentFieldMap,
  TPublication extends boolean = boolean,
> {
  /** Columns shown in the DataTable, in order. Defaults to every field. */
  columns?: (
    ContentPublicationColumn<TPublication> | ContentSystemField | keyof TFields
  )[];
  defaultOrder?: "asc" | "desc";
  defaultOrderBy?:
    ContentPublicationColumn<TPublication> | ContentSystemField | keyof TFields;
  /**
   * Allowlist for `orderBy`. System columns - and the publication columns when
   * enabled - are always allowed and need no entry here.
   */
  orderableFields?: (keyof TFields)[];
  /** Only `text` and `textarea` fields may be searched. */
  searchableFields?: (keyof TFields)[];
}

export interface ContentAdminConfig<
  TFields = ContentFieldMap,
  TPublication extends boolean = boolean,
> {
  form?: { fields?: (keyof TFields)[] };
  label: ContentAdminLabel;
  list?: ContentAdminListConfig<TFields, TPublication>;
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
export interface ContentIndexInput<
  TFields = ContentFieldMap,
  TPublication extends boolean = boolean,
> {
  /** Defaults to `<table>_<columns>_idx`, or `_key` when unique. */
  name?: string;
  on: [
    ContentIndexColumn<TFields, TPublication>,
    ...ContentIndexColumn<TFields, TPublication>[],
  ];
  unique?: boolean;
}

type ContentIndexColumn<TFields, TPublication extends boolean> =
  | ContentPublicationColumn<TPublication>
  | ContentSystemField
  | (keyof TFields & string);

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
// Publication
// ---------------------------------------------------------------------------

/**
 * Opts a content type into the draft/published lifecycle.
 *
 * `enabled` is literal `true` rather than `boolean` so the flag survives
 * inference: every conditional in this file keys off `{ enabled: true }`, and a
 * widened `boolean` would silently resolve to the disabled branch.
 */
export interface ContentPublicationConfig {
  enabled: true;
}

export interface ResolvedContentPublicationConfig<
  TEnabled extends boolean = boolean,
> {
  enabled: TEnabled;
}

/**
 * The two generated columns, present only when publication is enabled.
 *
 * `AnyContentTypeDefinition` carries `enabled: boolean`, which does not extend
 * `true`, so the erased definition resolves to the empty branch - generic code
 * sees a row without them, exactly as it did in Stage 1.
 */
type ContentPublicationColumns<TDefinition> = TDefinition extends {
  publication: { enabled: true };
}
  ? { publishedAt: Date | null; status: ContentPublicationStatus }
  : Record<never, never>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Everything `publicApi.fields` may name: declared fields plus a few columns. */
export type ContentPublicExposableField<TFields> =
  (typeof CONTENT_PUBLIC_EXPOSABLE_COLUMNS)[number] | (keyof TFields & string);

/**
 * Opts a content type into a generated, read-only public API.
 *
 * Requires `publication: { enabled: true }` and exactly one exposed slug field,
 * both checked at definition time. Enabling publication on its own never makes
 * anything public - this block is the only thing that does.
 *
 * `enabled` is literal `true` for the same reason publication's is: every
 * conditional keys off it, and a widened `boolean` would silently resolve to
 * "no public API".
 */
export interface ContentPublicApiConfig<TField extends string = string> {
  defaultOrder?: "asc" | "desc";
  /** Defaults to `publishedAt`. Must be orderable. */
  defaultOrderBy?: "publishedAt" | TField;
  enabled: true;
  /** The allowlist. There is no wildcard - a new field is private until listed. */
  fields: readonly [TField, ...TField[]];
  /** Equality filters the list route accepts. Defaults to none. */
  filterableFields?: readonly TField[];
  /** Columns `orderBy` accepts, besides `publishedAt`. Defaults to none. */
  orderableFields?: readonly TField[];
  /** One lowercase URL segment, e.g. `articles`. Never `admin`. */
  path: string;
  /** Columns `search` scans. Defaults to none. */
  searchableFields?: readonly TField[];
}

/**
 * `publicApi` after `defineContentType` has filled in every default.
 *
 * Generic over the exposed field-name *union* and nothing else. `keyof TFields`
 * here would make `ContentTypeDefinition` invariant and break assignability to
 * `AnyContentTypeDefinition` - the exact trap `ResolvedContentAdminConfig`
 * documents. A `TField[]` stays covariant, so `("title" | "slug")[]` is still a
 * `string[]`.
 */
export interface ResolvedContentPublicApiConfig<
  TField extends string = string,
  TEnabled extends boolean = boolean,
> {
  defaultOrder: "asc" | "desc";
  defaultOrderBy: string;
  enabled: TEnabled;
  fields: TField[];
  filterableFields: string[];
  orderableFields: string[];
  path: string;
  searchableFields: string[];
  /** The exposed slug field the detail route resolves by. */
  slugField: string;
}

// ---------------------------------------------------------------------------
// Definition
// ---------------------------------------------------------------------------

export interface ContentTypeDefinition<
  TId extends string = string,
  TFields = ContentFieldMap,
  TPublication extends boolean = boolean,
  TPublicField extends string = string,
  TPublicEnabled extends boolean = boolean,
> {
  admin: ResolvedContentAdminConfig;
  fields: TFields;
  id: TId;
  /** Declared indexes plus the automatic ones, deduplicated and named. */
  indexes: ResolvedContentIndex[];
  /** Derived from `admin.permissionModule` or `admin.label.plural`. */
  permissionModule: string;
  publicApi: ResolvedContentPublicApiConfig<TPublicField, TPublicEnabled>;
  publication: ResolvedContentPublicationConfig<TPublication>;
  /** Zod schemas generated from `fields`. */
  schemas: ContentSchemas<
    ContentTypeDefinition<
      TId,
      TFields,
      TPublication,
      TPublicField,
      TPublicEnabled
    >
  >;
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
  ContentPublicationColumns<TDefinition> & {
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
 * Kinds the generated filter schema understands, derived from the one runtime
 * list in `const.ts` so the compile-time contract and the runtime guard are the
 * same list. `service.test-d.ts` asserts it stays a subset of
 * {@link ContentFieldKind}.
 */
export type FilterableContentFieldKind =
  (typeof CONTENT_FILTERABLE_FIELD_KINDS)[number];

export type FilterableContentFieldName<TDefinition> = FieldNamesOfKind<
  TDefinition,
  FilterableContentFieldKind
>;

/**
 * Equality filters accepted by `service.findMany`, one key per filterable
 * field - plus `status` once publication is enabled, which is a generated
 * column rather than a declared field.
 */
export type ContentFilterInput<TDefinition> = Partial<
  (TDefinition extends { publication: { enabled: true } }
    ? { status: ContentPublicationStatus }
    : Record<never, never>) & {
    [K in FilterableContentFieldName<TDefinition>]: ContentFieldInput<
      ContentFieldsOf<TDefinition>[K]
    >;
  }
>;

/**
 * Columns `service.findMany` may order by.
 *
 * A compile-time approximation, and deliberately so: `admin.list.orderableFields`
 * is stored on the *resolved* (non-generic) admin config, so the configured
 * array is not recoverable as a type. Every field name is accepted here, and
 * the narrower runtime allowlist rejects the ones that were not configured.
 *
 * The generated publication columns are part of that allowlist at runtime -
 * `orderableColumns` appends them, and the generated route's `orderBy` enum
 * includes them - so they belong here too, but only for a content type that
 * actually opted in.
 */
export type ContentOrderableFieldName<TDefinition> =
  | ContentFieldName<TDefinition>
  | ContentSystemField
  | (TDefinition extends { publication: { enabled: true } }
      ? ContentPublicationField
      : never);

/** Fields with a picker - the only ones `service.options` can enumerate. */
export type ContentReferenceFieldName<TDefinition> = FieldNamesOfKind<
  TDefinition,
  "relation" | "user"
>;

// ---------------------------------------------------------------------------
// Public projection
// ---------------------------------------------------------------------------

/**
 * How an exposed `relation` comes back: an identifier and the target's own
 * `admin.titleField`, and nothing else.
 *
 * Deliberately not the related row. Deep nesting and arbitrary population are
 * out of scope - they are the point at which a REST projection turns into
 * GraphQL, and a hand-written route is the better answer.
 */
export interface ContentPublicRelation {
  id: number;
  label: null | string;
}

/** The exposed field names of one content type, read off its resolved config. */
export type ContentPublicFieldName<TDefinition> = TDefinition extends {
  publicApi: { fields: (infer TField extends string)[] };
}
  ? TField
  : never;

type ContentPublicValue<TFields, TName extends string> = TName extends "id"
  ? number
  : TName extends "createdAt" | "updatedAt"
    ? Date
    : TName extends "publishedAt"
      ? Date | null
      : TName extends keyof TFields
        ? TFields[TName] extends { kind: "relation" }
          ? TFields[TName] extends { nullable: true }
            ? ContentPublicRelation | null
            : ContentPublicRelation
          : ContentFieldValue<TFields[TName]>
        : never;

/**
 * One public row: exactly the allowlisted fields, and not one key more.
 *
 * A field the content type declares but `publicApi.fields` does not name is
 * absent from this type *and* absent from the generated `SELECT`, so it never
 * leaves Postgres. Adding a field to the content type does not add it here.
 */
export type ContentPublicSelect<TDefinition> = Prettify<{
  [K in ContentPublicFieldName<TDefinition>]: ContentPublicValue<
    ContentFieldsOf<TDefinition>,
    K
  >;
}>;

/**
 * A row in a public list.
 *
 * The same projection as the detail response today - there is no list-only or
 * detail-only field. Both names exist so a route signature says which one it
 * means, and so the two can diverge later without a rename.
 */
export type ContentPublicListRow<TDefinition> =
  ContentPublicSelect<TDefinition>;

/**
 * Equality filters the public service accepts.
 *
 * Exposed *and* filterable - a private field can never be filtered on, which is
 * what stops a filter being used to probe a column the response omits. Like the
 * admin equivalent this is one step wider than the runtime: the configured
 * `publicApi.filterableFields` array is not recoverable as a type, so the
 * narrower check is the runtime allowlist.
 */
export type ContentPublicFilterInput<TDefinition> = Partial<{
  [
    K in ContentPublicFieldName<TDefinition> &
      FilterableContentFieldName<TDefinition>
  ]: ContentFieldInput<ContentFieldsOf<TDefinition>[K]>;
}>;

/** Columns the public list may be ordered by. */
export type ContentPublicOrderableFieldName<TDefinition> =
  "publishedAt" | ContentPublicFieldName<TDefinition>;
