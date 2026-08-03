import { z } from "zod";

import type {
  AnyContentTypeDefinition,
  ContentFieldDescriptor,
  ContentFieldKind,
} from "../types";

/**
 * A single form field, reduced to plain JSON.
 *
 * The AdminCP page is a server component but the form is a client one, and a
 * content type definition cannot cross that boundary - `field.relation` holds a
 * `target` thunk, and Zod schemas are not serialisable either. So the server
 * projects the definition into this spec, and the client rebuilds the form
 * schema from it with {@link buildFormSchemaFromSpec}.
 */
export interface ContentFormFieldSpec {
  defaultValue?: boolean | null | number | string;
  description?: string;
  display?: "radio" | "select";
  integer?: boolean;
  kind: ContentFieldKind;
  label: string;
  max?: number;
  maxLength?: number;
  min?: number;
  minLength?: number;
  name: string;
  nullable: boolean;
  /** Enum choices, already translated. */
  options?: { label: string; value: string }[];
  required: boolean;
}

export interface ContentFormSpec {
  contentTypeId: string;
  fields: ContentFormFieldSpec[];
  pluginId: string;
  /** Field the toast describes a newly created row by, if there is one. */
  titleField: null | string;
}

export interface ContentColumnSpec {
  kind: "system" | ContentFieldKind;
  label: string;
  name: string;
  /** Enum value -> translated label, for badge cells. */
  options?: Record<string, string>;
}

export type ContentFieldLabeller = (
  name: string,
  fieldValue?: ContentFieldDescriptor,
) => string;

export type ContentEnumLabeller = (name: string, value: string) => string;

const systemKinds: Record<string, "system"> = {
  createdAt: "system",
  id: "system",
  updatedAt: "system",
};

/** Projects a definition's form fields into the serialisable spec. */
export const buildContentFormSpec = ({
  definition,
  labelEnum,
  labelField,
  pluginId,
}: {
  definition: AnyContentTypeDefinition;
  labelEnum: ContentEnumLabeller;
  labelField: ContentFieldLabeller;
  pluginId: string;
}): ContentFormSpec => {
  const fields = definition.fields;

  return {
    contentTypeId: definition.id,
    pluginId,
    titleField: definition.admin.titleField,
    fields: definition.admin.form.fields.map(name => {
      const fieldValue = fields[name];
      const base: ContentFormFieldSpec = {
        kind: fieldValue.kind,
        label: labelField(name, fieldValue),
        name,
        nullable: fieldValue.nullable,
        required: fieldValue.required,
        ...(fieldValue.description === undefined
          ? {}
          : { description: fieldValue.description }),
      };

      switch (fieldValue.kind) {
        case "boolean":
          return { ...base, defaultValue: fieldValue.defaultValue };
        case "enum":
          return {
            ...base,
            defaultValue: fieldValue.defaultValue,
            display: fieldValue.display,
            options: fieldValue.values.map(value => ({
              label: labelEnum(name, value),
              value,
            })),
          };
        case "number":
          return {
            ...base,
            defaultValue: fieldValue.defaultValue,
            integer: fieldValue.integer,
            max: fieldValue.max,
            min: fieldValue.min,
          };
        case "text":
        case "textarea":
          return {
            ...base,
            defaultValue: fieldValue.defaultValue,
            maxLength: fieldValue.maxLength,
            minLength: fieldValue.minLength,
          };
        default:
          return base;
      }
    }),
  };
};

/** Projects the list columns into the serialisable spec. */
export const buildContentColumnSpec = ({
  definition,
  labelEnum,
  labelField,
}: {
  definition: AnyContentTypeDefinition;
  labelEnum: ContentEnumLabeller;
  labelField: ContentFieldLabeller;
}): ContentColumnSpec[] => {
  const fields = definition.fields;

  return definition.admin.list.columns.map(name => {
    const fieldValue = fields[name] as ContentFieldDescriptor | undefined;

    return {
      kind: systemKinds[name] ?? fieldValue?.kind ?? "system",
      label: labelField(name, fieldValue),
      name,
      ...(fieldValue?.kind === "enum"
        ? {
            options: Object.fromEntries(
              fieldValue.values.map(value => [value, labelEnum(name, value)]),
            ),
          }
        : {}),
    };
  });
};

/** What `AutoFormCombobox` stores for a selected option. */
export const referenceOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export type ContentReferenceOption = z.infer<typeof referenceOptionSchema>;

export const isReferenceKind = (kind: ContentFieldKind): boolean =>
  kind === "relation" || kind === "user";

const baseFieldSchema = (spec: ContentFormFieldSpec): z.ZodType => {
  switch (spec.kind) {
    case "boolean":
      return z.boolean();
    case "dateTime":
      // ISO strings all the way through the form - `z.toJSONSchema`, which
      // AutoForm runs on every schema, throws on `z.date()`.
      return z.iso.datetime();
    case "enum": {
      const values = (spec.options ?? []).map(option => option.value);

      return values.length > 0
        ? z.enum(values as [string, ...string[]])
        : z.string();
    }
    case "number": {
      // A number input hands react-hook-form a string, so the form schema
      // coerces - `z.number()` would reject "0" and disable submit.
      let schema = spec.integer ? z.coerce.number().int() : z.coerce.number();
      if (spec.min !== undefined) schema = schema.min(spec.min);
      if (spec.max !== undefined) schema = schema.max(spec.max);

      return schema;
    }
    case "relation":
    case "user":
      // `AutoFormCombobox` holds the whole option, not the id - the same shape
      // the blog plugin models by hand. `contentFormValuesToPayload` turns it
      // back into an identifier on submit.
      return referenceOptionSchema;
    default: {
      let schema = z.string();
      if (spec.minLength !== undefined) schema = schema.min(spec.minLength);
      if (spec.maxLength !== undefined) schema = schema.max(spec.maxLength);

      return schema;
    }
  }
};

/**
 * Field kinds whose input renders an empty string when it holds no value. Left
 * as-is, `""` fails ISO-date and identifier validation and the form can never
 * become valid.
 */
const EMPTY_MEANS_UNSET: ReadonlySet<ContentFieldKind> = new Set(["dateTime"]);

/**
 * The combobox needs the whole option to show a label, so an existing
 * identifier is paired with the label the list query already resolved.
 */
const toInitialValue = (
  fieldSpec: ContentFormFieldSpec,
  current: unknown,
  labels: Record<string, null | string>,
): unknown => {
  if (!isReferenceKind(fieldSpec.kind)) return current;
  if (current === null || current === undefined) return undefined;

  const id = typeof current === "number" ? current.toString() : "";

  return { label: labels[fieldSpec.name] ?? id, value: id };
};

/**
 * The row's own title, for a toast that says what was just written. Falls back
 * to nothing when the content type declares no title field.
 */
export const contentTitleFromValues = (
  spec: ContentFormSpec,
  values: Record<string, unknown>,
): string | undefined => {
  if (spec.titleField === null) return undefined;

  const value = values[spec.titleField];

  return typeof value === "string" && value.trim() !== "" ? value : undefined;
};

/** Turns validated form values into the payload the generated API accepts. */
export const contentFormValuesToPayload = (
  spec: ContentFormSpec,
  values: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(values).map(([name, value]) => {
      const fieldSpec = spec.fields.find(item => item.name === name);
      if (!fieldSpec || !isReferenceKind(fieldSpec.kind)) return [name, value];

      const option = value as ContentReferenceOption | null | undefined;
      if (!option?.value) return [name, null];

      return [name, Number(option.value)];
    }),
  );

/**
 * Rebuilds the AutoForm schema on the client.
 *
 * Mirrors the server's create schema, with two differences: existing values are
 * folded in as Zod defaults so `AutoForm`'s `getDefaults` prefills the edit
 * form, and every rule is written against what the DOM actually produces -
 * strings from number inputs, `""` from a cleared picker.
 */
export const buildFormSchemaFromSpec = (
  spec: ContentFormSpec,
  values?: Record<string, unknown>,
): z.ZodObject<z.ZodRawShape> =>
  z.object(
    Object.fromEntries(
      spec.fields.map(fieldSpec => {
        const base =
          isReferenceKind(fieldSpec.kind) && fieldSpec.required
            ? baseFieldSchema(fieldSpec).refine(
                option => (option as ContentReferenceOption).value !== "",
              )
            : baseFieldSchema(fieldSpec);
        const nullable = fieldSpec.nullable ? base.nullable() : base;
        const labels = (values?.labels ?? {}) as Record<string, null | string>;
        const current = toInitialValue(
          fieldSpec,
          values?.[fieldSpec.name],
          labels,
        );
        const initial =
          current === undefined ? fieldSpec.defaultValue : current;

        let schema: z.ZodType;
        if (initial !== undefined) {
          schema = nullable.default(initial);
        } else {
          schema = fieldSpec.required ? nullable : nullable.optional();
        }

        if (EMPTY_MEANS_UNSET.has(fieldSpec.kind)) {
          const unset = fieldSpec.nullable ? null : undefined;
          schema = z.preprocess(
            value => (value === "" ? unset : value),
            schema,
          );
        }

        return [fieldSpec.name, schema];
      }),
    ),
  );
