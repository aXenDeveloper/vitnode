import type {
  AnyContentTypeDefinition,
  ContentBooleanField,
  ContentDateTimeField,
  ContentEnumField,
  ContentGroupField,
  ContentNumberField,
  ContentOnDelete,
  ContentRelationField,
  ContentRepeatableField,
  ContentSlugField,
  ContentSlugRequired,
  ContentTextareaField,
  ContentTextField,
  ContentUserField,
} from "./types";

interface SharedArgs<
  TRequired extends boolean = false,
  TNullable extends boolean = false,
> {
  description?: string;
  nullable?: TNullable;
  required?: TRequired;
}

/**
 * `required` and `nullable` default to `false`. The assertions keep the literal
 * type parameter the caller inferred - `?? false` alone would widen it back to
 * `boolean` and every downstream `nullable extends true` check would break.
 */
const shared = <TRequired extends boolean, TNullable extends boolean>(
  args: SharedArgs<TRequired, TNullable>,
): { nullable: TNullable; required: TRequired } => ({
  nullable: (args.nullable ?? false) as TNullable,
  required: (args.required ?? false) as TRequired,
});

/**
 * `localized` defaults to `false`, and the assertion keeps the literal the
 * caller inferred - `?? false` alone would widen it back to `boolean`, and every
 * `localized extends true` partition would resolve to the shared branch.
 */
const localizedOf = <TLocalized extends boolean>(
  args: LocalizableArgs<TLocalized>,
): TLocalized => (args.localized ?? false) as TLocalized;

interface LocalizableArgs<TLocalized extends boolean = false> {
  /**
   * Store the value per language, in the generated translation table.
   *
   * Needs `localization: { enabled: true, defaultLocale }` on the content type.
   * Only `text`, `textarea` and `slug` accept this.
   */
  localized?: TLocalized;
}

const text = <
  TRequired extends boolean = false,
  TNullable extends boolean = false,
  TDefault extends string | undefined = undefined,
  TLocalized extends boolean = false,
>(
  args: LocalizableArgs<TLocalized> &
    SharedArgs<TRequired, TNullable> & {
      defaultValue?: TDefault;
      maxLength?: number;
      minLength?: number;
      unique?: boolean;
    } = {},
): ContentTextField<TRequired, TNullable, TDefault, TLocalized> => ({
  ...args,
  ...shared(args),
  defaultValue: args.defaultValue as TDefault,
  kind: "text",
  localized: localizedOf(args),
});

const textarea = <
  TRequired extends boolean = false,
  TNullable extends boolean = false,
  TDefault extends string | undefined = undefined,
  TLocalized extends boolean = false,
>(
  args: LocalizableArgs<TLocalized> &
    SharedArgs<TRequired, TNullable> & {
      defaultValue?: TDefault;
      maxLength?: number;
      minLength?: number;
    } = {},
): ContentTextareaField<TRequired, TNullable, TDefault, TLocalized> => ({
  ...args,
  ...shared(args),
  defaultValue: args.defaultValue as TDefault,
  kind: "textarea",
  localized: localizedOf(args),
});

const number = <
  TRequired extends boolean = false,
  TNullable extends boolean = false,
  TDefault extends number | undefined = undefined,
>(
  args: SharedArgs<TRequired, TNullable> & {
    defaultValue?: TDefault;
    integer: boolean;
    max?: number;
    min?: number;
  },
): ContentNumberField<TRequired, TNullable, TDefault> => ({
  ...args,
  ...shared(args),
  defaultValue: args.defaultValue as TDefault,
  kind: "number",
});

const boolean = <
  TRequired extends boolean = false,
  TNullable extends boolean = false,
  TDefault extends boolean | undefined = undefined,
>(
  args: SharedArgs<TRequired, TNullable> & { defaultValue?: TDefault } = {},
): ContentBooleanField<TRequired, TNullable, TDefault> => ({
  ...args,
  ...shared(args),
  defaultValue: args.defaultValue as TDefault,
  kind: "boolean",
});

const enumField = <
  const TValues extends readonly [string, ...string[]],
  TRequired extends boolean = false,
  TNullable extends boolean = false,
  TDefault extends TValues[number] | undefined = undefined,
>(
  args: SharedArgs<TRequired, TNullable> & {
    defaultValue?: TDefault;
    display?: "radio" | "select";
    length?: number;
    values: TValues;
  },
): ContentEnumField<TValues, TRequired, TNullable, TDefault> => ({
  ...args,
  ...shared(args),
  defaultValue: args.defaultValue as TDefault,
  kind: "enum",
});

/**
 * A URL segment, normalised on the way in and unique-indexed automatically.
 *
 * ```ts
 * slug: field.slug({ source: "title" })   // derived when the payload omits it
 * slug: field.slug()                      // always supplied by the caller
 * ```
 *
 * `source` must name a `text` field on the same content type. There is no
 * `required` argument: a slug with a source is always derivable and therefore
 * optional in the create payload, and one without a source can only come from
 * the caller. `nullable` is not an argument either - a row nobody can address
 * by URL is not a thing worth allowing.
 *
 * The slug is never re-derived by an update. Changing the title leaves the URL
 * alone; sending `slug` explicitly is the only way to move it.
 */
const slug = <
  TSource extends string | undefined = undefined,
  TLocalized extends boolean = false,
>(
  args: LocalizableArgs<TLocalized> & {
    description?: string;
    /** `varchar` length and the truncation point. Defaults to 160. */
    maxLength?: number;
    source?: TSource;
  } = {},
): ContentSlugField<TSource, TLocalized> => ({
  ...args,
  kind: "slug",
  localized: localizedOf(args),
  nullable: false,
  required: (args.source === undefined) as ContentSlugRequired<TSource>,
  source: args.source as TSource,
});

const dateTime = <
  TRequired extends boolean = false,
  TNullable extends boolean = false,
  TDefaultNow extends boolean = false,
>(
  args: SharedArgs<TRequired, TNullable> & { defaultNow?: TDefaultNow } = {},
): ContentDateTimeField<TRequired, TNullable, TDefaultNow> => ({
  ...args,
  ...shared(args),
  defaultNow: (args.defaultNow ?? false) as TDefaultNow,
  kind: "dateTime",
});

/**
 * A reference to a VitNode user.
 *
 * The only field builder whose `nullable` defaults to `true`, matching how
 * every hand-written VitNode table stores an author (`blog_posts.authorId` is
 * nullable with `ON DELETE SET NULL`): accounts get deleted, and their content
 * should outlive them rather than disappear or block the deletion. Pass
 * `nullable: false` and the `onDelete` default moves to `"restrict"`, because
 * `"set null"` on a `NOT NULL` column is rejected at definition time.
 */
const user = <
  TRequired extends boolean = false,
  TNullable extends boolean = true,
>(
  args: SharedArgs<TRequired, TNullable> & { onDelete?: ContentOnDelete } = {},
): ContentUserField<TRequired, TNullable> => {
  const nullable = (args.nullable ?? true) as TNullable;

  return {
    ...args,
    nullable,
    required: (args.required ?? false) as TRequired,
    kind: "user",
    onDelete: args.onDelete ?? (nullable ? "set null" : "restrict"),
  };
};

/**
 * A reference to rows of another content type - or of this one.
 *
 * ```ts
 * category:   field.relation({ target: () => categoryContentType })
 * categories: field.relation({ target: () => categoryContentType, multiple: true })
 * related:    field.relation({ target: () => articleContentType, multiple: true, ordered: true })
 * ```
 *
 * `target` is a thunk, which is what makes the third line legal inside
 * `articleContentType` itself: the reference is resolved on first read rather
 * than at declaration, so a self-relation needs nothing the other two do not.
 *
 * `multiple: true` moves the value off the row into a generated junction table.
 * A to-many relation is therefore never `required` and never `nullable` - the
 * empty set is what "no targets" looks like - and `defineContentType` rejects
 * both arguments alongside it.
 *
 * `ordered: true` keeps the author's order. Without it the set comes back in
 * ascending target-id order, which is still deterministic; it is simply not
 * something anybody chose.
 */
const relation = <
  TRequired extends boolean = false,
  TNullable extends boolean = false,
  TMultiple extends boolean = false,
  TOrdered extends boolean = false,
>(
  args: SharedArgs<TRequired, TNullable> & {
    multiple?: TMultiple;
    onDelete?: ContentOnDelete;
    ordered?: TOrdered;
    target: () => AnyContentTypeDefinition;
  },
): ContentRelationField<TRequired, TNullable, TMultiple, TOrdered> => ({
  ...args,
  ...shared(args),
  kind: "relation",
  // The assertions keep the literal the caller inferred, exactly as `shared`
  // and `localizedOf` do: `?? false` alone widens back to `boolean`, and every
  // `multiple extends true` partition would resolve to the to-one branch.
  multiple: (args.multiple ?? false) as TMultiple,
  onDelete: args.onDelete ?? "restrict",
  ordered: (args.ordered ?? false) as TOrdered,
});

/**
 * A reusable structured group: several related leaves under one name.
 *
 * ```ts
 * const seoGroup = field.group({
 *   fields: {
 *     title: field.text({ nullable: true }),
 *     description: field.textarea({ nullable: true }),
 *   },
 * });
 *
 * // then, in as many content types as you like:
 * fields: { title: field.text({ required: true }), seo: seoGroup }
 * ```
 *
 * The value stays nested (`row.seo.title`); the storage stays relational (a
 * `seo_title` column, indexable and constrainable like any other). Leaves are
 * scalars - see `CONTENT_ADVANCED_LEAF_KINDS` for why each other kind is out.
 *
 * `localized: true` moves the **whole** group into the translation table.
 * Marking one leaf is a definition-time error: half a logical value on each
 * table would mean two revision histories and two permissions for one thing an
 * editor sees as one box.
 */
const group = <
  const TFields extends Record<string, { kind: string }>,
  TRequired extends boolean = false,
  TNullable extends boolean = false,
  TLocalized extends boolean = false,
>(
  args: LocalizableArgs<TLocalized> &
    SharedArgs<TRequired, TNullable> & { fields: TFields },
): ContentGroupField<TFields, TRequired, TNullable, TLocalized> => ({
  ...args,
  ...shared(args),
  kind: "group",
  localized: localizedOf(args),
});

/**
 * A repeatable structured group: zero or more ordered child rows.
 *
 * ```ts
 * faq: field.repeatable({
 *   fields: {
 *     question: field.text({ required: true }),
 *     answer: field.textarea({ required: true }),
 *   },
 * })
 * ```
 *
 * Stored in a generated child table with a `serial` primary key, so every child
 * keeps a stable identity across reorders - which is what makes "update child
 * 11" and "restore the row that used to be here" mean anything.
 *
 * Never nullable, never required and never localized. The first two because the
 * empty array already says "nothing here"; the third because a per-language list
 * of *different lengths* has no defensible restore or reorder semantics, and
 * guessing one is worse than saying no. `field.repeatable({ localized: true })`
 * is a definition-time error with that explanation.
 */
const repeatable = <const TFields extends Record<string, { kind: string }>>(
  args: {
    description?: string;
    fields: TFields;
    /** Upper bound on child rows. Defaults to 100. */
    max?: number;
    /** Lower bound on child rows. Defaults to none. */
    min?: number;
  } & { localized?: never },
): ContentRepeatableField<TFields> => ({
  ...args,
  kind: "repeatable",
  nullable: false,
  required: false,
});

/**
 * Field builders for `defineContentType`. Every builder returns plain data -
 * no Drizzle, no React - so a content type definition is safe to import from
 * both the API and a client component.
 */
export const field = {
  boolean,
  dateTime,
  enum: enumField,
  group,
  number,
  relation,
  repeatable,
  slug,
  text,
  textarea,
  user,
};
