import type {
  AnyContentTypeDefinition,
  ContentBooleanField,
  ContentDateTimeField,
  ContentEnumField,
  ContentFileField,
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

import { ContentEngineError } from "./errors";
import {
  assertContentFileMaxBytes,
  normalizeContentFileExtensions,
  normalizeContentFileMimeTypes,
} from "./files";

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
 * One stored file, referenced by its `core_files` row.
 *
 * ```ts
 * coverImage: field.file({
 *   maxBytes: 5 * 1024 * 1024,
 *   allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".avif"],
 *   allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
 * })
 * ```
 *
 * The column is an `integer` foreign key with `ON DELETE RESTRICT`, so Postgres
 * itself refuses to delete a file an article still points at. Nothing about the
 * file - not the name, not the URL, not the storage key - is copied onto the
 * content row: one fact, in one place.
 *
 * **`maxBytes` is required.** There is no unlimited Content Engine file field:
 * the ceiling is the only thing between a form and an upload that fills the
 * disk, and a default would be a number nobody chose applied to every field in
 * every plugin. It is checked here, at definition time, so a bad value is an
 * import-time error rather than a request that succeeds until it does not.
 *
 * `allowedExtensions` and `allowedMimeTypes` are **two** rules, and a strict
 * field states both: the first is what the file is *called*, the second is what
 * the client *declared* the bytes are. Both have to match, so `picture.gif`
 * carrying `image/png` is refused by a GIF-only field - which is precisely the
 * case an extension-only check waves through. Extensions are normalised, so
 * `GIF`, `.gif` and `.Gif` are one rule.
 *
 * `nullable` defaults to **true**, like `field.user`: a cover image is something
 * a record may not have yet, and a `NOT NULL` file column would mean no article
 * can exist before somebody uploads one. Pass `nullable: false` with
 * `required: true` for a field that genuinely must carry a file.
 *
 * `multiple: true` moves the reference off the row into a generated junction
 * table, exactly as it does for a `relation`:
 *
 * ```ts
 * gallery: field.file({
 *   multiple: true,
 *   min: 1,
 *   max: 12,
 *   maxBytes: 5 * 1024 * 1024,
 *   allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
 *   allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
 * })
 * ```
 *
 * A gallery is therefore never `required` and never `nullable` - the empty set
 * is what "no files" looks like - and `min` is how a content type says "at least
 * one". Every entry is checked against the *same* per-file rules: `maxBytes` and
 * both allowlists apply once per file, because ten images are ten uploads rather
 * than one bigger one. `ordered` defaults to **true**, which keeps the order the
 * files were added in; pass `false` to store them by ascending `core_files.id`.
 *
 * There is still no `localized` argument. A per-language file is out of scope
 * (`localized: true` is refused at definition time) - translate the alt text.
 */
const file = <
  TRequired extends boolean = false,
  TMultiple extends boolean = false,
  // Declared after `TMultiple` so its default can read it: a gallery has no
  // column to be null, so the `nullable: true` that lets a record exist before
  // anybody uploads a cover would be a definition-time error here.
  TNullable extends boolean = TMultiple extends true ? false : true,
  TOrdered extends boolean = TMultiple,
>(
  args: SharedArgs<TRequired, TNullable> & {
    allowedExtensions?: readonly string[];
    allowedMimeTypes?: readonly string[];
    /** The most files to accept. `multiple: true` only. */
    max?: number;
    maxBytes: number;
    /** The fewest files to accept. `multiple: true` only. */
    min?: number;
    multiple?: TMultiple;
    ordered?: TOrdered;
  },
): ContentFileField<TRequired, TNullable, TMultiple, TOrdered> => {
  // Destructured rather than spread: the arguments accept `readonly string[]` so
  // an `as const` list is ergonomic, and the descriptor stores the normalised
  // mutable copy. Spreading `args` would carry the readonly originals through.
  const { allowedExtensions, allowedMimeTypes, maxBytes, ...rest } = args;
  const multiple = (args.multiple ?? false) as TMultiple;

  return {
    ...rest,
    nullable: (args.nullable ?? !multiple) as TNullable,
    required: (args.required ?? false) as TRequired,
    ...(allowedExtensions
      ? { allowedExtensions: normalizeContentFileExtensions(allowedExtensions) }
      : {}),
    ...(allowedMimeTypes
      ? { allowedMimeTypes: normalizeContentFileMimeTypes(allowedMimeTypes) }
      : {}),
    kind: "file",
    maxBytes: assertContentFileMaxBytes(maxBytes),
    // The assertions keep the literal the caller inferred, exactly as `shared`
    // does: `?? false` alone widens back to `boolean`, and every
    // `multiple extends true` partition would resolve to the single-file branch.
    multiple,
    ordered: (args.ordered ?? multiple) as TOrdered,
  };
};

/**
 * A reference to a VitNode user.
 *
 * ```ts
 * author:  field.user()
 * authors: field.user({ multiple: true, ordered: true })
 * ```
 *
 * The only field builder whose `nullable` defaults to `true`, matching how
 * every hand-written VitNode table stores an author (`blog_posts.authorId` is
 * nullable with `ON DELETE SET NULL`): accounts get deleted, and their content
 * should outlive them rather than disappear or block the deletion. Pass
 * `nullable: false` and the `onDelete` default moves to `"restrict"`, because
 * `"set null"` on a `NOT NULL` column is rejected at definition time.
 *
 * `multiple: true` moves the reference off the row into a generated junction
 * table, exactly as it does for a `relation` - so a to-many people field is
 * never `required` and never `nullable` (the empty set is what "nobody" looks
 * like), and its `onDelete` may not be `"set null"`: a junction row has no
 * column to null, and forgetting a deleted person's authorship is a deleted
 * row. `defineContentType` rejects all three.
 *
 * `ordered: true` keeps the order the editor put them in, which for authors is
 * usually the point - the first author of a piece is not an arbitrary member of
 * a set. Without it the people come back in ascending id order.
 */
const user = <
  TRequired extends boolean = false,
  TMultiple extends boolean = false,
  // Declared after `TMultiple` so its default can read it: a to-many field has
  // no column to be null, so the `nullable: true` that lets a single author
  // survive a deleted account would be a definition-time error here.
  TNullable extends boolean = TMultiple extends true ? false : true,
  TOrdered extends boolean = false,
>(
  args: SharedArgs<TRequired, TNullable> & {
    /** The fewest people to accept. `multiple: true` only. */
    min?: number;
    multiple?: TMultiple;
    onDelete?: ContentOnDelete;
    ordered?: TOrdered;
  } = {},
): ContentUserField<TRequired, TNullable, TMultiple, TOrdered> => {
  const multiple = (args.multiple ?? false) as TMultiple;
  const nullable = (args.nullable ?? !multiple) as TNullable;
  // `cascade` is the to-many analogue of `set null`: the reference is a row, so
  // forgetting a deleted person's authorship means deleting it. A to-one field
  // keeps the nullable column it always had.
  const onDeleteDefault = multiple
    ? "cascade"
    : nullable
      ? "set null"
      : "restrict";

  return {
    ...args,
    nullable,
    required: (args.required ?? false) as TRequired,
    kind: "user",
    // The assertions keep the literal the caller inferred, exactly as `shared`
    // does: `?? false` alone widens back to `boolean`, and every
    // `multiple extends true` partition would resolve to the to-one branch.
    multiple,
    onDelete: args.onDelete ?? onDeleteDefault,
    ordered: (args.ordered ?? false) as TOrdered,
  };
};

/**
 * The placeholder a `self: true` relation carries until it is rebound.
 *
 * Throws rather than returning something plausible: reaching it means
 * `defineContentType` did not rebind the thunk, and a relation silently
 * pointing at the wrong table is a data bug rather than a crash.
 */
export const unboundSelfTarget = (): AnyContentTypeDefinition => {
  throw new ContentEngineError(
    "A `self: true` relation was read before `defineContentType` bound it. Build the field inside a `defineContentType` call.",
  );
};

/**
 * A reference to rows of another content type - or of this one.
 *
 * ```ts
 * category:   field.relation({ target: () => categoryContentType })
 * categories: field.relation({ target: () => categoryContentType, multiple: true })
 * related:    field.relation({ self: true, multiple: true, ordered: true })
 * ```
 *
 * `target` is a thunk, so two content types can point at each other without a
 * circular import. A **self**-relation uses `self: true` instead, and the
 * difference is not stylistic: `target: () => thisContentType` would make the
 * definition's own inferred type circular, and TypeScript resolves that by
 * widening the whole definition to `any` - taking every nested value type and
 * every allowlist check with it, silently.
 *
 * `multiple: true` moves the value off the row into a generated junction table.
 * A to-many relation is therefore never `required` and never `nullable` - the
 * empty set is what "no targets" looks like - and `defineContentType` rejects
 * both arguments alongside it.
 *
 * `ordered: true` keeps the author's order. Without it the set comes back in
 * ascending target-id order, which is still deterministic; it is simply not
 * something anybody chose.
 *
 * Exactly one of `self` and `target` is required. It is checked by
 * `defineContentType` rather than by a union in this signature, because a union
 * here would stop TypeScript inferring `self` as a literal - and
 * `ContentReferences` reads that literal to decide which relations the database
 * module has to supply a thunk for. The check still fails at import time.
 */
const relation = <
  TRequired extends boolean = false,
  TNullable extends boolean = false,
  TMultiple extends boolean = false,
  TOrdered extends boolean = false,
  TSelf extends boolean = false,
>(
  args: SharedArgs<TRequired, TNullable> & {
    /**
     * The fewest targets to accept - `min: 1` is "at least one category".
     *
     * `multiple: true` only. A to-many reference can never be `required`, so
     * this is the shape a "you must choose something" rule actually takes.
     */
    min?: number;
    multiple?: TMultiple;
    onDelete?: ContentOnDelete;
    ordered?: TOrdered;
    /** The target is this content type. Mutually exclusive with `target`. */
    self?: TSelf;
    target?: () => AnyContentTypeDefinition;
  },
): ContentRelationField<TRequired, TNullable, TMultiple, TOrdered, TSelf> => ({
  ...args,
  ...shared(args),
  kind: "relation",
  // The assertions keep the literal the caller inferred, exactly as `shared`
  // and `localizedOf` do: `?? false` alone widens back to `boolean`, and every
  // `multiple extends true` partition would resolve to the to-one branch.
  multiple: (args.multiple ?? false) as TMultiple,
  onDelete: args.onDelete ?? "restrict",
  ordered: (args.ordered ?? false) as TOrdered,
  self: (args.self ?? false) as TSelf,
  target: args.target ?? unboundSelfTarget,
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
  file,
  group,
  number,
  relation,
  repeatable,
  slug,
  text,
  textarea,
  user,
};
