import type {
  CONTENT_ADMIN_FORM_MODES,
  CONTENT_DELIVERY_DESCRIPTION_KINDS,
  CONTENT_DELIVERY_NO_INDEX_KINDS,
  CONTENT_DELIVERY_TITLE_KINDS,
  CONTENT_EDITORIAL_FIELDS,
  CONTENT_FILTERABLE_FIELD_KINDS,
  CONTENT_LOCALIZATION_FALLBACKS,
  CONTENT_PUBLIC_EXPOSABLE_COLUMNS,
  CONTENT_PUBLICATION_FIELDS,
  CONTENT_PUBLICATION_STATUSES,
  CONTENT_SEARCH_DESCRIPTION_KINDS,
  CONTENT_SEARCH_TEXT_KINDS,
  CONTENT_SEARCH_TITLE_KINDS,
  CONTENT_SITEMAP_CHANGE_FREQUENCIES,
  CONTENT_SYSTEM_FIELDS,
  CONTENT_TRANSLATION_SYSTEM_FIELDS,
} from "./const";
import type { ContentFileDescriptor } from "./files";
import type { ContentSchemas } from "./schemas";

export type ContentSystemField = (typeof CONTENT_SYSTEM_FIELDS)[number];

export type ContentPublicationField =
  (typeof CONTENT_PUBLICATION_FIELDS)[number];

export type ContentEditorialField = (typeof CONTENT_EDITORIAL_FIELDS)[number];

export type ContentTranslationSystemField =
  (typeof CONTENT_TRANSLATION_SYSTEM_FIELDS)[number];

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
  /**
   * The value is stored per language, in the generated translation table rather
   * than on the base table.
   *
   * Declared here - on every kind - so `fieldValue.localized` reads off the
   * descriptor union without a narrowing dance. Only the three kinds in
   * {@link CONTENT_LOCALIZED_FIELD_KINDS} accept it: the other builders do not
   * take the argument at all, so `field.boolean({ localized: true })` is a
   * compile error, and `defineContentType` refuses it again at runtime.
   */
  localized?: boolean;
  /** Column accepts NULL, and `null` is a legal value. */
  nullable: TNullable;
  /** Must be present in the create payload. */
  required: TRequired;
}

export interface ContentTextField<
  TRequired extends boolean = boolean,
  TNullable extends boolean = boolean,
  TDefault extends string | undefined = string | undefined,
  TLocalized extends boolean = boolean,
> extends ContentFieldShared<TRequired, TNullable> {
  // Declared non-optional (but possibly `undefined`) so `HasColumnDefault` can
  // tell "no default" from "defaulted": an optional property would always
  // include `undefined` in its type and the distinction would be lost.
  defaultValue: TDefault;
  kind: "text";
  // Non-optional and literal, for the same reason `required` and `nullable` are:
  // every partition in this file keys off `{ localized: true }`, and an optional
  // `boolean | undefined` would resolve every field to the shared branch.
  localized: TLocalized;
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
  TLocalized extends boolean = boolean,
> extends ContentFieldShared<ContentSlugRequired<TSource>, false> {
  kind: "slug";
  localized: TLocalized;
  /** `varchar` length and the truncation point. Defaults to 160. */
  maxLength?: number;
  source: TSource;
}

export interface ContentTextareaField<
  TRequired extends boolean = boolean,
  TNullable extends boolean = boolean,
  TDefault extends string | undefined = string | undefined,
  TLocalized extends boolean = boolean,
> extends ContentFieldShared<TRequired, TNullable> {
  defaultValue: TDefault;
  kind: "textarea";
  localized: TLocalized;
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

/**
 * A reference to one stored file in `core_files`.
 *
 * The column is an `integer` foreign key with `ON DELETE RESTRICT`, and that is
 * the whole storage model: the row holds an identifier, `core_files` holds the
 * name, the size, the media type and the storage key, and the storage adapter
 * holds the bytes. Nothing about the file is copied onto the content row, so a
 * renamed or re-encoded object is not two facts that can disagree.
 *
 * `maxBytes` is **not** optional. A file field with no ceiling is a form that
 * accepts a disk image, and a default here would be a number nobody chose
 * applied to every field in every plugin.
 *
 * `allowedMimeTypes` and `allowedExtensions` are two rules rather than one
 * spelled twice: the first is what the client *declared* the bytes are, the
 * second is what the file is *called*. A `picture.gif` carrying `image/png`
 * passes an extension-only check, which is why a strict field states both and
 * both have to match.
 *
 * `multiple: true` moves the reference off the row into a generated junction
 * table, exactly as it does for a `relation` - one row per file, with a
 * `position`. The per-file rules do not change: `maxBytes` and both allowlists
 * are checked against *each* entry, because a gallery of ten images is ten
 * uploads rather than one bigger one.
 */
export interface ContentFileField<
  TRequired extends boolean = boolean,
  TNullable extends boolean = boolean,
  TMultiple extends boolean = boolean,
  TOrdered extends boolean = boolean,
> extends ContentFieldShared<TRequired, TNullable> {
  /**
   * Accepted file-name extensions, normalised to lowercase with a leading dot.
   *
   * Normalised by `field.file`, so `GIF`, `.gif` and `.Gif` are one rule.
   * Omitted, any extension is accepted - the MIME list, the size and the storage
   * adapter are still in force.
   */
  allowedExtensions?: string[];
  /** Accepted media types, lowercased. Omitted, any type is accepted. */
  allowedMimeTypes?: string[];
  kind: "file";
  /**
   * The most files the field will hold. `multiple: true` only.
   *
   * Defaults to {@link CONTENT_FILE_COLLECTION_DEFAULT_MAX} and may not exceed
   * {@link CONTENT_FILE_COLLECTION_ABSOLUTE_MAX}: every entry is a stored object
   * that the record pins against deletion, and the whole list is read and
   * rewritten as one.
   */
  max?: number;
  /** Largest accepted upload, in bytes. Required, finite, and greater than zero. */
  maxBytes: number;
  /**
   * The fewest files to accept - `min: 1` is "at least one image".
   *
   * `multiple: true` only. A file collection can never be `required`, because
   * the empty set is a legitimate value for a column that does not exist, so
   * this is the shape a "you must upload something" rule actually takes.
   */
  min?: number;
  /**
   * Store many files in a generated junction table instead of one on the row.
   *
   * Literal for the same reason {@link ContentRelationField.multiple} is: every
   * partition keys off `{ multiple: true }`, and a widened `boolean` resolves a
   * gallery back to the single-file branch.
   */
  multiple: TMultiple;
  /**
   * Keep the order the files were added in.
   *
   * Defaults to **true** with `multiple: true`, unlike a relation: the order an
   * editor built a gallery in is the order they meant it to read in. There are
   * deliberately no reorder controls - rearranging is remove-and-re-add - so
   * this is insertion order rather than a position anybody drags.
   *
   * `false` sorts by `core_files.id` instead, which makes `set([9, 2, 5])` and
   * `set([2, 5, 9])` the same state rather than two writes that differ only in a
   * column nobody declared.
   */
  ordered: TOrdered;
}

export interface ContentDateTimeField<
  TRequired extends boolean = boolean,
  TNullable extends boolean = boolean,
  TDefaultNow extends boolean = boolean,
> extends ContentFieldShared<TRequired, TNullable> {
  defaultNow: TDefaultNow;
  kind: "dateTime";
}

/**
 * A reference to a VitNode user.
 *
 * `multiple: true` is the same move a to-many `relation` makes, and for the same
 * reason: a column cannot hold a set, so the references move into a generated
 * junction table whose second foreign key points at `core_users`. An article
 * with two authors is two junction rows, not a comma-separated column - so
 * `ON DELETE` still means something, and "which articles did this person write"
 * is an indexed lookup rather than a `LIKE`.
 */
export interface ContentUserField<
  TRequired extends boolean = boolean,
  TNullable extends boolean = boolean,
  TMultiple extends boolean = boolean,
  TOrdered extends boolean = boolean,
> extends ContentFieldShared<TRequired, TNullable> {
  kind: "user";
  /** The fewest people the field will accept. See {@link ContentRelationField.min}. */
  min?: number;
  /**
   * Many people instead of one.
   *
   * Literal rather than optional-boolean for the same reason
   * {@link ContentRelationField.multiple} is: every partition keys off
   * `{ multiple: true }`, and a widened `boolean` resolves a to-many field to
   * the to-one branch - a foreign-key column that does not exist.
   */
  multiple: TMultiple;
  onDelete: ContentOnDelete;
  /**
   * The author's order is the order the people come back in.
   *
   * Only meaningful with `multiple: true`, and it usually is meaningful: the
   * first author of a piece is not an arbitrary member of a set.
   */
  ordered: TOrdered;
}

/**
 * Structural match for a field whose values live in a junction table.
 *
 * Written once and reused, because "is this a set of references?" is the rule
 * that decides whether a field is a column or a table - and the version of that
 * rule that forgets `user` is a column the engine never generates and a value
 * that silently disappears.
 *
 * All three reference kinds, deliberately. A gallery is stored exactly like a
 * set of categories - a junction table with two foreign keys and a `position` -
 * and every caller of this rule is asking "is this a column?", which has the
 * same answer for a file, a category and a person.
 */
interface ContentReferenceCollection {
  kind: "file" | "relation" | "user";
  multiple: true;
}

/**
 * A reference to another content type's rows.
 *
 * `multiple: false` is the Stage 1 shape: one nullable-or-not foreign key column
 * on the base table. `multiple: true` moves the reference off the row entirely
 * and into a generated junction table - see {@link ContentRelationJunction} -
 * because a column cannot hold a set.
 *
 * `target` is a thunk, which is also what makes a **self-relation** ordinary
 * rather than special: `target: () => articleContentType` inside
 * `articleContentType` is a forward reference resolved on first read, exactly
 * like two content types pointing at each other.
 */
export interface ContentRelationField<
  TRequired extends boolean = boolean,
  TNullable extends boolean = boolean,
  TMultiple extends boolean = boolean,
  TOrdered extends boolean = boolean,
  TSelf extends boolean = boolean,
> extends ContentFieldShared<TRequired, TNullable> {
  kind: "relation";
  /**
   * The fewest targets the field will accept, enforced by the generated schema.
   *
   * How a content type says "at least one" about something `required` cannot
   * say it about: a to-many reference has no column, so the empty set is always
   * a storable value and requiredness is a rule about the *record* instead. Only
   * meaningful with `multiple: true`.
   */
  min?: number;
  /**
   * Many targets instead of one.
   *
   * Literal rather than optional-boolean for the same reason `localized` is:
   * every partition in this file keys off `{ multiple: true }`, and a widened
   * `boolean` would resolve a to-many relation to the to-one branch - which is
   * a foreign-key column that does not exist.
   */
  multiple: TMultiple;
  onDelete: ContentOnDelete;
  /**
   * The author's order is the order the value comes back in.
   *
   * Only meaningful with `multiple: true`. Without it the set is stored in
   * ascending target-id order, which is still deterministic - it is simply not
   * something the author chose.
   */
  ordered: TOrdered;
  /**
   * The target is **this** content type.
   *
   * `self: true` rather than `target: () => thisContentType`, and the reason is
   * the type system rather than taste: a definition whose own field map
   * mentions its own inferred type is circular, and TypeScript resolves that by
   * quietly widening the whole definition to `any`. Every nested value type,
   * every allowlist check and every compile-time guarantee in this file would
   * disappear - silently, because `any` is not an error.
   *
   * `defineContentType` rebinds the thunk to the finished definition, so
   * everything downstream sees an ordinary relation pointing at an ordinary
   * content type.
   *
   * Literal, like `multiple` and `ordered`: `ContentReferences` subtracts a
   * self-relation from the reference map it demands, and a widened `boolean`
   * would leave it demanding the one thunk nobody can write.
   */
  self: TSelf;
  /** Thunk so two content types can refer to each other. */
  target: () => AnyContentTypeDefinition;
}

/**
 * A reusable structured group: several leaves under one logical name.
 *
 * The value stays nested (`seo.title`), and the storage stays relational - each
 * leaf becomes an ordinary column on the base or translation table, called
 * `seoTitle`. There is no JSONB here: a
 * flattened column is indexable, constrainable and queryable, and a group is a
 * fixed set of leaves rather than an open bag.
 *
 * Localization is a property of the **group**, not of its leaves: `localized:
 * true` moves the whole group into the translation table. Marking a single leaf
 * would split one logical value across two tables with two different revision
 * histories and two different permissions, which is exactly the drift
 * `partitionContentFields` exists to prevent.
 */
export interface ContentGroupField<
  TFields = ContentLeafFieldMap,
  TRequired extends boolean = boolean,
  TNullable extends boolean = boolean,
  TLocalized extends boolean = boolean,
> extends ContentFieldShared<TRequired, TNullable> {
  /** Leaves, in declaration order. Scalar kinds only - groups do not nest. */
  fields: TFields;
  kind: "group";
  localized: TLocalized;
}

/**
 * A repeatable structured group: zero or more ordered child rows.
 *
 * Stored in a generated child table (`example_articles_faq`) with a `serial`
 * primary key of its own, so a child has a **stable identity** that survives a
 * reorder - which is what makes "edit row 3" mean something and what lets a
 * revision restore put the same row back rather than a copy of it.
 *
 * Never nullable and never required: the value is an array, and the empty array
 * is the natural "nothing here". Never localized either - see
 * `apps/docs/.../repeatable-fields.mdx` for why that is a later stage.
 */
export interface ContentRepeatableField<
  TFields = ContentLeafFieldMap,
> extends ContentFieldShared<false, false> {
  fields: TFields;
  kind: "repeatable";
  /** Upper bound on child rows. Enforced by the generated schema. */
  max?: number;
  /** Lower bound on child rows. Enforced by the generated schema. */
  min?: number;
}

export type ContentFieldDescriptor =
  | ContentBooleanField
  | ContentDateTimeField
  | ContentEnumField
  | ContentFileField
  | ContentGroupField
  | ContentNumberField
  | ContentRelationField
  | ContentRepeatableField
  | ContentSlugField
  | ContentTextareaField
  | ContentTextField
  | ContentUserField;

export type ContentFieldKind = ContentFieldDescriptor["kind"];

/**
 * The kinds a group leaf or a repeatable leaf may be.
 *
 * Scalars only. A nested group would need a second level of column naming and a
 * second level of partial-update merging for no modelling gain; a `slug` inside
 * a group would need its uniqueness scoped to something; and a `relation` or
 * `user` inside one would put a foreign key in a place the relation services do
 * not look. All four are definition-time errors.
 */
export type ContentLeafFieldDescriptor =
  | ContentBooleanField
  | ContentDateTimeField
  | ContentEnumField
  | ContentNumberField
  | ContentTextareaField
  | ContentTextField;

export type ContentFieldMap = Record<string, ContentFieldDescriptor>;

/** A group's or repeatable's inner field map. Scalars only. */
export type ContentLeafFieldMap = Record<string, ContentLeafFieldDescriptor>;

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
 * declaring its own `status` enum. `TEditorial` does the same for `version`.
 */
export type ContentFieldsConstraint<
  TPublication extends boolean = false,
  TEditorial extends boolean = false,
> = Partial<Record<ContentSystemField, never>> &
  Record<string, { kind: ContentFieldKind }> &
  (TEditorial extends true
    ? Partial<Record<ContentEditorialField, never>>
    : unknown) &
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

/** The scalar half of {@link ContentFieldValue}, before nullability. */
type ScalarFieldValue<TField> = TField extends { kind: "boolean" }
  ? boolean
  : TField extends { kind: "dateTime" }
    ? Date
    : TField extends { values: readonly (infer TValue)[] }
      ? TValue
      : TField extends { kind: "file" | "number" | "relation" | "user" }
        ? number
        : string;

/** The scalar half of {@link ContentFieldInput}. `dateTime` crosses as ISO. */
type ScalarFieldInput<TField> = TField extends { kind: "boolean" }
  ? boolean
  : TField extends { kind: "dateTime" }
    ? string
    : TField extends { values: readonly (infer TValue)[] }
      ? TValue
      : TField extends { kind: "file" | "number" | "relation" | "user" }
        ? number
        : string;

/** Every leaf of a group, as it comes back. Nested, never flattened. */
type ContentGroupValue<TFields> = Prettify<{
  [K in keyof TFields]: ContentFieldValue<TFields[K]>;
}>;

/**
 * One repeatable child row.
 *
 * `id` is the child table's own primary key and is always present on a read:
 * it is what a later `update`, `delete` or `reorder` addresses, and what a
 * revision restore matches an historical row against.
 */
export type ContentRepeatableRow<TFields> = Prettify<
  {
    [K in keyof TFields]: ContentFieldValue<TFields[K]>;
  } & { id: number }
>;

/**
 * A create-shaped object over every key of a field map.
 *
 * Exported so the service can type a repeatable's child input from the leaves
 * the definition already declares, rather than falling back to
 * `Record<string, unknown>` and losing every one of them.
 */
export type ContentValuesOf<TFields> = CreateValuesOf<TFields, keyof TFields>;

/** The inner field map of one group or repeatable, by name. */
export type ContentInnerFieldsOf<TDefinition, TName> =
  ContentFieldsOf<TDefinition>[keyof ContentFieldsOf<TDefinition> &
    TName] extends {
    fields: infer TInner;
  }
    ? TInner
    : never;

/**
 * One repeatable child row as it is written.
 *
 * `id` is optional and is the whole write protocol: present means "update this
 * existing child", absent means "create a new one". Position comes from the
 * array order, so nothing carries it explicitly.
 */
export type ContentRepeatableInputRow<TFields> = Prettify<
  CreateValuesOf<TFields, keyof TFields> & { id?: number }
>;

/**
 * The value as it comes back from the API (`select`).
 *
 * Structural on purpose: `TField` is unconstrained so this also works with the
 * shallow {@link ContentFieldsConstraint}.
 *
 * The three advanced kinds resolve before the scalar branch, because a `group`
 * has no scalar value at all and a to-many `relation` is a set of identifiers
 * rather than one.
 */
export type ContentFieldValue<TField> = TField extends {
  fields: infer TInner;
  kind: "group";
}
  ? ApplyNullable<ContentGroupValue<TInner>, TField>
  : TField extends { fields: infer TInner; kind: "repeatable" }
    ? ContentRepeatableRow<TInner>[]
    : TField extends ContentReferenceCollection
      ? number[]
      : ApplyNullable<ScalarFieldValue<TField>, TField>;

/**
 * The value as it is sent to the API. Identical to the select value except for
 * `dateTime`, which crosses the wire (and the AutoForm) as an ISO 8601 string -
 * `z.toJSONSchema` throws on `z.date()`, so a form schema can never hold one.
 */
export type ContentFieldInput<TField> = TField extends {
  fields: infer TInner;
  kind: "group";
}
  ? ApplyNullable<CreateValuesOf<TInner, keyof TInner>, TField>
  : TField extends { fields: infer TInner; kind: "repeatable" }
    ? ContentRepeatableInputRow<TInner>[]
    : TField extends ContentReferenceCollection
      ? number[]
      : ApplyNullable<ScalarFieldInput<TField>, TField>;

/**
 * The value a **partial** update may send for one field.
 *
 * Identical to {@link ContentFieldInput} everywhere except a group, where every
 * leaf becomes optional: `{ seo: { description } }` must be able to move one
 * leaf without restating the others, and without blanking them.
 */
export type ContentFieldPatch<TField> = TField extends {
  fields: infer TInner;
  kind: "group";
}
  ? ApplyNullable<
      Prettify<Partial<CreateValuesOf<TInner, keyof TInner>>>,
      TField
    >
  : ContentFieldInput<TField>;

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
// Shared / localized partition
//
// One rule, stated once as a type and once (in `partitionContentFields`) as
// runtime data: a field is localized when its descriptor carries the literal
// `localized: true`, and shared otherwise. The erased
// `AnyContentTypeDefinition` carries `localized?: boolean`, which does not
// extend `true`, so every field of an erased definition is shared - which is
// exactly how a Stage 1-4 content type behaved before localization existed.
// ---------------------------------------------------------------------------

type LocalizedFieldKeys<TFields> = {
  [K in keyof TFields]: TFields[K] extends { localized: true } ? K : never;
}[keyof TFields];

type SharedFieldKeys<TFields> = Exclude<
  keyof TFields,
  LocalizedFieldKeys<TFields>
>;

/**
 * Fields whose value is **not** a column on either generated table: a to-many
 * relation, which lives in a junction table, and a repeatable, which lives in a
 * child table.
 *
 * Everything that addresses a column - the admin list, an index, an equality
 * filter, `orderBy`, `ContentSelect` - subtracts these. Everything that
 * addresses a *value* - the create payload, the update patch, `changedFields` -
 * keeps them. That split is the whole of Stage 6's "opt-in" promise: a content
 * type that declares none of them has an empty subtraction and behaves exactly
 * as it did in Stage 5.
 */
type CollectionFieldKeys<TFields> = {
  [K in keyof TFields]: TFields[K] extends { kind: "repeatable" }
    ? K
    : TFields[K] extends ContentReferenceCollection
      ? K
      : never;
}[keyof TFields];

/** Shared fields that are actually stored on the base table. */
type ColumnFieldKeys<TFields> = Exclude<
  SharedFieldKeys<TFields>,
  CollectionFieldKeys<TFields>
>;

type GroupFieldKeys<TFields> = {
  [K in keyof TFields]: TFields[K] extends { kind: "group" } ? K : never;
}[keyof TFields];

/**
 * Shared fields that are **one** column: a scalar, not a group.
 *
 * A group occupies several columns under generated names, so it is not
 * something a list cell, an `orderBy` or an equality filter can address. Its
 * *leaves* are, under their canonical paths - see {@link ContentLeafPath}.
 */
type ScalarColumnFieldKeys<TFields> = Exclude<
  ColumnFieldKeys<TFields>,
  GroupFieldKeys<TFields>
>;

/**
 * Every field that is **one** column on *either* generated table.
 *
 * The same subtraction as {@link ScalarColumnFieldKeys}, minus the shared/localized
 * split: a localized `text` is one column on the translation table, so it is
 * something the AdminCP can *show*. It is still not something the AdminCP can
 * *order or filter by* - that is a query over the base table - which is why the
 * two types exist rather than one.
 */
type ScalarDisplayFieldKeys<TFields> = Exclude<
  Exclude<keyof TFields, CollectionFieldKeys<TFields>>,
  GroupFieldKeys<TFields>
>;

/**
 * The canonical dotted path of every group leaf: `"seo.title"`.
 *
 * One representation, used by `changedFields`, validation errors, index
 * declarations, `publicApi.fields`, `search.contentFields` and revision
 * diagnostics alike. The generated column name (`seoTitle`) is an internal
 * mapping and never appears in any of them.
 */
export type ContentLeafPath<TFields> = string &
  {
    [K in GroupFieldKeys<TFields>]: TFields[K] extends {
      fields: infer TInner;
    }
      ? `${K & string}.${keyof TInner & string}`
      : never;
  }[GroupFieldKeys<TFields>];

/** The canonical dotted path of every repeatable leaf: `"faq.question"`. */
export type ContentRepeatableLeafPath<TFields> = string &
  {
    [K in keyof TFields]: TFields[K] extends {
      fields: infer TInner;
      kind: "repeatable";
    }
      ? `${K & string}.${keyof TInner & string}`
      : never;
  }[keyof TFields];

/**
 * Everything `changedFields` may name, and everything a nested validation error
 * is keyed by: a scalar field, a group **leaf** path, or a collection name.
 *
 * A group never appears whole - `seo` moving is always one or more of
 * `seo.title`, `seo.description`. A collection always appears whole: which
 * child of `faq` moved is a question the revision snapshot answers, not
 * something a cache tag or an event payload branches on.
 */
export type ContentChangedPath<TDefinition> =
  | (CollectionFieldKeys<ContentFieldsOf<TDefinition>> & string)
  | ContentLeafPath<ContentFieldsOf<TDefinition>>
  | (ScalarColumnFieldKeys<ContentFieldsOf<TDefinition>> & string);

/**
 * Field names of a to-many reference - a `relation` or a `user`.
 *
 * One name for both, because the collection API they key is one API: `add`,
 * `remove`, `reorder` and `set` are the same four operations over the same
 * junction rows whether the target is a category or a person.
 */
export type ContentRelationCollectionName<TDefinition> = string &
  {
    [
      K in keyof ContentFieldsOf<TDefinition>
    ]: ContentFieldsOf<TDefinition>[K] extends ContentReferenceCollection
      ? K
      : never;
  }[keyof ContentFieldsOf<TDefinition>];

/** Field names of a repeatable group. */
export type ContentRepeatableFieldName<TDefinition> = string &
  {
    [
      K in keyof ContentFieldsOf<TDefinition>
    ]: ContentFieldsOf<TDefinition>[K] extends { kind: "repeatable" }
      ? K
      : never;
  }[keyof ContentFieldsOf<TDefinition>];

/**
 * The advanced collections of one record, loaded on demand.
 *
 * Deliberately **not** part of {@link ContentSelect}: a to-many relation and a
 * repeatable are each an extra query, and an admin list that returned them
 * would issue one per row. They are batch-loaded for a detail read and for the
 * public projections that ask for them, and nowhere else.
 */
export type ContentAdvancedValues<TDefinition> = Prettify<{
  [
    K in
      | ContentRelationCollectionName<TDefinition>
      | ContentRepeatableFieldName<TDefinition>
  ]: ContentFieldValue<ContentFieldsOf<TDefinition>[K]>;
}>;

/**
 * A create-shaped object over a subset of the field map: required fields stay
 * required, everything else is optional, and each value is inferred from its own
 * descriptor.
 */
type CreateValuesOf<TFields, TKeys extends keyof TFields> = Prettify<
  {
    [K in Exclude<TKeys, RequiredFieldKeys<TFields>>]?: ContentFieldInput<
      TFields[K]
    >;
  } & {
    [K in Extract<TKeys, RequiredFieldKeys<TFields>>]: ContentFieldInput<
      TFields[K]
    >;
  }
>;

// ---------------------------------------------------------------------------
// Admin metadata
// ---------------------------------------------------------------------------

/**
 * `status` and `publishedAt` are addressable in the admin config only once the
 * content type opted into publication.
 */
type ContentPublicationColumn<TPublication extends boolean> =
  TPublication extends true ? ContentPublicationField : never;

/** The same rule for `version`, which only exists with `editorial`. */
type ContentEditorialColumn<TEditorial extends boolean> =
  TEditorial extends true ? ContentEditorialField : never;

/**
 * Every column name the admin config and `indexes` may address: the declared
 * *shared* fields, the system columns, and whichever generated columns the
 * content type opted into.
 *
 * A localized field is absent on purpose. It is not a column on the base table,
 * so an index on it, a sort by it or an equality filter would all address
 * something that does not exist. {@link ContentDisplayColumn} is the wider set,
 * for the surfaces that only ever *render* a value.
 */
type ContentAddressableColumn<
  TFields,
  TPublication extends boolean,
  TEditorial extends boolean,
> =
  | ContentEditorialColumn<TEditorial>
  | ContentPublicationColumn<TPublication>
  | ContentSystemField
  | ScalarColumnFieldKeys<TFields>;

/**
 * Every column name an AdminCP **presentation** surface may address.
 *
 * The addressable set plus the localized scalars, because showing a value and
 * ordering by one are different capabilities: a list cell renders whatever the
 * record's translation in the reader's language holds, while `orderBy` is SQL on
 * the base table and a localized column is not there to sort by.
 */
type ContentDisplayColumn<
  TFields,
  TPublication extends boolean,
  TEditorial extends boolean,
> =
  | ContentEditorialColumn<TEditorial>
  | ContentPublicationColumn<TPublication>
  | ContentSystemField
  | ScalarDisplayFieldKeys<TFields>;

export interface ContentAdminListConfig<
  TFields = ContentFieldMap,
  TPublication extends boolean = boolean,
  TEditorial extends boolean = boolean,
> {
  /**
   * Columns shown in the DataTable, in order. Defaults to every shared field.
   *
   * A localized field may be named here: its cell shows the value from the
   * record's translation in the reader's own language. Ordering and filtering
   * still address the base table, so `orderableFields` stays shared-only.
   */
  columns?: ContentDisplayColumn<TFields, TPublication, TEditorial>[];
  defaultOrder?: "asc" | "desc";
  defaultOrderBy?: ContentAddressableColumn<TFields, TPublication, TEditorial>;
  /**
   * Allowlist for `orderBy`. System columns - and the publication columns when
   * enabled - are always allowed and need no entry here.
   */
  orderableFields?: ScalarColumnFieldKeys<TFields>[];
  /** Only shared `text` and `textarea` fields may be searched. */
  searchableFields?: ScalarColumnFieldKeys<TFields>[];
}

/**
 * How the AdminCP presents a create or an edit form.
 *
 * `dialog` is the default and always will be: every content type written before
 * this existed keeps the screen it had, and opting into `page` is one line.
 */
export type ContentAdminFormMode = (typeof CONTENT_ADMIN_FORM_MODES)[number];

/**
 * One AdminCP action's presentation.
 *
 * An object rather than a bare string so the shape has somewhere to grow - and
 * so `create: { mode: "page" }` reads the same as every other block in the
 * descriptor.
 */
export interface ContentAdminActionConfig {
  mode?: ContentAdminFormMode;
}

/**
 * One titled group of fields in the generated form.
 *
 * Carries a `name`, never a heading: the heading is a translation, looked up at
 * `{pluginId}.content.{entity}.form.{name}.title` with `.desc` beside it. A
 * literal string here would be one English heading for every reader, in the one
 * file where the content type is defined once and read in every language.
 */
export interface ContentAdminFormSection<TFields = ContentFieldMap> {
  /**
   * Fields placed in this section, in order.
   *
   * Every field of the form belongs to exactly one section, so a name repeated
   * across two sections is a define-time error rather than a field rendered
   * twice into one payload.
   */
  fields: (keyof TFields)[];
  /**
   * Stable identifier, and the i18n key segment. Lowercase, `a-z0-9_`.
   *
   * Renaming it changes which message the heading reads, exactly as renaming a
   * field changes which message labels it.
   */
  name: string;
}

export interface ContentAdminConfig<
  TFields = ContentFieldMap,
  TPublication extends boolean = boolean,
  TEditorial extends boolean = boolean,
> {
  /**
   * Field holding a colour, shown as a swatch beside the title in pickers and
   * cells.
   *
   * A **display** projection like {@link ContentAdminConfig.titleField}, and a
   * shared column rather than a localized one: a colour is a property of the
   * record, not of the language somebody reads it in. Left out, an option is its
   * name alone - which is right for most content types and wrong for the handful
   * whose whole point is that they are colour-coded.
   */
  colorField?: null | string;
  /** Presentation of the create form. Defaults to `{ mode: "dialog" }`. */
  create?: ContentAdminActionConfig;
  /** Presentation of the edit form. Defaults to `{ mode: "dialog" }`. */
  edit?: ContentAdminActionConfig;
  /**
   * Which fields the generated form renders, in order, and how they are grouped.
   *
   * Shared and localized alike: there is one form, and a localized field renders
   * with its own language switcher inside it. Where the value is *stored* is the
   * engine's business, not the form's.
   *
   * `sections` groups them into titled cards and *is* the field list when
   * present, so `fields` alongside it would be a second, disagreeing answer to
   * the same question - declaring both is a define-time error. Neither is
   * required: without them the form renders every field, flat, as it always has.
   */
  form?: {
    fields?: (keyof TFields)[];
    sections?: ContentAdminFormSection<TFields>[];
  };
  list?: ContentAdminListConfig<TFields, TPublication, TEditorial>;
  navigation?: { enabled?: boolean };
  /**
   * Where the generated screens live under `/admin/content/`. Defaults to the id
   * with its dots as slashes: `blog.post` -> `blog/post`.
   *
   * The one part of a content type that is **read by people rather than by code**,
   * which is why it is the one part allowed to disagree with the id. `blog.post`
   * stays the event name, the permission key and the message key - none of which
   * anybody types - while the screen it opens is called "Articles" everywhere else
   * in the AdminCP, so `blog/articles` is what its address should say.
   *
   * Lowercase segments of letters, digits and dashes, separated by `/`. Site-wide
   * unique: `/admin/content/{path}` carries no plugin id, so two content types
   * sharing a path would claim one URL - see `validateContentTypes`.
   */
  path?: string;
  /**
   * Staff permission module name. Defaults to the content type's own id without
   * its plugin segment: `blog.post` -> `post`, `example.kb.article` ->
   * `kb_article`.
   *
   * Derived from the id rather than from a display name, because the id is the
   * one thing about a content type that is never rewritten for how it reads. A
   * permission module is stored on every role that grants it, so a name that
   * moves when somebody improves the wording of a heading moves those grants
   * with it.
   */
  permissionModule?: string;
  /**
   * Field used as the human-readable title in toasts and relation pickers.
   *
   * A **display** projection rather than a storage or ordering concern, so a
   * localized field is allowed: the AdminCP resolves it in the reader's own
   * language, which is the honest answer for a record whose every text field is
   * localized. Nothing about `orderBy`, filters or indexes changes - those still
   * address the base table.
   *
   * `null` says the content type genuinely has no title. Left `undefined` the
   * first shared text field is picked, falling back to the first localized one -
   * which beats `#123` for a category whose only shared column is a colour.
   */
  titleField?: null | ScalarDisplayFieldKeys<TFields>;
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
  /** Shared column holding a colour swatch for pickers, or `null`. */
  colorField: null | string;
  create: { mode: ContentAdminFormMode };
  edit: { mode: ContentAdminFormMode };
  /**
   * `fields` is always the flat list the form renders, sections or not - so
   * every consumer that only asks "which fields" keeps one place to ask. An
   * empty `sections` says "render them flat", which is the default.
   */
  form: {
    fields: string[];
    sections: { fields: string[]; name: string }[];
  };
  list: {
    columns: string[];
    defaultOrder: "asc" | "desc";
    defaultOrderBy: string;
    orderableFields: string[];
    searchableFields: string[];
  };
  navigation: { enabled: boolean };
  /** The path under `/admin/content/`, e.g. `blog/articles`. Never empty. */
  path: string;
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
  TEditorial extends boolean = boolean,
> {
  /** Defaults to `<table>_<columns>_idx`, or `_key` when unique. */
  name?: string;
  on: [
    ContentIndexColumn<TFields, TPublication, TEditorial>,
    ...ContentIndexColumn<TFields, TPublication, TEditorial>[],
  ];
  unique?: boolean;
}

/**
 * Everything an index may name.
 *
 * The addressable columns, plus every **group leaf** by its canonical path. A
 * leaf is an ordinary column under a generated name, so `{ on: ["seo.title"] }`
 * compiles to exactly the index `{ on: ["title"] }` would have.
 *
 * Repeatable leaves and to-many relations are deliberately absent: neither is a
 * column on the base table, so an index over one would have to be an index on a
 * different table - which the child and junction tables already carry. Naming
 * one is a compile error here and a definition-time error at runtime, rather
 * than something silently dropped.
 */
type ContentIndexColumn<
  TFields,
  TPublication extends boolean,
  TEditorial extends boolean,
> = (
  | ContentAddressableColumn<TFields, TPublication, TEditorial>
  | ContentLeafPath<TFields>
) &
  string;

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

/**
 * Everything `publicApi.fields` may name.
 *
 * Scalar fields and a few generated columns, as before - plus, in Stage 6,
 * **leaf paths**. A group or a repeatable is never exposed whole: naming `seo`
 * would publish `seo.indexable` because somebody wanted `seo.title`, and that is
 * exactly the accident leaf-level allowlisting exists to prevent. A to-many
 * relation *is* named whole, because its value is a list of identifiers and
 * there is no sub-part of one to keep private.
 */
export type ContentPublicExposableField<TFields> =
  | (typeof CONTENT_PUBLIC_EXPOSABLE_COLUMNS)[number]
  | ContentLeafPath<TFields>
  | ContentRepeatableLeafPath<TFields>
  | (ExposableFlatFieldKeys<TFields> & string);

/**
 * Field names `publicApi.fields` may name directly, localized ones included: a
 * public localized read joins the translation it is serving, so where a value is
 * stored is a fact about the query rather than about the response.
 *
 * Groups and repeatables are subtracted because they are exposed leaf by leaf.
 */
type ExposableFlatFieldKeys<TFields> = Exclude<
  keyof TFields,
  | GroupFieldKeys<TFields>
  | {
      [K in keyof TFields]: TFields[K] extends { kind: "repeatable" }
        ? K
        : never;
    }[keyof TFields]
>;

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
// Search
// ---------------------------------------------------------------------------

/** Field names of one or more kinds, as a union. */
type ContentFieldNamesOfKind<TFields, TKind extends string> = string &
  {
    [K in keyof TFields]: TFields[K] extends { kind: TKind } ? K : never;
  }[keyof TFields];

/**
 * Leaf paths of one or more kinds, inside the named container kind.
 *
 * `TContainer` is what separates "a group leaf, which is a column on the row"
 * from "a repeatable leaf, which is a column on a child row": a search title has
 * to be one value, so it may come from the first and never from the second.
 */
type ContentLeafPathsOfKind<
  TFields,
  TKind extends string,
  TContainer extends string,
> = string &
  {
    [K in keyof TFields]: TFields[K] extends {
      fields: infer TInner;
      kind: TContainer;
    }
      ? {
          [L in keyof TInner]: TInner[L] extends { kind: TKind }
            ? `${K & string}.${L & string}`
            : never;
        }[keyof TInner]
      : never;
  }[keyof TFields];

/** Field names of one or more kinds that also accept no `null`. */
type ContentNonNullableFieldNamesOfKind<
  TFields,
  TKind extends string,
> = string &
  {
    [K in keyof TFields]: TFields[K] extends { kind: TKind; nullable: false }
      ? K
      : never;
  }[keyof TFields];

/**
 * Field names `search.titleField` accepts.
 *
 * Three rules, one `Extract`: `TPublicField` is the public allowlist, so a field
 * that is not published cannot be indexed; the kind union keeps prose out of the
 * title slot; and the field cannot be nullable, because a `null` heading is not a
 * search result. That is why a private field is a compile error and not a lint.
 */
export type ContentSearchTitleField<
  TFields,
  TPublicField extends string,
> = Extract<
  TPublicField,
  ContentNonNullableFieldNamesOfKind<
    TFields,
    (typeof CONTENT_SEARCH_TITLE_KINDS)[number]
  >
>;

/**
 * The generated tables a to-many relation and a repeatable field each get.
 *
 * Resolved once by `defineContentType` and read by the table generator, the
 * services and the migration docs alike, so the name a migration creates and the
 * name a query addresses can never drift. Names are clamped to Postgres'
 * 63-character identifier limit with a deterministic fingerprint, the same way
 * index and translation table names already are.
 */
export interface ContentRelationJunction {
  /** The source field this junction belongs to. */
  field: string;
  /** `(itemId, position)`, so an ordered relation has no duplicate slots. */
  positionIndexName: string;
  /** `<table>_<field>_pk` on `(itemId, relatedItemId)`. */
  primaryKeyName: string;
  /** `<table>_<field>_related_idx` - the reverse lookup and the FK's index. */
  relatedIndexName: string;
  tableName: string;
}

export interface ContentRepeatableTable {
  field: string;
  /** `(itemId, position)`, unique: two children cannot share a slot. */
  positionIndexName: string;
  tableName: string;
}

export type ContentSearchDescriptionField<
  TFields,
  TPublicField extends string,
> = Extract<
  TPublicField,
  | ContentFieldNamesOfKind<
      TFields,
      (typeof CONTENT_SEARCH_DESCRIPTION_KINDS)[number]
    >
  | ContentLeafPathsOfKind<
      TFields,
      (typeof CONTENT_SEARCH_DESCRIPTION_KINDS)[number],
      "group"
    >
>;

/**
 * Field names and leaf paths `search.contentFields` accepts.
 *
 * Widest of the three, and the only one that reaches into a **repeatable**:
 * `faq.question` is many values rather than one, which rules it out as a
 * heading but makes it exactly the kind of prose a body should carry. The
 * values are concatenated in position order - see `contentSearchText`.
 */
export type ContentSearchTextField<
  TFields,
  TPublicField extends string,
> = Extract<
  TPublicField,
  | ContentFieldNamesOfKind<TFields, (typeof CONTENT_SEARCH_TEXT_KINDS)[number]>
  | ContentLeafPathsOfKind<
      TFields,
      (typeof CONTENT_SEARCH_TEXT_KINDS)[number],
      "group"
    >
  | ContentLeafPathsOfKind<
      TFields,
      (typeof CONTENT_SEARCH_TEXT_KINDS)[number],
      "repeatable"
    >
>;

/**
 * Opts a content type into automatic search synchronization.
 *
 * Requires `publication` *and* `publicApi`: only published rows are ever
 * indexed, and every indexed field has to be publicly readable already - a
 * private value would otherwise leak through a result snippet, a highlighted
 * match, ranking, or the mere fact that a record matched an exact-match probe.
 *
 * `enabled` is literal `true` for the same reason publication's and publicApi's
 * are: a widened `boolean` would silently resolve to "no search".
 *
 * Generic over the three field-name *unions* rather than over the field map, so
 * `defineContentType` can infer each one from the literal it was given and then
 * check it against `ContentSearchTitleField` and friends. Spelling those out
 * inside the property types instead looks equivalent and is not: `TPublicField`
 * falls back to its constraint while the argument that infers it is still being
 * checked, and a private field name would slip through.
 */
export interface ContentSearchConfig<
  TTitle extends string = string,
  TDescription extends string = string,
  TText extends string = string,
> {
  /** Concatenated into the indexed body, in order. At least one. */
  contentFields: readonly [TText, ...TText[]];
  /** Prepended to the indexed body so it shows up in result excerpts. */
  descriptionField?: TDescription;
  enabled: true;
  /**
   * The public URL of one record, e.g. `/articles/{slug}`. Relative, and
   * `{slug}` - the exposed slug field - is the only placeholder.
   */
  pathTemplate: string;
  /** The result heading. Weighted above the body by the index. */
  titleField: TTitle;
}

/**
 * Whether a `search` argument opted in.
 *
 * `defineContentType` infers the whole `search` object as one type parameter -
 * an intersection member like `{ enabled: TEnabled }` is not an inference site,
 * so reading the literal back off the argument is the only way to keep it.
 */
export type ContentSearchEnabled<TSearch> = TSearch extends { enabled: true }
  ? true
  : false;

/**
 * `search` after `defineContentType` has filled in every default.
 *
 * Generic over `enabled` for the same reason `publication` and `publicApi` are:
 * a widened `boolean` would make every definition equally (un)searchable, so
 * `SearchableContentTypeDefinition` would only ever match after a cast.
 */
export interface ResolvedContentSearchConfig<
  TEnabled extends boolean = boolean,
> {
  contentFields: string[];
  descriptionField: null | string;
  enabled: TEnabled;
  pathTemplate: string;
  titleField: string;
}

// ---------------------------------------------------------------------------
// Delivery (Stage 8)
// ---------------------------------------------------------------------------

export type ContentSitemapChangeFrequency =
  (typeof CONTENT_SITEMAP_CHANGE_FREQUENCIES)[number];

/**
 * Field names and group leaf paths `delivery.seo` may name, of one or more kinds.
 *
 * Three rules, one `Extract`, and they are the same three `ContentSearchTitleField`
 * enforces for the same reasons: `TPublicField` is the public allowlist, so a
 * private field cannot become a `<title>`; the kind union keeps prose out of a
 * title slot and a number out of a description; and a **repeatable** leaf is
 * absent, because a page has one title and a repeatable has many values.
 */
export type ContentDeliveryTextField<
  TFields,
  TPublicField extends string,
  TKind extends string,
> = Extract<
  TPublicField,
  | ContentFieldNamesOfKind<TFields, TKind>
  | ContentLeafPathsOfKind<TFields, TKind, "group">
>;

/** Field names `delivery.seo.titleField` and its fallback accept. */
export type ContentDeliveryTitleField<
  TFields,
  TPublicField extends string,
> = ContentDeliveryTextField<
  TFields,
  TPublicField,
  (typeof CONTENT_DELIVERY_TITLE_KINDS)[number]
>;

/** Field names `delivery.seo.descriptionField` and its fallback accept. */
export type ContentDeliveryDescriptionField<
  TFields,
  TPublicField extends string,
> = ContentDeliveryTextField<
  TFields,
  TPublicField,
  (typeof CONTENT_DELIVERY_DESCRIPTION_KINDS)[number]
>;

/** Field names `delivery.seo.noIndexField` accepts. */
export type ContentDeliveryNoIndexField<
  TFields,
  TPublicField extends string,
> = ContentDeliveryTextField<
  TFields,
  TPublicField,
  (typeof CONTENT_DELIVERY_NO_INDEX_KINDS)[number]
>;

/**
 * Optional Open Graph projection, on top of the SEO one.
 *
 * Separate fields rather than a flag, because the two audiences differ: a
 * `<title>` competes in a search result and an `og:title` competes in a chat
 * preview, and an author who wants them identical simply names the same field
 * twice. There is deliberately no `imageField` - see
 * `apps/docs/.../content-delivery-limitations.mdx`.
 */
export interface ContentDeliveryOpenGraphConfig<
  TTitle extends string = string,
  TDescription extends string = string,
> {
  descriptionField?: TDescription;
  titleField?: TTitle;
}

/**
 * What a frontend renders in `<head>`, projected from public fields.
 *
 * Every slot is optional and every fallback is explicit. There is no "derive a
 * description from the first 160 characters of the body": a summary somebody did
 * not write is a summary nobody reviewed, and it would silently become the
 * description of every page that forgot to set one.
 */
export interface ContentDeliverySeoConfig<
  TTitle extends string = string,
  TDescription extends string = string,
  TNoIndex extends string = string,
> {
  descriptionField?: TDescription;
  /** Used when `descriptionField` resolves to `null` or an empty string. */
  fallbackDescriptionField?: TDescription;
  /** Used when `titleField` resolves to `null` or an empty string. */
  fallbackTitleField?: TTitle;
  /**
   * A **shared** boolean field that keeps one record out of the sitemap and
   * reports `robots: { index: false }`.
   *
   * Shared rather than localized on purpose: the two consumers have to agree, and
   * a per-locale value would make "is this record in the sitemap" a question with
   * one answer per language while the record has one canonical decision. A
   * localized field here is a definition-time error.
   */
  noIndexField?: TNoIndex;
  openGraph?: ContentDeliveryOpenGraphConfig<TTitle, TDescription>;
  titleField?: TTitle;
}

/**
 * Automatic redirects from a record's historical public URLs.
 *
 * Needs a slug field, which `publicApi` already guarantees. What it adds is
 * persistence: every slug that was ever *publicly addressable* is written to
 * `core_content_slug_history`, which is what makes an old URL resolvable after
 * the row has moved on - and what reserves it, so unrelated content cannot
 * quietly inherit somebody else's incoming links.
 */
export interface ContentDeliveryRedirectsConfig {
  enabled: true;
}

export interface ContentDeliverySitemapConfig {
  /** One of the seven `changefreq` values the protocol defines. */
  changeFrequency?: ContentSitemapChangeFrequency;
  enabled: true;
  /** `0` to `1` inclusive. */
  priority?: number;
}

/**
 * `x-default` for a localized content type.
 *
 * `"defaultLocale"` is the only supported mapping, and that is deliberate: an
 * `x-default` has to point at a URL that actually resolves, and the default
 * locale's canonical path is the one URL a localized record is guaranteed to have
 * whenever it is public at all. Omit the block and no `x-default` is emitted -
 * inventing a locale-less route that the engine does not serve would be worse
 * than emitting nothing.
 */
export interface ContentDeliveryHreflangConfig {
  xDefault: "defaultLocale";
}

/**
 * Opts a content type into the delivery layer: canonical URLs, slug history,
 * redirects, localized alternates, SEO projection and sitemap entries.
 *
 * Requires `publicApi: { enabled: true }`, checked at compile time through
 * `TPublicEnabled` and again at definition time - a content type with no public
 * API has no public URL, so there is nothing for delivery to be about.
 *
 * `enabled` is literal `true` for the same reason every other opt-in's is: every
 * conditional keys off `{ enabled: true }`, and a widened `boolean` would
 * silently resolve to "no delivery".
 */
export interface ContentDeliveryConfig<
  // Both flags default to `true` rather than `boolean`, which is what keeps the bare
  // `ContentDeliveryConfig` usable as a widened parameter type: `boolean extends
  // true` is false, so a `boolean` default would resolve `enabled` to `never` and
  // make the erased form describe a config nobody can write.
  TPublicEnabled extends boolean = true,
  TEditorialEnabled extends boolean = true,
  TTitle extends string = string,
  TDescription extends string = string,
  TNoIndex extends string = string,
> {
  /**
   * Literal `true`, and only when the content type has a public API.
   *
   * `never` otherwise, which is what turns "delivery needs `publicApi`" into a
   * compile error on the `enabled: true` itself rather than a boot-time throw. The
   * runtime check stays as well, for a JavaScript caller and for a value that
   * widened somewhere upstream.
   */
  enabled: TPublicEnabled extends true ? true : never;
  hreflang?: ContentDeliveryHreflangConfig;
  /**
   * Gated on **editorial** as well as on the public API, and the second gate is not
   * a taste decision: slug history has to be written in the same transaction as the
   * slug mutation, the version check and the revision - and the only mutation paths
   * that own such a transaction are the editorial ones. Without `editorial` a
   * content type writes through the plain repository, which has no version to guard
   * and no history to write, so `redirects: { enabled: true }` there would be a
   * feature that silently records nothing.
   *
   * Only `redirects` is gated. Canonical URLs, SEO, alternates, `hreflang` and the
   * sitemap are all reads over data the content type already has, and they remain
   * available without `editorial`.
   */
  redirects?: TPublicEnabled extends true
    ? TEditorialEnabled extends true
      ? ContentDeliveryRedirectsConfig | { enabled: false }
      : { enabled: false }
    : { enabled: false };
  seo?: ContentDeliverySeoConfig<TTitle, TDescription, TNoIndex>;
  sitemap?: ContentDeliverySitemapConfig | { enabled: false };
}

/**
 * Whether a `delivery` argument opted in.
 *
 * Read back off the argument for the same reason `ContentSearchEnabled` is: the
 * whole object is inferred as one type parameter, and an intersection member is
 * not an inference site, so this is the only way the literal survives.
 */
export type ContentDeliveryEnabled<TDelivery> = TDelivery extends {
  enabled: true;
}
  ? true
  : false;

/** `delivery.seo` after `defineContentType` has filled in every default. */
export interface ResolvedContentDeliverySeoConfig {
  descriptionField: null | string;
  fallbackDescriptionField: null | string;
  fallbackTitleField: null | string;
  noIndexField: null | string;
  openGraph: null | {
    descriptionField: null | string;
    titleField: null | string;
  };
  titleField: null | string;
}

/** `delivery` after `defineContentType` has filled in every default. */
export interface ResolvedContentDeliveryConfig<
  TEnabled extends boolean = boolean,
> {
  enabled: TEnabled;
  hreflang: { xDefault: "defaultLocale" | null };
  redirects: { enabled: boolean };
  seo: ResolvedContentDeliverySeoConfig;
  sitemap: {
    changeFrequency: ContentSitemapChangeFrequency | null;
    enabled: boolean;
    priority: null | number;
  };
  /**
   * Where the slug that addresses this content type lives.
   *
   * `"localized"` when `publicApi.slugField` is a localized field, `"shared"`
   * otherwise - and it is the only thing the whole delivery layer branches on to
   * decide which language a historical URL belongs to. A localized slug is
   * reserved per language, a shared one once for the content type, and both are
   * correct for the URLs they actually produce.
   *
   * `"none"` for a content type without delivery, which addresses nothing.
   */
  slugScope: "localized" | "none" | "shared";
}

// ---------------------------------------------------------------------------
// Editorial
// ---------------------------------------------------------------------------

export interface ContentEditorialRevisionsConfig {
  /** Newest revisions kept per record. 1-500, defaults to 50. */
  retention?: number;
}

/**
 * Opts into signed, expiring preview links for unpublished records.
 *
 * `enabled` is literal `true` for the same reason every other opt-in's is: a
 * widened `boolean` would silently resolve to "no preview".
 */
export interface ContentEditorialPreviewConfig {
  enabled: true;
  /** How long a link stays valid. 1-1440 minutes, defaults to 15. */
  expiresInMinutes?: number;
  /**
   * Where the AdminCP sends a reviewer, e.g. `/articles/preview/{token}`.
   * Relative, and `{token}` is the only placeholder. Omit it and the AdminCP
   * links to the generated JSON endpoint instead.
   */
  pathTemplate?: string;
}

export interface ContentEditorialSchedulingConfig {
  enabled: true;
}

/**
 * Opts a content type into the editorial workflow: a `version` column,
 * optimistic locking and revision history.
 *
 * The two sub-features are gated on the capabilities they actually need, and
 * the `{ enabled: false }` branches are what turn a mistake into a compile
 * error rather than a boot-time one:
 *
 * - **preview** projects through `publicApi.fields`. Without a public allowlist
 *   there is nothing to project, so it needs `publicApi` (which already needs
 *   `publication`).
 * - **scheduling** moves `status`, so it needs `publication`. It does *not*
 *   need a public API - a content type may run the lifecycle for the AdminCP
 *   badge alone.
 */
export interface ContentEditorialConfig<
  TPublicEnabled extends boolean = boolean,
  TPublication extends boolean = boolean,
> {
  enabled: true;
  preview?: TPublicEnabled extends true
    ? ContentEditorialPreviewConfig | { enabled: false }
    : { enabled: false };
  revisions?: ContentEditorialRevisionsConfig;
  scheduling?: TPublication extends true
    ? ContentEditorialSchedulingConfig | { enabled: false }
    : { enabled: false };
}

/**
 * Whether an `editorial` argument opted in, and into what.
 *
 * Read back off the argument for the same reason `ContentSearchEnabled` is: the
 * whole object is inferred as one type parameter, and an intersection member is
 * not an inference site, so this is the only way the literals survive.
 */
export type ContentEditorialEnabled<TEditorial> = TEditorial extends {
  enabled: true;
}
  ? true
  : false;

export type ContentPreviewEnabled<TEditorial> = TEditorial extends {
  enabled: true;
  preview: { enabled: true };
}
  ? true
  : false;

export type ContentSchedulingEnabled<TEditorial> = TEditorial extends {
  enabled: true;
  scheduling: { enabled: true };
}
  ? true
  : false;

/** `editorial` after `defineContentType` has filled in every default. */
export interface ResolvedContentEditorialConfig<
  TEnabled extends boolean = boolean,
  TPreview extends boolean = boolean,
  TScheduling extends boolean = boolean,
> {
  enabled: TEnabled;
  preview: {
    enabled: TPreview;
    expiresInMinutes: number;
    pathTemplate: null | string;
  };
  revisions: { retention: number };
  scheduling: { enabled: TScheduling };
}

/**
 * The one generated column `editorial` adds.
 *
 * Read-only on the wire like the publication columns: it appears in a response
 * so a client knows what to send back as `expectedVersion`, and it is absent
 * from the create and update schemas so nobody can write it.
 */
type ContentEditorialColumns<TDefinition> = TDefinition extends {
  editorial: { enabled: true };
}
  ? { version: number }
  : Record<never, never>;

// ---------------------------------------------------------------------------
// Localization
// ---------------------------------------------------------------------------

export type ContentLocalizationFallback =
  (typeof CONTENT_LOCALIZATION_FALLBACKS)[number];

/**
 * Opts a content type into per-language content: the fields marked
 * `localized: true` move off the base table into a generated translation table,
 * one row per language.
 *
 * Nothing about the *UI* language changes - that is `core_languages_words` and
 * the ordinary i18n system. This is about the records themselves: an article
 * that exists in English and in Polish, with its own title, slug and body in
 * each.
 *
 * `enabled` is literal `true` for the same reason every other opt-in's is: every
 * conditional keys off `{ enabled: true }`, and a widened `boolean` would
 * silently resolve to "not localized".
 */
export interface ContentLocalizationConfig {
  /**
   * The locale every record is created in, and the one translation a record can
   * never be without. Must name a row in `core_languages`, which is checked
   * against the database once, at boot - see `assertContentLocalizationLanguages`.
   */
  defaultLocale: string;
  enabled: true;
  /**
   * What a public read should do for a locale with no translation. Resolved now
   * and acted on in Stage 5C; `"none"` is the default because it is the only
   * answer that cannot silently publish the wrong language.
   */
  fallback?: ContentLocalizationFallback;
}

/**
 * `localization` after `defineContentType` has filled in every default.
 *
 * Generic over `enabled` for the same reason `publication` and `editorial` are:
 * a widened `boolean` would make every definition equally (un)localized, so
 * `LocalizedContentTypeDefinition` would only ever match after a cast.
 */
export interface ResolvedContentLocalizationConfig<
  TEnabled extends boolean = boolean,
> {
  defaultLocale: string;
  enabled: TEnabled;
  fallback: ContentLocalizationFallback;
  /** The generated translation table's indexes, named and deduplicated. */
  translationIndexes: ResolvedContentIndex[];
  /** `<tableName>_translations`, shortened to fit Postgres' identifier limit. */
  translationTableName: string;
}

/**
 * Whether a `localization` argument opted in.
 *
 * Read back off the argument for the same reason `ContentSearchEnabled` is: the
 * whole object is inferred as one type parameter, and an intersection member is
 * not an inference site, so this is the only way the literal survives.
 */
export type ContentLocalizationEnabled<TLocalization> = TLocalization extends {
  enabled: true;
}
  ? true
  : false;

/** Field names whose value lives in the translation table. */
export type ContentLocalizedFieldName<TDefinition> = LocalizedFieldKeys<
  ContentFieldsOf<TDefinition>
> &
  string;

/** Field names whose value lives on the base table. */
export type ContentSharedFieldName<TDefinition> = SharedFieldKeys<
  ContentFieldsOf<TDefinition>
> &
  string;

/**
 * The localized half of a create payload - one locale's worth of values.
 *
 * Empty (`{}`) for a content type with no localized fields, which is what makes
 * `translation:` impossible to fill in by accident on a Stage 1-4 definition.
 */
export type ContentLocalizedValues<TDefinition> = CreateValuesOf<
  ContentFieldsOf<TDefinition>,
  keyof ContentFieldsOf<TDefinition> &
    LocalizedFieldKeys<ContentFieldsOf<TDefinition>>
>;

/** The shared half of a create payload - everything on the base table. */
export type ContentSharedValues<TDefinition> = CreateValuesOf<
  ContentFieldsOf<TDefinition>,
  keyof ContentFieldsOf<TDefinition> &
    SharedFieldKeys<ContentFieldsOf<TDefinition>>
>;

/** Every localized field optional, and never empty - see `schemas.translation`. */
export type ContentLocalizedUpdateValues<TDefinition> = Prettify<
  Partial<ContentLocalizedValues<TDefinition>>
>;

/**
 * One translation's own publication state, or nothing.
 *
 * Gated on the *base* content type having publication, for the same reason the
 * columns are: a translation status is only meaningful as something subordinate
 * to a global one. Optional members rather than a widened `string`, so reading
 * `row.status` on a content type without publication is a compile error rather
 * than a silent `undefined`.
 */
export type ContentTranslationPublicationColumns<TDefinition> =
  TDefinition extends { publication: { enabled: true } }
    ? {
        /** First published, in this language. Never rewritten by a republish. */
        publishedAt: Date | null;
        status: ContentPublicationStatus;
      }
    : Record<never, never>;

/** One translation row, as the service and the generated routes return it. */
export type ContentTranslationRow<TDefinition> = Prettify<
  ContentTranslationPublicationColumns<TDefinition> & {
    createdAt: Date;
    itemId: number;
    languageId: number;
    /** The canonical `core_languages.code`, never the caller's casing. */
    locale: string;
    updatedAt: Date;
    values: ContentLocalizedValues<TDefinition>;
    version: number;
  }
>;

/**
 * One translation without its values.
 *
 * What the list route returns, and deliberately so: a locale tab strip needs to
 * know which languages exist, how stale each one is and whether each is
 * published - not to drag every article body in every language across the wire
 * to find out.
 */
export type ContentTranslationMeta<TDefinition = AnyContentTypeDefinition> =
  Prettify<
    ContentTranslationPublicationColumns<TDefinition> & {
      createdAt: Date;
      itemId: number;
      languageId: number;
      locale: string;
      updatedAt: Date;
      version: number;
    }
  >;

// ---------------------------------------------------------------------------
// Definition
// ---------------------------------------------------------------------------

/**
 * A content type whose records are synchronized with the search index.
 *
 * An intersection rather than a sixth type argument, for the same reason
 * {@link PublicContentTypeDefinition} is one: `enabled` is the only thing a
 * caller of the search layer needs pinned, and narrowing just that keeps every
 * concrete definition assignable.
 */
export type SearchableContentTypeDefinition = AnyContentTypeDefinition & {
  search: { enabled: true };
};

/**
 * A content type that actually has a generated public API.
 *
 * The erased `AnyContentTypeDefinition` carries `enabled: boolean`, so it also
 * describes a content type with no public API at all - one whose `publicApi.path`
 * is the empty string. Anything that builds a public URL takes this instead, so
 * passing the wrong content type is a compile error rather than a request to
 * `/api/{pluginId}/content//`.
 *
 * An intersection rather than a fifth type argument: `enabled` is the only
 * parameter a caller of the public read layer needs pinned, and narrowing just
 * that one keeps every concrete definition assignable.
 */
export type PublicContentTypeDefinition = AnyContentTypeDefinition & {
  publicApi: { enabled: true };
};

/**
 * A content type with the editorial workflow: it has a `version` column, its
 * writes are guarded by an expected version, and every real mutation leaves a
 * revision behind.
 *
 * An intersection rather than three more type arguments, for the same reason
 * {@link PublicContentTypeDefinition} is one.
 */
export type EditorialContentTypeDefinition = AnyContentTypeDefinition & {
  editorial: { enabled: true };
};

/**
 * A content type whose drafts can be previewed.
 *
 * Both halves are pinned: the preview projects through `publicApi.fields`, so a
 * content type without a public allowlist cannot reach the token signer at all.
 */
export type PreviewableContentTypeDefinition = EditorialContentTypeDefinition &
  PublicContentTypeDefinition & {
    editorial: { preview: { enabled: true } };
  };

/** A content type whose publication can be scheduled. */
export type SchedulableContentTypeDefinition =
  EditorialContentTypeDefinition & {
    editorial: { scheduling: { enabled: true } };
    publication: { enabled: true };
  };

/**
 * A content type with a delivery layer: canonical URLs, alternates, SEO and a
 * sitemap.
 *
 * Both halves are pinned, because delivery is defined in terms of the public
 * projection: the canonical path is built from `publicApi.path` and the exposed
 * slug field, and every SEO field is one of `publicApi.fields`. A content type
 * without a public allowlist cannot reach the delivery service at all - which is
 * a compile error rather than an empty response.
 */
export type DeliverableContentTypeDefinition = PublicContentTypeDefinition & {
  delivery: { enabled: true };
};

/**
 * A content type whose records exist in more than one language.
 *
 * An intersection rather than a tenth type argument, for the same reason
 * {@link PublicContentTypeDefinition} is one: `enabled` is the only thing the
 * translation layer needs pinned, and narrowing just that keeps every concrete
 * definition assignable to `AnyContentTypeDefinition`.
 */
export type LocalizedContentTypeDefinition = AnyContentTypeDefinition & {
  localization: { enabled: true };
};

/**
 * Everything Stage 6 resolves once, at definition time.
 *
 * Empty arrays for a content type that declares no advanced field, which is what
 * makes "Stage 6 is opt-in" true rather than merely intended: every generator
 * below loops over these, and an empty loop generates nothing.
 */
export interface ResolvedContentAdvancedConfig {
  /** One generated junction table per to-many relation field. */
  junctions: ContentRelationJunction[];
  /**
   * Every group leaf, by canonical path, with the column it compiles to.
   *
   * The single field-path mapping the whole engine reads: table generation,
   * schemas, service reads and writes, revisions, the public projection, search
   * and the AdminCP all take the column name from here rather than re-deriving
   * it, so there is exactly one place the two representations meet.
   */
  leaves: ContentLeafColumn[];
  /** One generated child table per repeatable field. */
  repeatables: ContentRepeatableTable[];
}

/** One group leaf: its canonical path and the column it is stored in. */
export interface ContentLeafColumn {
  /** `seoTitle` - the generated column, in the same camelCase every other one uses. */
  columnName: string;
  /** The owning group's name. */
  group: string;
  /** The leaf's own name inside the group. */
  leaf: string;
  /** Whether the owning group is `localized: true`. */
  localized: boolean;
  /** `seo.title`. */
  path: string;
}

export interface ContentTypeDefinition<
  TId extends string = string,
  TFields = ContentFieldMap,
  TPublication extends boolean = boolean,
  TPublicField extends string = string,
  TPublicEnabled extends boolean = boolean,
  TSearchEnabled extends boolean = boolean,
  TEditorialEnabled extends boolean = boolean,
  TPreviewEnabled extends boolean = boolean,
  TSchedulingEnabled extends boolean = boolean,
  TLocalizationEnabled extends boolean = boolean,
  TDeliveryEnabled extends boolean = boolean,
> {
  admin: ResolvedContentAdminConfig;
  /** Generated junction tables, child tables and the leaf-path mapping. */
  advanced: ResolvedContentAdvancedConfig;
  /**
   * Canonical URLs, slug history, SEO and sitemap - or the disabled default when
   * `delivery` is omitted, which is what keeps every Stage 1-7 content type
   * byte-identical.
   */
  delivery: ResolvedContentDeliveryConfig<TDeliveryEnabled>;
  /** Editorial workflow, or the disabled default when `editorial` is omitted. */
  editorial: ResolvedContentEditorialConfig<
    TEditorialEnabled,
    TPreviewEnabled,
    TSchedulingEnabled
  >;
  fields: TFields;
  id: TId;
  /** Declared indexes plus the automatic ones, deduplicated and named. */
  indexes: ResolvedContentIndex[];
  /**
   * Per-language content, or the disabled default when `localization` is
   * omitted.
   */
  localization: ResolvedContentLocalizationConfig<TLocalizationEnabled>;
  /** Derived from `admin.permissionModule`, or the id without its plugin segment. */
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
      TPublicEnabled,
      TSearchEnabled,
      TEditorialEnabled,
      TPreviewEnabled,
      TSchedulingEnabled,
      TLocalizationEnabled,
      TDeliveryEnabled
    >
  >;
  /** Search synchronization, or the disabled default when `search` is omitted. */
  search: ResolvedContentSearchConfig<TSearchEnabled>;
  tableName: string;
}

/** Use in constraints where the concrete field map does not matter. */
export type AnyContentTypeDefinition = ContentTypeDefinition;

export type ContentFieldsOf<TDefinition> = TDefinition extends {
  fields: infer TFields;
}
  ? TFields
  : never;

/**
 * One base row.
 *
 * Shared fields only: a localized field's value lives on the translation table,
 * so it is not a column here and never comes back from a base read. For a
 * content type without localization every field is shared, so this is exactly
 * the type it always was.
 */
export type ContentSelect<TDefinition> = Prettify<
  ContentEditorialColumns<TDefinition> &
    ContentPublicationColumns<TDefinition> & {
      [K in ColumnFieldKeys<ContentFieldsOf<TDefinition>>]: ContentFieldValue<
        ContentFieldsOf<TDefinition>[K]
      >;
    } & { createdAt: Date; id: number; updatedAt: Date }
>;

/**
 * One record with its advanced collections attached.
 *
 * What a detail read returns and what an editorial mutation echoes back. Two
 * extra queries per record rather than per row, and only where a caller asked
 * for the whole thing.
 */
export type ContentDetail<TDefinition> = Prettify<
  ContentAdvancedValues<TDefinition> & ContentSelect<TDefinition>
>;

/** The base-table half of a create payload. See {@link ContentSharedValues}. */
export type ContentCreateInput<TDefinition> = ContentSharedValues<TDefinition>;

/**
 * A partial update.
 *
 * Partial one level deeper than `Partial<ContentCreateInput>` would be: a group
 * value may name a subset of its leaves, so `{ seo: { description } }` moves one
 * leaf and leaves `seo.title` exactly where it was. A collection is replaced
 * whole - `categories: [2, 5, 9]` is the complete new set - because a partial
 * set has no meaning that is not either "add" or "remove", and both of those are
 * their own service call.
 */
export type ContentUpdateInput<TDefinition> = Prettify<{
  [K in SharedFieldKeys<ContentFieldsOf<TDefinition>>]?: ContentFieldPatch<
    ContentFieldsOf<TDefinition>[K]
  >;
}>;

/**
 * Every field name the content type declares, localized ones included.
 *
 * Use {@link ContentSharedFieldName} where a *column on the base table* is
 * meant - which is most places.
 */
export type ContentFieldName<TDefinition> = keyof ContentFieldsOf<TDefinition> &
  string;

/**
 * Shared field names of one or more kinds.
 *
 * Deliberately shared-only: everything derived from this - filters, ordering,
 * relation pickers - addresses a column on the *base* table, and a localized
 * field does not have one.
 */
type FieldNamesOfKind<TDefinition, TKind extends ContentFieldKind> = string &
  {
    [
      K in ScalarColumnFieldKeys<ContentFieldsOf<TDefinition>>
    ]: ContentFieldsOf<TDefinition>[K] extends {
      kind: TKind;
    }
      ? K
      : never;
  }[ScalarColumnFieldKeys<ContentFieldsOf<TDefinition>>];

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

/** {@link FieldNamesOfKind} over every field, shared and localized alike. */
type AnyFieldNamesOfKind<TDefinition, TKind extends ContentFieldKind> = Exclude<
  {
    [
      K in keyof ContentFieldsOf<TDefinition>
    ]: ContentFieldsOf<TDefinition>[K] extends {
      kind: TKind;
    }
      ? K
      : never;
  }[keyof ContentFieldsOf<TDefinition>],
  CollectionFieldKeys<ContentFieldsOf<TDefinition>>
> &
  string;

/**
 * Field names a **public** filter may name.
 *
 * Wider than {@link FilterableContentFieldName} by exactly the localized half: an
 * admin list is a query over the base table, but a public localized read already
 * joins the translation it is serving, so filtering on a localized field is one
 * more predicate on a row it was fetching anyway - evaluated against the language
 * the reader will actually see.
 */
export type PublicFilterableContentFieldName<TDefinition> = AnyFieldNamesOfKind<
  TDefinition,
  FilterableContentFieldKind
>;

/**
 * Equality filters accepted by `service.findMany`, one key per filterable
 * field - plus `status` once publication is enabled, which is a generated
 * column rather than a declared field.
 */
/**
 * The one filter a to-many relation accepts: "this record is related to *that*
 * row".
 *
 * An object rather than a bare identifier so it can never be confused with the
 * equality filter a to-one relation takes, and so the SQL it compiles to - an
 * indexed `EXISTS` over the junction table - is chosen by the shape of the value
 * rather than by looking up the descriptor twice. There is deliberately no
 * `containsAll`, no `containsAny` and no traversal: that is a query language,
 * and a hand-written route is the better answer to it.
 */
export interface ContentRelationFilter {
  contains: number;
}

export type ContentFilterInput<TDefinition> = Partial<
  Record<ContentRelationCollectionName<TDefinition>, ContentRelationFilter> &
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
  | ContentSharedFieldName<TDefinition>
  | ContentSystemField
  | (TDefinition extends { editorial: { enabled: true } }
      ? ContentEditorialField
      : never)
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
 * How an exposed `relation` comes back: an identifier, and nothing else.
 *
 * Deliberately not the related row, and deliberately **not a label**. The
 * obvious label is the target's `admin.titleField`, but that is administrative
 * metadata: it may name a field the target does not expose publicly, the target
 * may have no `publicApi` at all, and the row it is read from may itself be a
 * draft. Publishing an internal name because two content types are related is
 * not a decision one allowlist should make on behalf of another.
 *
 * An identifier is enough to fetch the related row through its own public API,
 * which is the layer that decides what it is willing to say. Configurable
 * public relation labels are a later stage; deep nesting and arbitrary
 * population are the point at which a REST projection turns into GraphQL, and a
 * hand-written route is the better answer to that.
 */
export interface ContentPublicRelation {
  id: number;
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
        ? // A file crosses as the normalised descriptor rather than as the
          // `core_files.id` the column holds: an identifier is useless to an
          // anonymous reader, who has no route to resolve it through, and the
          // descriptor is already the allowlisted shape - no key, no uploader,
          // no metadata bag. A gallery is the same answer, once per entry, in
          // the stored order.
          TFields[TName] extends { kind: "file"; multiple: true }
          ? ContentFileDescriptor[]
          : TFields[TName] extends { kind: "file" }
            ? TFields[TName] extends { nullable: true }
              ? ContentFileDescriptor | null
              : ContentFileDescriptor
            : TFields[TName] extends { kind: "relation"; multiple: true }
              ? number[]
              : TFields[TName] extends { kind: "relation" }
                ? TFields[TName] extends { nullable: true }
                  ? ContentPublicRelation | null
                  : ContentPublicRelation
                : ContentFieldValue<TFields[TName]>
        : never;

/** The dotted paths in an allowlist, grouped by the field they belong to. */
type PublicPathOwner<TName> = TName extends `${infer TOwner}.${string}`
  ? TOwner
  : never;

type PublicPathLeaf<
  TName,
  TOwner extends string,
> = TName extends `${TOwner}.${infer TLeaf}` ? TLeaf : never;

/** The names in an allowlist that are plain fields rather than leaf paths. */
type PublicFlatName<TName> = TName extends `${string}.${string}`
  ? never
  : TName;

/**
 * The nested half of a public response: one key per group or repeatable that
 * has at least one exposed leaf, holding **only** the leaves that were exposed.
 *
 * Leaf-level privacy falls straight out of this: `seo.indexable` is absent from
 * the type and absent from the generated `SELECT`, however many other `seo.*`
 * paths the allowlist names.
 */
type ContentPublicNested<TFields, TName extends string> = {
  [TOwner in keyof TFields & PublicPathOwner<TName>]: TFields[TOwner] extends {
    fields: infer TInner;
    kind: "repeatable";
  }
    ? Prettify<
        {
          [
            TLeaf in keyof TInner & PublicPathLeaf<TName, string & TOwner>
          ]: ContentFieldValue<TInner[TLeaf]>;
        } & { id: number }
      >[]
    : TFields[TOwner] extends { fields: infer TInner; kind: "group" }
      ? ApplyNullable<
          Prettify<{
            [
              TLeaf in keyof TInner & PublicPathLeaf<TName, string & TOwner>
            ]: ContentFieldValue<TInner[TLeaf]>;
          }>,
          TFields[TOwner]
        >
      : never;
};

/**
 * One public row: exactly the allowlisted fields, and not one key more.
 *
 * A field the content type declares but `publicApi.fields` does not name is
 * absent from this type *and* absent from the generated `SELECT`, so it never
 * leaves Postgres. Adding a field to the content type does not add it here.
 */
export type ContentPublicSelect<TDefinition> = Prettify<
  ContentPublicLocaleColumn<TDefinition> &
    ContentPublicNested<
      ContentFieldsOf<TDefinition>,
      ContentPublicFieldName<TDefinition>
    > & {
      [
        K in PublicFlatName<ContentPublicFieldName<TDefinition>>
      ]: ContentPublicValue<ContentFieldsOf<TDefinition>, K>;
    }
>;

/**
 * The language a public row is actually in, on a localized content type.
 *
 * Not always the language that was asked for: with `fallback: "default"` a locale
 * with no translation of its own is served the default one, and a reader that
 * cannot tell the difference cannot render `hreflang`, a language switcher or a
 * "not translated yet" notice. So the served locale is part of the response
 * rather than something inferred from the URL.
 *
 * `defineContentType` reserves the name: a localized content type with a public
 * API may not expose a field called `locale`.
 */
type ContentPublicLocaleColumn<TDefinition> = TDefinition extends {
  localization: { enabled: true };
}
  ? { locale: string }
  : Record<never, never>;

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
export type ContentPublicFilterInput<TDefinition> = Partial<
  Record<
    ContentPublicFieldName<TDefinition> &
      ContentRelationCollectionName<TDefinition>,
    ContentRelationFilter
  > & {
    [
      K in ContentPublicFieldName<TDefinition> &
        PublicFilterableContentFieldName<TDefinition>
    ]: ContentFieldInput<ContentFieldsOf<TDefinition>[K]>;
  }
>;

/**
 * Columns the public list may be ordered by.
 *
 * Flat names only. A leaf path is a column and could in principle be ordered by,
 * but a repeatable leaf and a to-many relation are not, and one union that
 * accepts all three would put two of them past the compiler and into a runtime
 * allowlist error.
 */
export type ContentPublicOrderableFieldName<TDefinition> =
  "publishedAt" | PublicFlatName<ContentPublicFieldName<TDefinition>>;
