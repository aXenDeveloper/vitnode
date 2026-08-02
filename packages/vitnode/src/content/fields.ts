import type {
  AnyContentTypeDefinition,
  ContentBooleanField,
  ContentDateTimeField,
  ContentEnumField,
  ContentNumberField,
  ContentOnDelete,
  ContentRelationField,
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

const text = <
  TRequired extends boolean = false,
  TNullable extends boolean = false,
  TDefault extends string | undefined = undefined,
>(
  args: SharedArgs<TRequired, TNullable> & {
    defaultValue?: TDefault;
    maxLength?: number;
    minLength?: number;
    unique?: boolean;
  } = {},
): ContentTextField<TRequired, TNullable, TDefault> => ({
  ...args,
  ...shared(args),
  defaultValue: args.defaultValue as TDefault,
  kind: "text",
});

const textarea = <
  TRequired extends boolean = false,
  TNullable extends boolean = false,
  TDefault extends string | undefined = undefined,
>(
  args: SharedArgs<TRequired, TNullable> & {
    defaultValue?: TDefault;
    maxLength?: number;
    minLength?: number;
  } = {},
): ContentTextareaField<TRequired, TNullable, TDefault> => ({
  ...args,
  ...shared(args),
  defaultValue: args.defaultValue as TDefault,
  kind: "textarea",
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

const user = <
  TRequired extends boolean = false,
  TNullable extends boolean = false,
>(
  args: SharedArgs<TRequired, TNullable> & { onDelete?: ContentOnDelete } = {},
): ContentUserField<TRequired, TNullable> => ({
  ...args,
  ...shared(args),
  kind: "user",
  onDelete: args.onDelete ?? "set null",
});

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
  text,
  textarea,
  user,
};
