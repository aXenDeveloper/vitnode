import { z } from "zod";

import type {
  AnyContentTypeDefinition,
  ContentFieldDescriptor,
  ContentFieldKind,
} from "../types";

import {
  getLangValue,
  type MultiLangValue,
  upsertLangValue,
} from "../../lib/helpers/multi-lang";
import {
  contentFileCollectionMax,
  contentFileCollectionMin,
  contentRepeatableMax,
  contentRepeatableMin,
} from "../advanced";
import { contentFieldPath, contentInnerFields } from "../paths";
import { humanizeFieldName } from "./labels";

export interface ContentFormFieldSpec {
  allowedExtensions?: string[];
  /** `file` fields only: the media types the field accepts, lowercased. */
  allowedMimeTypes?: string[];
  defaultValue?: boolean | null | number | string;
  description?: string;
  display?: "radio" | "select";

  fields?: ContentFormFieldSpec[];
  integer?: boolean;
  kind: ContentFieldKind;
  label: string;

  localized?: boolean;
  max?: number;
  /** `file` fields only: the largest upload the field accepts, in bytes. */
  maxBytes?: number;
  /** Upper bound on a repeatable's rows. */
  maxItems?: number;
  maxLength?: number;
  min?: number;
  /** Lower bound on a repeatable's rows. */
  minItems?: number;
  minLength?: number;

  multiple?: boolean;
  name: string;
  nullable: boolean;
  /** Enum choices, already translated. */
  options?: { label: string; value: string }[];
  /**
   * Whether a to-many field's order is the author's to choose - and therefore
   * whether the list renders reorder controls.
   */
  ordered?: boolean;
  required: boolean;

  targetContentTypeId?: string;
}

export interface ContentFormSectionSpec {
  desc?: string;
  /** Field names, in order. Each one appears in exactly one section. */
  fields: string[];
  name: string;
  title: string;
}

export interface ContentFormSpec {
  contentTypeId: string;

  defaultLocale: null | string;
  fields: ContentFormFieldSpec[];

  permissionModule: string;
  pluginId: string;

  sections: ContentFormSectionSpec[];
  /** Field the toast describes a newly created row by, if there is one. */
  titleField: null | string;
}

export interface ContentColumnSpec {
  kind: "publication" | "system" | ContentFieldKind;
  label: string;

  localized?: boolean;
  name: string;
  /** Enum value -> translated label, for badge cells. */
  options?: Record<string, string>;
}

export type ContentFieldLabeller = (
  name: string,
  fieldValue?: ContentFieldDescriptor,
) => string;

export type ContentEnumLabeller = (name: string, value: string) => string;

export type ContentSectionLabeller = (name: string) => {
  desc?: string;
  title: string;
};

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
    ...(fieldValue.localized === true ? { localized: true } : {}),
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
    case "file":
      return {
        ...base,
        ...(fieldValue.allowedExtensions
          ? { allowedExtensions: fieldValue.allowedExtensions }
          : {}),
        ...(fieldValue.allowedMimeTypes
          ? { allowedMimeTypes: fieldValue.allowedMimeTypes }
          : {}),
        maxBytes: fieldValue.maxBytes,
        multiple: fieldValue.multiple,
        ordered: fieldValue.ordered,
        // `minItems` / `maxItems` are the same two keys a repeatable uses, so the
        // form schema has one rule for "how many of these are allowed" rather
        // than a third spelling of it. Only for a collection: one file has no
        // count, and `resolveContentAdvanced` refuses `min`/`max` without
        // `multiple: true`.
        ...(fieldValue.multiple
          ? {
              maxItems: contentFileCollectionMax(fieldValue),
              minItems: contentFileCollectionMin(fieldValue),
            }
          : {}),
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
    // Both reference kinds carry the same two flags, because the form makes the
    // same two decisions from them: one picker or a list of them, and whether
    // that list has reorder controls.
    case "relation":
    case "user":
      return {
        ...base,
        // `minItems` is the same key a repeatable uses, so the form schema has
        // one rule for "how few of these are allowed" rather than two.
        ...(fieldValue.min === undefined ? {} : { minItems: fieldValue.min }),
        multiple: fieldValue.multiple,
        ordered: fieldValue.ordered,
        // The thunk is resolved here rather than carried: a spec crosses into a
        // client component, and a function cannot. Calling it is what
        // `resolveReferenceTargets` already does per request, so a circular
        // reference is as safe here as it is there.
        ...(fieldValue.kind === "relation"
          ? { targetContentTypeId: fieldValue.target().id }
          : {}),
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
  labelSection,
  pluginId,
}: {
  definition: AnyContentTypeDefinition;
  labelEnum: ContentEnumLabeller;
  labelField: ContentFieldLabeller;
  /** Optional so a caller that only needs fields - a test, a preview - can skip it. */
  labelSection?: ContentSectionLabeller;
  pluginId: string;
}): ContentFormSpec => {
  const fields = definition.fields;

  return {
    contentTypeId: definition.id,
    defaultLocale: definition.localization.enabled
      ? definition.localization.defaultLocale
      : null,
    permissionModule: definition.permissionModule,
    pluginId,
    titleField: definition.admin.titleField,
    // One form, shared and localized fields alike, in the order they were
    // declared. Where a value is *stored* is settled by `spec.localized` on the
    // way back out - it is not a reason to split the screen in two.
    fields: definition.admin.form.fields.map(name =>
      projectFormField(name, fields[name], labelEnum, labelField),
    ),
    sections: definition.admin.form.sections.map(section => {
      // Humanised from the name when nothing translates it, which is the same
      // fallback a field label gets - a form is readable before it is localized.
      const labels = labelSection?.(section.name) ?? {
        title: humanizeFieldName(section.name),
      };

      return {
        fields: section.fields,
        name: section.name,
        title: labels.title,
        ...(labels.desc === undefined ? {} : { desc: labels.desc }),
      };
    }),
  };
};

/** The localized field names of a form spec, in declaration order. */
export const contentLocalizedFieldNames = (spec: ContentFormSpec): string[] =>
  spec.fields
    .filter(field => field.localized === true)
    .map(field => field.name);

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
      ...(fieldValue?.localized === true ? { localized: true } : {}),
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

export const isCollectionFieldSpec = (field: ContentFormFieldSpec): boolean =>
  field.kind === "repeatable" || field.multiple === true;

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

const referenceSetSchema = (spec: ContentFormFieldSpec): z.ZodType => {
  const schema = z.array(z.number());

  return spec.minItems === undefined ? schema : schema.min(spec.minItems);
};

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
    // What the form holds for a file is the `core_files.id` the API takes, which
    // is also what the mutation sends: the upload happens through its own
    // multipart route and hands the identifier back, so nothing binary is ever
    // part of this schema or of the JSON body built from it. A gallery holds the
    // list of them, in the order the editor arranged.
    case "file":
      if (spec.multiple) {
        return z
          .array(z.number().int().positive())
          .min(spec.minItems ?? 0)
          .max(spec.maxItems ?? Number.MAX_SAFE_INTEGER);
      }

      return z.number().int().positive();
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
      if (spec.multiple) return referenceSetSchema(spec);

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
      // A to-many people field holds identifiers, exactly as a to-many relation
      // does: the set picker renders the names it fetched and stores what the
      // API takes.
      if (spec.multiple) return referenceSetSchema(spec);

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
  // A to-many reference already holds what the API takes and what the set
  // picker renders - a list of identifiers - and the names behind them are
  // resolved by the picker itself rather than carried on the row.
  if (fieldSpec.multiple === true) return current;
  if (current === null || current === undefined) return undefined;

  const id = typeof current === "number" ? current.toString() : "";

  return { label: labels[fieldSpec.name] ?? id, value: id };
};

export const contentTitleFromValues = (
  spec: ContentFormSpec,
  values: Record<string, unknown>,
  locale?: string,
): string | undefined => {
  if (spec.titleField === null) return undefined;

  const raw = values[spec.titleField];
  const value = Array.isArray(raw)
    ? getLangValue(raw as MultiLangValue, locale ?? spec.defaultLocale ?? "")
    : raw;

  return typeof value === "string" && value.trim() !== "" ? value : undefined;
};

export const contentFormValuesToPayload = (
  spec: ContentFormSpec,
  values: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(values)
      .filter(([name]) => !isLocalizedFieldName(spec, name))
      .map(([name, value]) => {
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

const isLocalizedFieldName = (spec: ContentFormSpec, name: string): boolean =>
  spec.fields.some(field => field.name === name && field.localized === true);

const localizedValueForApi = (
  fieldSpec: ContentFormFieldSpec,
  raw: string,
): unknown => {
  if (raw.trim() !== "") return raw;
  // An empty slug means "derive it from the source field in this language".
  if (EMPTY_MEANS_UNSET.has(fieldSpec.kind)) return undefined;
  if (fieldSpec.nullable) return null;

  return undefined;
};

export const contentFormValuesToTranslations = (
  spec: ContentFormSpec,
  values: Record<string, unknown>,
): Record<string, Record<string, unknown>> => {
  const byLocale: Record<string, Record<string, unknown>> = {};

  for (const fieldSpec of spec.fields) {
    if (fieldSpec.localized !== true) continue;

    const entries = values[fieldSpec.name];
    if (!Array.isArray(entries)) continue;

    for (const entry of entries as MultiLangValue) {
      const locale = entry.languageCode;
      if (typeof locale !== "string" || locale === "") continue;

      const value = localizedValueForApi(fieldSpec, entry.value ?? "");
      if (value === undefined) continue;

      byLocale[locale] = { ...byLocale[locale], [fieldSpec.name]: value };
    }
  }

  return byLocale;
};

export const contentFormInitialValues = (
  spec: ContentFormSpec,
  data?: Record<string, unknown>,
  translations: readonly {
    locale: string;
    values: Record<string, unknown>;
  }[] = [],
): Record<string, unknown> | undefined => {
  if (!data && translations.length === 0) return data;

  const initial: Record<string, unknown> = { ...data };

  for (const fieldSpec of spec.fields) {
    if (fieldSpec.localized !== true) continue;

    let value: MultiLangValue = [];
    for (const translation of translations) {
      const stored = translation.values[fieldSpec.name];
      value = upsertLangValue(
        value,
        translation.locale,
        typeof stored === "string" ? stored : "",
      );
    }

    initial[fieldSpec.name] = value;
  }

  return initial;
};

const localizedFieldSchema = (
  fieldSpec: ContentFormFieldSpec,
  defaultLocale: null | string,
  initial: MultiLangValue,
): z.ZodType => {
  // `maxLength` on the item, so the rendered input carries the attribute and the
  // language switcher can read it back through `getMultiLangConstraints`.
  // `minLength` deliberately is not: an empty box would fail it, and an empty box
  // is how "no translation" looks.
  let value = z.string();
  if (fieldSpec.maxLength !== undefined) value = value.max(fieldSpec.maxLength);

  const entries = z.array(z.object({ languageCode: z.string(), value }));

  return entries
    .superRefine((rows, ctx) => {
      for (const row of rows) {
        const text = row.value ?? "";
        if (text.trim() === "") continue;
        if (
          fieldSpec.minLength !== undefined &&
          text.length < fieldSpec.minLength
        ) {
          ctx.addIssue({
            code: "custom",
            message: `${fieldSpec.label} needs at least ${fieldSpec.minLength} characters in "${row.languageCode}".`,
          });
        }
      }

      if (!fieldSpec.required || fieldSpec.nullable || defaultLocale === null) {
        return;
      }

      if (getLangValue(rows, defaultLocale).trim() === "") {
        ctx.addIssue({
          code: "custom",
          message: `${fieldSpec.label} is required in "${defaultLocale}", the language every record is stored in.`,
        });
      }
    })
    .default(initial);
};

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
        // A localized field holds every language at once, so its rules are
        // per-language rather than per-field.
        if (fieldSpec.localized === true) {
          return [
            fieldSpec.name,
            localizedFieldSchema(
              fieldSpec,
              spec.defaultLocale,
              (values?.[fieldSpec.name] as MultiLangValue | undefined) ?? [],
            ),
          ];
        }

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
          current === undefined
            ? // Any to-many field opens on the empty set rather than on nothing -
              // a reference picker, a gallery, all of them. Two reasons, and the
              // second is the load-bearing one: the control renders a list, so
              // `undefined` would make its first render a different shape from
              // every later one; and `min` is enforced on the *form* schema, so a
              // `min: 1` field left as `undefined` would satisfy `.optional()`
              // and let a save through that the API then refuses.
              fieldSpec.multiple === true
              ? []
              : fieldSpec.defaultValue
            : current;

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
