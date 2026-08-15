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
import { contentRepeatableMax, contentRepeatableMin } from "../advanced";
import { contentFieldPath, contentInnerFields } from "../paths";
import { humanizeFieldName } from "./labels";

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
  /**
   * Whether this field's value lives on the translation table.
   *
   * Presentation reads it as "render a language switcher inside this input"; the
   * submit path reads it as "this value goes to the translation rows rather than
   * the base row". Both from one flag, so a plugin never has to declare a field
   * override just because a field is translated.
   */
  localized?: boolean;
  max?: number;
  /** Upper bound on a repeatable's rows. */
  maxItems?: number;
  maxLength?: number;
  min?: number;
  /** Lower bound on a repeatable's rows. */
  minItems?: number;
  minLength?: number;
  /** A reference that holds many targets - or many people - rather than one. */
  multiple?: boolean;
  name: string;
  nullable: boolean;
  /** Enum choices, already translated. */
  options?: { label: string; value: string }[];
  /** Whether a to-many reference's order is the author's to choose. */
  ordered?: boolean;
  required: boolean;
}

/**
 * One titled group of fields, with its heading already translated.
 *
 * Translated here for the same reason an enum's `options` are: the spec crosses
 * into a client component, and the server is where the request's locale and the
 * plugin's messages both are.
 */
export interface ContentFormSectionSpec {
  desc?: string;
  /** Field names, in order. Each one appears in exactly one section. */
  fields: string[];
  name: string;
  title: string;
}

export interface ContentFormSpec {
  contentTypeId: string;
  /**
   * The locale every record must exist in, or `null` when the content type is
   * not localized.
   *
   * Not a display choice - the editor sees their own language first. This is the
   * translation the engine refuses to create a record without, so the form can
   * say which language a required field is still missing in.
   */
  defaultLocale: null | string;
  fields: ContentFormFieldSpec[];
  pluginId: string;
  /**
   * How to group the fields, or empty for one flat form.
   *
   * Empty is the default and the shape every content type written before
   * sections existed keeps: `fields` alone is a complete form.
   */
  sections: ContentFormSectionSpec[];
  /** Field the toast describes a newly created row by, if there is one. */
  titleField: null | string;
}

export interface ContentColumnSpec {
  kind: "publication" | "system" | ContentFieldKind;
  label: string;
  /**
   * Whether the cell reads from the row's translation rather than the row.
   *
   * The list resolves one translation per record - the reader's own language -
   * so a localized cell is an ordinary cell with one more lookup in front of it.
   */
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

/**
 * A to-many reference in the form: the identifiers, and the field's own floor.
 *
 * `minItems` is what makes "at least one category" fail in the *form* rather
 * than only at the API - the submit button stays disabled and the message names
 * the field, instead of a save that comes back 400 with everything still typed.
 */
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
  // A to-many reference already holds what the API takes and what the set
  // picker renders - a list of identifiers - and the names behind them are
  // resolved by the picker itself rather than carried on the row.
  if (fieldSpec.multiple === true) return current;
  if (current === null || current === undefined) return undefined;

  const id = typeof current === "number" ? current.toString() : "";

  return { label: labels[fieldSpec.name] ?? id, value: id };
};

/**
 * The row's own title, for a toast that says what was just written. Falls back
 * to nothing when the content type declares no title field.
 *
 * A localized title is read in `locale` - the language the editor is working in -
 * because that is the copy they just typed and the one they would recognise.
 */
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

/**
 * Turns validated form values into the payload the generated API accepts.
 *
 * Shared fields only. A localized field's value is a per-language array, and it
 * travels to the translation rows through
 * {@link contentFormValuesToTranslations} instead - the split lives here rather
 * than in the form, which is exactly why a layout never has to know about it.
 */
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

/**
 * What one localized field holds for one language, ready for the API.
 *
 * `undefined` means "say nothing about this field in this language", which is a
 * different thing from `null`: a slug left blank is derived from the title, and a
 * language nobody has typed into gets no translation row invented for it.
 */
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

/**
 * The per-language halves of a submitted form, keyed by locale.
 *
 * A locale appears only when the editor actually typed something into it, which
 * is what keeps "I opened the Polish selector to look" from creating an empty
 * Polish translation. Locales already present on the record are handled by the
 * caller, which knows which rows exist.
 */
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

/**
 * Folds a record's translations back into per-field, per-language form values.
 *
 * The one adapter between how localization is *stored* - one row per language,
 * with its own version - and how it is *edited*: a field holding every language
 * it has, so its input can switch between them without the form having a locale
 * of its own.
 */
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

/**
 * One localized field's rules, stated per language.
 *
 * Two rules, and the difference between them is the whole of the localized
 * editing model:
 *
 * - a language somebody **typed into** has to satisfy the field's own length
 *   rules, because it is going to become a translation row;
 * - a language nobody typed into is simply absent. It is not "too short" and it
 *   is not an error - it is a translation that does not exist yet, and the
 *   language selector inside the input is for reading as much as for writing.
 *
 * The exception is the default locale of a required field. The engine will not
 * store a record without its default translation, so the form says which
 * language a value is missing in rather than letting the server refuse a save
 * the editor thought was complete.
 */
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
            ? // A to-many reference opens on the empty set rather than on
              // nothing: the picker renders a list, and `undefined` would make
              // its first render a different shape from every later one.
              isReferenceKind(fieldSpec.kind) && fieldSpec.multiple === true
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
