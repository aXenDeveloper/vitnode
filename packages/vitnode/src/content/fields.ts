import type {
  AnyContentTypeDefinition,
  ContentBooleanField,
  ContentDateTimeField,
  ContentEnumField,
  ContentNumberField,
  ContentOnDelete,
  ContentRelationField,
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

const relation = <
  TRequired extends boolean = false,
  TNullable extends boolean = false,
>(
  args: SharedArgs<TRequired, TNullable> & {
    onDelete?: ContentOnDelete;
    target: () => AnyContentTypeDefinition;
  },
): ContentRelationField<TRequired, TNullable> => ({
  ...args,
  ...shared(args),
  kind: "relation",
  onDelete: args.onDelete ?? "restrict",
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
  number,
  relation,
  slug,
  text,
  textarea,
  user,
};
