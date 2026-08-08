import { z } from "zod";

import type {
  AnyContentTypeDefinition,
  ContentFieldDescriptor,
  ContentFieldKind,
} from "../types";

import { contentRepeatableMax, contentRepeatableMin } from "../advanced";
import { partitionContentFields } from "../localization";
import { contentFieldPath, contentInnerFields } from "../paths";

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
  /**
   * The leaves of a `group` or a `repeatable`, in declaration order.
   *
   * Recursive in the type and one level deep in practice: a leaf is always a
   * scalar, which is what lets a group render as a section of ordinary inputs
   * and a repeatable row render as the same section repeated.
   */
  fields?: ContentFormFieldSpec[];
  integer?: boolean;
  kind: ContentFieldKind;
  label: string;
  max?: number;
  /** Upper bound on a repeatable's rows. */
  maxItems?: number;
  maxLength?: number;
  min?: number;
  /** Lower bound on a repeatable's rows. */
  minItems?: number;
  minLength?: number;
  /** A relation that holds many targets rather than one. */
  multiple?: boolean;
  name: string;
  nullable: boolean;
  /** Enum choices, already translated. */
  options?: { label: string; value: string }[];
  /** Whether an ordered relation's order is the author's to choose. */
  ordered?: boolean;
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
  kind: "publication" | "system" | ContentFieldKind;
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

/**
 * Generated columns have no field descriptor to read a kind from, so they are
 * mapped by name. `status` gets its own kind rather than falling into "system",
 * which the cell renderer treats as a date - and `version` is mapped to
 * "number" for the same reason, since it is one.
 */
const systemKinds: Record<string, "number" | "publication" | "system"> = {
  createdAt: "system",
  id: "system",
  publishedAt: "system",
  status: "publication",
  updatedAt: "system",
  version: "number",
};

/** One field descriptor, projected into the serialisable form spec. */
const projectFormField = (
  name: string,
  fieldValue: ContentFieldDescriptor,
  labelEnum: ContentEnumLabeller,
  labelField: ContentFieldLabeller,
): ContentFormFieldSpec => {
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
    case "group":
    case "repeatable":
      return {
        ...base,
        fields: Object.entries(contentInnerFields(fieldValue)).map(
          ([leaf, leafValue]) =>
            projectFormField(
              leaf,
              leafValue,
              labelEnum,
              // A leaf's label is looked up under its canonical path, so an
              // override for `seo.title` is possible without one for every
              // group that happens to have a `title`.
              (leafName, descriptor) =>
                labelField(contentFieldPath(name, leafName), descriptor),
            ),
        ),
        ...(fieldValue.kind === "repeatable"
          ? {
              maxItems: contentRepeatableMax(fieldValue),
              minItems: contentRepeatableMin(fieldValue),
            }
          : {}),
      };
    case "number":
      return {
        ...base,
        defaultValue: fieldValue.defaultValue,
        integer: fieldValue.integer,
        max: fieldValue.max,
        min: fieldValue.min,
      };
    case "relation":
      return {
        ...base,
        multiple: fieldValue.multiple,
        ordered: fieldValue.ordered,
      };
    case "slug":
      // No default and no minimum: an empty slug input means "derive it",
      // and the server is what decides whether that is possible.
      return { ...base, maxLength: fieldValue.maxLength };
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
    // Shared fields only, because that is what `admin.form.fields` resolves to.
    // A localized field's input lives on its locale tab -
    // {@link buildContentTranslationFormSpec} builds that one.
    fields: definition.admin.form.fields.map(name =>
      projectFormField(name, fields[name], labelEnum, labelField),
    ),
  };
};

/**
 * The form spec for **one locale tab**: localized fields only.
 *
 * `null` for a content type that is not localized, so a caller structurally cannot
 * render a locale tab for something with no translations.
 *
 * Built from `partitionContentFields` rather than from `admin.form.fields`, which
 * resolves to shared names only - and in declaration order, so the tab shows title
 * above body for the same reason the shared form shows its fields in the order they
 * were written.
 */
export const buildContentTranslationFormSpec = ({
  definition,
  labelEnum,
  labelField,
  pluginId,
}: {
  definition: AnyContentTypeDefinition;
  labelEnum: ContentEnumLabeller;
  labelField: ContentFieldLabeller;
  pluginId: string;
}): ContentFormSpec | null => {
  if (!definition.localization.enabled) return null;

  const { localizedFields } = partitionContentFields(definition.fields);
  const fields = Object.entries(localizedFields).map(([name, fieldValue]) =>
    projectFormField(name, fieldValue, labelEnum, labelField),
  );

  return {
    contentTypeId: definition.id,
    fields,
    pluginId,
    // The shared `titleField` names a shared field by construction, so it would
    // describe the wrong thing in a locale toast. The first localized `text` field
    // is what a translator is actually looking at.
    titleField: fields.find(field => field.kind === "text")?.name ?? null,
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

/**
 * One group's or repeatable row's leaves, as a nested object schema.
 *
 * Nested rather than flattened into `seo.title` keys: react-hook-form would
 * happily accept the dotted names, but then the value the form holds and the
 * value the API takes would be two different shapes, and the conversion would
 * have to live somewhere. One shape, all the way through.
 */
const leafObjectSchema = (
  spec: ContentFormFieldSpec,
  values?: Record<string, unknown>,
): z.ZodObject<z.ZodRawShape> =>
  z.object(
    Object.fromEntries(
      (spec.fields ?? []).map(leaf => {
        const base = baseFieldSchema(leaf);
        const nullable = leaf.nullable ? base.nullable() : base;
        const current = values?.[leaf.name] ?? leaf.defaultValue;

        return [
          leaf.name,
          current === undefined
            ? leaf.required
              ? nullable
              : nullable.optional()
            : nullable.default(current),
        ];
      }),
    ),
  );

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
    case "group":
      return leafObjectSchema(spec);
    case "number": {
      // A number input hands react-hook-form a string, so the form schema
      // coerces - `z.number()` would reject "0" and disable submit.
      let schema = spec.integer ? z.coerce.number().int() : z.coerce.number();
      if (spec.min !== undefined) schema = schema.min(spec.min);
      if (spec.max !== undefined) schema = schema.max(spec.max);

      return schema;
    }
    case "relation":
      // A to-many relation holds identifiers, not combobox options: the picker
      // renders the labels it fetched and stores what the API takes.
      if (spec.multiple) return z.array(z.number());

      return referenceOptionSchema;
    case "repeatable": {
      // `id` marks a child that already exists; a row without one is new. The
      // client id the editor uses for its React keys never crosses the wire.
      const row = leafObjectSchema(spec).extend({ id: z.number().optional() });

      return z
        .array(row)
        .min(spec.minItems ?? 0)
        .max(spec.maxItems ?? Number.MAX_SAFE_INTEGER);
    }
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
 *
 * A slug is here for a second reason: an empty box means "derive it from the
 * source field", and sending `""` would ask the server to store nothing.
 */
const EMPTY_MEANS_UNSET: ReadonlySet<ContentFieldKind> = new Set([
  "dateTime",
  "slug",
]);

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
      // A group and a repeatable already hold the shape the API takes - the
      // editors control the nested value directly - and a to-many relation
      // already holds identifiers. Only the single-relation combobox, which
      // holds `{ label, value }` so it can show a name, needs converting.
      if (
        !fieldSpec ||
        fieldSpec.multiple === true ||
        !isReferenceKind(fieldSpec.kind)
      ) {
        return [name, value];
      }

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
        // A group builds its leaf defaults from the value it is editing, which
        // a shared `baseFieldSchema` cannot see.
        if (fieldSpec.kind === "group") {
          const current = values?.[fieldSpec.name] as
            null | Record<string, unknown> | undefined;
          const object = leafObjectSchema(fieldSpec, current ?? undefined);
          const nullable: z.ZodType = fieldSpec.nullable
            ? object.nullable()
            : object;

          return [
            fieldSpec.name,
            // `seo: null` is a real state a nullable group can be in, and the
            // editor has to open on it rather than on an empty object.
            current === null ? nullable.default(null) : nullable.optional(),
          ];
        }

        const base =
          isReferenceKind(fieldSpec.kind) &&
          !fieldSpec.multiple &&
          fieldSpec.required
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
