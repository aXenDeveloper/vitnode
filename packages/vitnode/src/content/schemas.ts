import { z } from "zod";

import type {
  AnyContentTypeDefinition,
  ContentCreateInput,
  ContentFieldDescriptor,
  ContentFieldMap,
  ContentSelect,
  ContentUpdateInput,
  ResolvedContentAdminConfig,
} from "./types";

import {
  CONTENT_PUBLICATION_FIELDS,
  CONTENT_PUBLICATION_STATUSES,
  CONTENT_SYSTEM_FIELDS,
  isFilterableFieldKind,
} from "./const";

export interface ContentSchemas<TDefinition = AnyContentTypeDefinition> {
  /** Request body for create. Rejects unknown keys and system columns. */
  create: z.ZodType<ContentCreateInput<TDefinition>>;
  /**
   * Query-string filters, restricted to filterable fields. Non-strict: it is
   * parsed against the whole query string, so unrecognised keys are ignored.
   */
  filters: z.ZodObject<z.ZodRawShape>;
  /**
   * The create/update shape as `AutoForm` needs it: a plain `ZodObject` with
   * no `z.date()` anywhere, because `AutoForm` runs `z.toJSONSchema` on it and
   * Zod v4 throws on dates.
   */
  form: z.ZodObject<z.ZodRawShape>;
  /** `orderBy` allowlist plus direction. */
  order: z.ZodObject<z.ZodRawShape>;
  /** Path parameters for the detail/update/delete routes. */
  params: z.ZodObject<{ id: z.ZodCoercedNumber }>;
  /** API response shape. */
  select: z.ZodType<ContentSelect<TDefinition>>;
  /**
   * The same shape as `select`, but left as a `ZodObject` so the generated
   * routes can `.extend(...)` it with the joined relation labels.
   */
  selectObject: z.ZodObject<z.ZodRawShape>;
  /** Request body for update. Every field optional, but never empty. */
  update: z.ZodType<ContentUpdateInput<TDefinition>>;
}

const textSchema = (fieldValue: {
  maxLength?: number;
  minLength?: number;
}): z.ZodString => {
  let schema = z.string();
  if (fieldValue.minLength !== undefined) {
    schema = schema.min(fieldValue.minLength);
  }
  if (fieldValue.maxLength !== undefined) {
    schema = schema.max(fieldValue.maxLength);
  }

  return schema;
};

const numberSchema = (fieldValue: {
  integer: boolean;
  max?: number;
  min?: number;
}): z.ZodNumber => {
  let schema = fieldValue.integer ? z.number().int() : z.number();
  if (fieldValue.min !== undefined) schema = schema.min(fieldValue.min);
  if (fieldValue.max !== undefined) schema = schema.max(fieldValue.max);

  return schema;
};

/** Row identifiers are always positive integers, whatever the field kind. */
const referenceSchema = (): z.ZodNumber => z.number().int().positive();

/** The value as it leaves the API. */
const baseSelectSchema = (fieldValue: ContentFieldDescriptor): z.ZodType => {
  switch (fieldValue.kind) {
    case "boolean":
      return z.boolean();
    case "dateTime":
      return z.date();
    case "enum":
      return z.enum(fieldValue.values);
    case "number":
      return numberSchema(fieldValue);
    case "relation":
    case "user":
      return referenceSchema();
    case "text":
    case "textarea":
      return textSchema(fieldValue);
  }
};

/** The value as it arrives from a client. `dateTime` is an ISO 8601 string. */
const baseInputSchema = (fieldValue: ContentFieldDescriptor): z.ZodType => {
  if (fieldValue.kind === "dateTime") return z.iso.datetime();

  return baseSelectSchema(fieldValue);
};

const applyNullable = (
  schema: z.ZodType,
  fieldValue: ContentFieldDescriptor,
): z.ZodType => (fieldValue.nullable ? schema.nullable() : schema);

/**
 * `required` -> present. Otherwise a declared default becomes a Zod default so
 * the value the API writes always matches the column default, and everything
 * else is simply optional.
 */
const applyPresence = (
  schema: z.ZodType,
  fieldValue: ContentFieldDescriptor,
): z.ZodType => {
  if (fieldValue.required) return schema;

  if (
    fieldValue.kind !== "dateTime" &&
    fieldValue.kind !== "relation" &&
    fieldValue.kind !== "user" &&
    fieldValue.defaultValue !== undefined
  ) {
    return schema.default(fieldValue.defaultValue);
  }

  return schema.optional();
};

const inputShape = (
  fields: ContentFieldMap,
  names: readonly string[],
): z.ZodRawShape =>
  Object.fromEntries(
    names.map(name => {
      const fieldValue = fields[name];

      return [
        name,
        applyPresence(
          applyNullable(baseInputSchema(fieldValue), fieldValue),
          fieldValue,
        ),
      ];
    }),
  );

/**
 * Update never applies create defaults: `PUT { title }` must leave `status`,
 * `views` and every other defaulted column alone, not silently reset them to
 * the column default. Every field is simply optional here.
 */
const updateShape = (
  fields: ContentFieldMap,
  names: readonly string[],
): z.ZodRawShape =>
  Object.fromEntries(
    names.map(name => {
      const fieldValue = fields[name];

      return [
        name,
        applyNullable(baseInputSchema(fieldValue), fieldValue).optional(),
      ];
    }),
  );

/**
 * The equality filters a generated list route accepts, keyed by field name.
 *
 * Filters arrive as query-string values, so every entry parses and coerces from
 * a string. Only kinds in `CONTENT_FILTERABLE_FIELD_KINDS` get one - the same
 * list the query builder and `FilterableContentFieldKind` use.
 *
 * A plain (non-strict) object on purpose: the list route hands it the *whole*
 * query string, which also carries `cursor`, `first`, `last`, `order`, `orderBy`
 * and `search`. Those are parsed separately, so this schema ignores every key it
 * does not recognise rather than rejecting it. The upshot is that a query string
 * cannot smuggle an unsupported field into `buildFilterCondition` - it simply
 * never appears in the parsed result. A direct service call can still pass one,
 * which is why the query builder re-checks kind and nullability itself.
 */
const filterShape = (fields: ContentFieldMap): z.ZodRawShape =>
  Object.fromEntries(
    Object.entries(fields)
      .filter(([, fieldValue]) => isFilterableFieldKind(fieldValue.kind))
      .map(([name, fieldValue]) => {
        switch (fieldValue.kind) {
          case "boolean":
            return [name, z.enum(["true", "false"]).optional()];
          case "enum":
            return [name, z.enum(fieldValue.values).optional()];
          case "number":
          case "relation":
          case "user":
            return [name, z.coerce.number().optional()];
          default:
            return [name, z.string().optional()];
        }
      }),
  );

/**
 * Takes only the two pieces it needs rather than a whole definition, so
 * `defineContentType` can call it before the definition object exists and
 * without re-widening its field map.
 */
export const buildContentSchemas = <TDefinition>({
  admin,
  fields,
  publication = false,
}: {
  admin: ResolvedContentAdminConfig;
  fields: ContentFieldMap;
  publication?: boolean;
}): ContentSchemas<TDefinition> => {
  const fieldNames = Object.keys(fields);

  // Read-only on the wire: absent from `create` and `update` (both strict), so
  // the only way to move them is `service.publish` / `service.unpublish`.
  const publicationSelectShape: z.ZodRawShape = publication
    ? {
        publishedAt: z.date().nullable(),
        status: z.enum(CONTENT_PUBLICATION_STATUSES),
      }
    : {};

  const selectShape: z.ZodRawShape = {
    id: z.number(),
    ...Object.fromEntries(
      fieldNames.map(name => [
        name,
        applyNullable(baseSelectSchema(fields[name]), fields[name]),
      ]),
    ),
    ...publicationSelectShape,
    createdAt: z.date(),
    updatedAt: z.date(),
  };

  // `strictObject` blocks mass assignment: an unknown key is an error, not
  // something quietly stripped. System columns are absent from the shape, so
  // they can never be set from a request.
  const create = z.strictObject(inputShape(fields, fieldNames));
  const update = z
    .strictObject(updateShape(fields, fieldNames))
    .refine(value => Object.keys(value).length > 0, {
      message: "Provide at least one field to update.",
    });

  const orderable = [
    ...admin.list.orderableFields,
    ...CONTENT_SYSTEM_FIELDS,
    ...(publication ? CONTENT_PUBLICATION_FIELDS : []),
  ];
  const selectObject = z.object(selectShape);

  return {
    // The shapes are assembled in a loop, so their Zod types are erased.
    // Re-attaching the descriptor-derived types here means every consumer -
    // route handler, service, AdminCP - stays fully typed with no further
    // casts. `buildContentSchemas` is covered by `schemas.test-d.ts`.
    create: create as unknown as z.ZodType<ContentCreateInput<TDefinition>>,
    filters: z.object({
      ...filterShape(fields),
      ...(publication
        ? { status: z.enum(CONTENT_PUBLICATION_STATUSES).optional() }
        : {}),
    }),
    form: z.object(inputShape(fields, admin.form.fields)),
    order: z.object({
      order: z.enum(["asc", "desc"]).optional(),
      orderBy: z.enum(orderable as [string, ...string[]]).optional(),
    }),
    params: z.object({ id: z.coerce.number() }),
    select: selectObject as unknown as z.ZodType<ContentSelect<TDefinition>>,
    selectObject,
    update: update as unknown as z.ZodType<ContentUpdateInput<TDefinition>>,
  };
};
