import type { BlockAllowedSpec } from "../blocks/types";
import type { AnyContentContainerDefinition } from "./containers/types";
import type {
  AnyContentTypeDefinition,
  ContentBlocksField,
  ContentBooleanField,
  ContentContainerField,
  ContentDateTimeField,
  ContentEnumField,
  ContentFieldAiAssist,
  ContentFileField,
  ContentGroupField,
  ContentNumberField,
  ContentOnDelete,
  ContentRelationField,
  ContentRelationTarget,
  ContentRepeatableField,
  ContentRichTextField,
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
} from "./file-rules";

interface SharedArgs<
  TRequired extends boolean = false,
  TNullable extends boolean = false,
> {
  /** Free text or an i18n key shown under the field in the AdminCP and in OpenAPI. */
  description?: string;
  /** The column accepts `NULL` and `null` is a valid value. Defaults to `false`. */
  nullable?: TNullable;
  /**
   * The value must be present in a create payload. Defaults to `false`; the
   * inferred create input type makes the property optional accordingly.
   */
  required?: TRequired;
}

const shared = <TRequired extends boolean, TNullable extends boolean>(
  args: SharedArgs<TRequired, TNullable>,
): { nullable: TNullable; required: TRequired } => ({
  nullable: (args.nullable ?? false) as TNullable,
  required: (args.required ?? false) as TRequired,
});

const localizedOf = <TLocalized extends boolean>(
  args: LocalizableArgs<TLocalized>,
): TLocalized => (args.localized ?? false) as TLocalized;

interface LocalizableArgs<TLocalized extends boolean = false> {
  /**
   * Store one value per language in the generated translation table instead of
   * one shared value on the base table. Needs the content type's
   * `localization: { defaultLocale }`. Defaults to `false`.
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
      /** Lets an AI action suggest a value from other fields in the AdminCP. */
      ai?: ContentFieldAiAssist;
      /** Column default, used when a create payload leaves the field out. */
      defaultValue?: TDefault;
      /** `varchar` length and validation limit. Defaults to 255. */
      maxLength?: number;
      minLength?: number;
      /** Adds a unique index on the column. */
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
      /** Lets an AI action suggest a value from other fields in the AdminCP. */
      ai?: ContentFieldAiAssist;
      /** Column default, used when a create payload leaves the field out. */
      defaultValue?: TDefault;
      /** Validation limit for the stored `text`. Unlimited when omitted. */
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

const richText = <
  TRequired extends boolean = false,
  TNullable extends boolean = false,
  TLocalized extends boolean = false,
>(
  args: LocalizableArgs<TLocalized> &
    SharedArgs<TRequired, TNullable> & {
      /** Largest serialised document accepted, in bytes. Defaults to 1 MiB. */
      maxBytes?: number;
    } = {},
): ContentRichTextField<TRequired, TNullable, TLocalized> => ({
  ...args,
  ...shared(args),
  kind: "richText",
  localized: localizedOf(args),
});

const number = <
  TRequired extends boolean = false,
  TNullable extends boolean = false,
  TDefault extends number | undefined = undefined,
>(
  args: SharedArgs<TRequired, TNullable> & {
    defaultValue?: TDefault;
    /** `true` stores an `integer` and rejects fractions; `false` stores `double precision`. */
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
    /** AdminCP control only - storage is always `varchar`. */
    display?: "radio" | "select";
    /** `varchar` length. Defaults to 64. */
    length?: number;
    /** The allowed values, inferred as a literal union. */
    values: TValues;
  },
): ContentEnumField<TValues, TRequired, TNullable, TDefault> => ({
  ...args,
  ...shared(args),
  defaultValue: args.defaultValue as TDefault,
  kind: "enum",
});

const slug = <
  TSource extends string | undefined = undefined,
  TLocalized extends boolean = false,
  TGenerated extends boolean = false,
>(
  args: LocalizableArgs<TLocalized> & {
    description?: string;
    /** A random token minted on create. Mutually exclusive with `source`. */
    generated?: TGenerated;
    /** `varchar` length and the truncation point. Defaults to 160. */
    maxLength?: number;
    /**
     * A text field the server derives the slug from when none is sent. Without
     * `source` or `generated`, the slug is required in the create payload.
     */
    source?: TSource;
  } = {},
): ContentSlugField<TSource, TLocalized, TGenerated> => {
  const generated = (args.generated ?? false) as TGenerated;

  return {
    ...args,
    generated,
    kind: "slug",
    localized: localizedOf(args),
    nullable: false,
    required: (args.source === undefined && !generated) as ContentSlugRequired<
      TSource,
      TGenerated
    >,
    source: args.source as TSource,
  };
};

const dateTime = <
  TRequired extends boolean = false,
  TNullable extends boolean = false,
  TDefaultNow extends boolean = false,
>(
  args: SharedArgs<TRequired, TNullable> & {
    /** Defaults the column to the insert time, which makes it optional on create. */
    defaultNow?: TDefaultNow;
  } = {},
): ContentDateTimeField<TRequired, TNullable, TDefaultNow> => ({
  ...args,
  ...shared(args),
  defaultNow: (args.defaultNow ?? false) as TDefaultNow,
  kind: "dateTime",
});

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
    /** Accepted extensions such as `".png"`, normalised to lowercase. Any when omitted. */
    allowedExtensions?: readonly string[];
    /** Accepted media types, normalised to lowercase. Any when omitted. */
    allowedMimeTypes?: readonly string[];
    /** The most files to accept. `multiple: true` only. */
    max?: number;
    /** Largest accepted upload, in bytes. Required, finite and greater than zero. */
    maxBytes: number;
    /** The fewest files to accept. `multiple: true` only. */
    min?: number;
    /** Several files, stored in a generated junction table. Defaults to `false`. */
    multiple?: TMultiple;
    /** Keep the files in the order they were given. Defaults to `multiple`. */
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
    /** Several people, stored in a generated junction table. Defaults to `false`. */
    multiple?: TMultiple;
    /**
     * What happens when the referenced account is deleted. Defaults to
     * `cascade` for `multiple`, `set null` for a nullable field, and `restrict`
     * otherwise.
     */
    onDelete?: ContentOnDelete;
    /** Keep the people in the order they were given. Defaults to `false`. */
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

export const unboundSelfTarget = (): AnyContentTypeDefinition => {
  throw new ContentEngineError(
    "A `self: true` relation was read before `defineContentType` bound it. Build the field inside a `defineContentType` call.",
  );
};

const relation = <
  TRequired extends boolean = false,
  TNullable extends boolean = false,
  TMultiple extends boolean = false,
  TOrdered extends boolean = false,
  TSelf extends boolean = false,
  TTarget extends ContentRelationTarget = ContentRelationTarget<"serial">,
  TContainer extends boolean = false,
>(
  args: SharedArgs<TRequired, TNullable> & {
    /**
     * The record lives in the related record's container - a reply sits in its
     * topic's forum. To-one, required and never `self`.
     */
    container?: TContainer;
    /** The fewest related records to accept. `multiple: true` only. */
    min?: number;
    /** Several records, stored in a generated junction table. Defaults to `false`. */
    multiple?: TMultiple;
    /** What happens when the referenced record is deleted. Defaults to `restrict`. */
    onDelete?: ContentOnDelete;
    /** Keep the related records in the order they were given. Defaults to `false`. */
    ordered?: TOrdered;
    /** The target is this content type. Mutually exclusive with `target`. */
    self?: TSelf;
    /**
     * The related content type, behind a thunk so two content types can
     * reference each other without a circular import.
     */
    target?: () => TTarget;
  },
): ContentRelationField<
  TRequired,
  TNullable,
  TMultiple,
  TOrdered,
  TSelf,
  TSelf extends true ? "serial" : TTarget["idStrategy"],
  TContainer
> => ({
  ...args,
  ...shared(args),
  container: (args.container ?? false) as TContainer,
  kind: "relation",
  // The assertions keep the literal the caller inferred, exactly as `shared`
  // and `localizedOf` do: `?? false` alone widens back to `boolean`, and every
  // `multiple extends true` partition would resolve to the to-one branch.
  multiple: (args.multiple ?? false) as TMultiple,
  onDelete: args.onDelete ?? "restrict",
  ordered: (args.ordered ?? false) as TOrdered,
  self: (args.self ?? false) as TSelf,
  target: (args.target ?? unboundSelfTarget) as () => ContentRelationTarget<
    TSelf extends true ? "serial" : TTarget["idStrategy"]
  >,
});

const group = <
  const TFields extends Record<string, { kind: string }>,
  TRequired extends boolean = false,
  TNullable extends boolean = false,
  TLocalized extends boolean = false,
>(
  args: LocalizableArgs<TLocalized> &
    SharedArgs<TRequired, TNullable> & {
      /** Scalar leaves only, stored as columns addressed by `group.leaf` paths. */
      fields: TFields;
    },
): ContentGroupField<TFields, TRequired, TNullable, TLocalized> => ({
  ...args,
  ...shared(args),
  kind: "group",
  localized: localizedOf(args),
});

const repeatable = <const TFields extends Record<string, { kind: string }>>(
  args: {
    description?: string;
    /** Scalar leaves only, stored as columns of a generated child table. */
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

const blocks = <
  const TAllowed extends BlockAllowedSpec = "*",
  TLocalized extends boolean = false,
>(
  args: LocalizableArgs<TLocalized> & {
    /** Which block types the zone accepts. Defaults to `"*"`, every registered block. */
    allowed?: TAllowed;
    description?: string;
    /** The most blocks the zone stores. Defaults to 200. */
    max?: number;
    /** The fewest blocks the zone must hold. */
    min?: number;
  } = {},
): ContentBlocksField<TAllowed, TLocalized> => ({
  ...args,
  allowed: (args.allowed ?? "*") as TAllowed,
  kind: "blocks",
  localized: localizedOf(args),
  nullable: false,
  required: false,
});

const container = <
  const TDefinition extends AnyContentContainerDefinition,
  TRequired extends boolean = false,
>(args: {
  /** The container definition from `defineContentContainer()`. */
  definition: TDefinition;
  description?: string;
  /** Every record must belong to a container. Nullable when `false` (the default). */
  required?: TRequired;
}): ContentContainerField<TRequired, TDefinition> => {
  const required = (args.required ?? false) as TRequired;

  return {
    ...args,
    kind: "container",
    nullable: !required as TRequired extends true ? false : true,
    required,
  };
};

/**
 * Field builders for the `fields` map of `defineContentType()`.
 *
 * Each builder returns a plain, JSON-shaped descriptor. Its literal options
 * (`required`, `nullable`, `localized`, `multiple`, ...) drive the inferred
 * create, update, select and public types; `defineContentType` validates the
 * combination at runtime and generates the columns, schemas and AdminCP inputs.
 * Universal: safe to import in browser and server code.
 *
 * @example
 * ```ts
 * import { defineContentType, field } from "@vitnode/core/content";
 *
 * export const noteContentType = defineContentType({
 *   id: "notes.note",
 *   tableName: "notes_notes",
 *   fields: {
 *     title: field.text({ required: true, maxLength: 120 }),
 *     slug: field.slug({ source: "title" }),
 *     body: field.richText(),
 *     authorId: field.user(),
 *   },
 * });
 * ```
 */
export const field = {
  /** A zone of nested blocks (widgets), stored as one JSONB document. Never required or nullable. */
  blocks,
  /** A `boolean` column. */
  boolean,
  /** The content container (e.g. a forum board) a record belongs to. At most one per content type. */
  container,
  /** A `timestamp` column, read as a `Date`. */
  dateTime,
  /** One of a fixed list of string values, stored as `varchar`. */
  enum: enumField,
  /**
   * One uploaded file, or several with `multiple: true`. Stored as a
   * `core_files` reference; public reads return a file descriptor, never the id.
   * Nullable by default for a single file.
   */
  file,
  /** A named set of scalar leaves stored as columns on the same row (e.g. `seo.title`). */
  group,
  /** A numeric column. `integer` is required so the storage type is always explicit. */
  number,
  /**
   * A reference to another content type's record (`target`) or to this one
   * (`self: true`). To-one is a foreign-key column; `multiple: true` uses a
   * generated junction table.
   */
  relation,
  /** An ordered list of rows of scalar leaves, stored in a generated child table. Cannot be localized. */
  repeatable,
  /** A rich-text document stored as `jsonb`, validated and size-limited on write. */
  richText,
  /**
   * A URL-safe identifier, unique per table (or per language when localized).
   * Derived from `source`, minted with `generated: true`, or sent explicitly.
   */
  slug,
  /** A single-line string stored as `varchar`. */
  text,
  /** A multi-line plain-text string stored as `text`. */
  textarea,
  /**
   * A reference to a user account. Nullable by default for a single user, so a
   * deleted account clears the reference instead of blocking the delete.
   */
  user,
  /** Alias of {@link field.blocks}. */
  widgets: blocks,
};
