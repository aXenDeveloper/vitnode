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
>(
  args: SharedArgs<TRequired, TNullable> & {
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
