import { z } from "zod";

import type {
  AnyContentTypeDefinition,
  ContentCreateInput,
  ContentFieldDescriptor,
  ContentFieldMap,
  ContentLocalizedUpdateValues,
  ContentLocalizedValues,
  ContentPublicSelect,
  ContentSelect,
  ContentUpdateInput,
  ResolvedContentAdminConfig,
  ResolvedContentAdvancedConfig,
  ResolvedContentLocalizationConfig,
  ResolvedContentPublicApiConfig,
} from "./types";

import {
  contentAdvancedDisabled,
  contentRepeatableMax,
  contentRepeatableMin,
} from "./advanced";
import {
  CONTENT_EDITORIAL_FIELDS,
  CONTENT_LOCALE_MAX_LENGTH,
  CONTENT_PUBLIC_ALWAYS_ORDERABLE,
  CONTENT_PUBLICATION_FIELDS,
  CONTENT_PUBLICATION_STATUSES,
  CONTENT_RELATION_COLLECTION_MAX,
  CONTENT_SLUG_DEFAULT_LENGTH,
  CONTENT_SYSTEM_FIELDS,
  isFilterableFieldKind,
} from "./const";
import {
  contentLocalizationDisabled,
  partitionContentFields,
} from "./localization";
import {
  contentInnerFields,
  isContentReferenceCollection,
  splitContentFieldPath,
} from "./paths";

/** What a content type without `publicApi` carries: nothing exposed at all. */
const DISABLED_PUBLIC_API: ResolvedContentPublicApiConfig = {
  defaultOrder: "desc",
  defaultOrderBy: CONTENT_PUBLIC_ALWAYS_ORDERABLE,
  enabled: false,
  fields: [],
  filterableFields: [],
  orderableFields: [],
  path: "",
  searchableFields: [],
  slugField: "",
};

/**
 * The schemas one translation row is written and read through.
 *
 * Content values live under `values`, and everything else - the locale, the
 * expected version - is transport that sits *beside* them. That split is what
 * lets `values` stay a strict object of the content type's own localized fields:
 * an `expectedVersion` key inside it would be indistinguishable from a field
 * somebody is trying to mass-assign.
 */
export interface ContentTranslationSchemas<
  TDefinition = AnyContentTypeDefinition,
> {
  /** Localized values for a new translation. Strict; requiredness per field. */
  create: z.ZodType<ContentLocalizedValues<TDefinition>>;
  /** `{ values }` - the create request body. */
  createEnvelope: z.ZodType<{ values: ContentLocalizedValues<TDefinition> }>;
  /** The same shape as a plain `ZodObject`, so routes can compose it. */
  createObject: z.ZodObject<z.ZodRawShape>;
  /**
   * The form shape for one locale: a plain `ZodObject` with no `z.date()`, so
   * `AutoForm` can run `z.toJSONSchema` on it. Stage 5B renders it.
   */
  form: z.ZodObject<z.ZodRawShape>;
  /** Path parameters for a translation route: the item, then the locale. */
  params: z.ZodObject<{ id: z.ZodCoercedNumber; locale: z.ZodString }>;
  /** One translation as it comes back: metadata plus `values`. */
  select: z.ZodObject<z.ZodRawShape>;
  /** One translation without its values - what the list route returns. */
  selectMeta: z.ZodObject<z.ZodRawShape>;
  /** Localized values for an existing translation. Every key optional, never empty. */
  update: z.ZodType<ContentLocalizedUpdateValues<TDefinition>>;
  /** `{ expectedVersion, values }` - the update and delete request body. */
  updateEnvelope: z.ZodType<{
    expectedVersion: number;
    values: ContentLocalizedUpdateValues<TDefinition>;
  }>;
  /** `{ expectedVersion }` - the delete request body. */
  versionEnvelope: z.ZodType<{ expectedVersion: number }>;
}

export interface ContentSchemas<TDefinition = AnyContentTypeDefinition> {
  /**
   * The advanced collections of one record: a `number[]` per to-many relation
   * and an array of identified children per repeatable.
   *
   * An empty object for a content type that declares neither, which is what
   * lets a generated route compose it unconditionally and still produce exactly
   * the response schema it produced in Stage 5.
   */
  advancedSelect: z.ZodObject<z.ZodRawShape>;
  /**
   * Request body for create. Rejects unknown keys and system columns.
   *
   * Shared fields only. A localized content type's localized values arrive
   * through `translation.create` instead, in the same transaction - see
   * `localizedService.create`.
   */
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
  /**
   * Equality filters the public list route accepts, one per
   * `publicApi.filterableFields`. Empty when public exposure is off.
   */
  publicFilters: z.ZodObject<z.ZodRawShape>;
  /** `orderBy` allowlist for the public list route, plus direction. */
  publicOrder: z.ZodObject<z.ZodRawShape>;
  /** Path parameters for the public detail route. */
  publicParams: z.ZodObject<{ slug: z.ZodString }>;
  /** The public response projection - exactly `publicApi.fields`. */
  publicSelect: z.ZodType<ContentPublicSelect<TDefinition>>;
  /** The same shape, left as a `ZodObject` so routes can compose it. */
  publicSelectObject: z.ZodObject<z.ZodRawShape>;
  /** API response shape. */
  select: z.ZodType<ContentSelect<TDefinition>>;
  /**
   * The same shape as `select`, but left as a `ZodObject` so the generated
   * routes can `.extend(...)` it with the joined relation labels.
   */
  selectObject: z.ZodObject<z.ZodRawShape>;
  /**
   * The per-language schemas, or `null` when the content type is not localized.
   *
   * `null` rather than empty schemas, matching how `model.publicService` is
   * `undefined` without a public API: a nullable value reads naturally in code
   * that does not know which content type it was handed, and it cannot be used
   * by accident.
   */
  translation: ContentTranslationSchemas<TDefinition> | null;
  /** Request body for update. Every field optional, but never empty. */
  update: z.ZodType<ContentUpdateInput<TDefinition>>;
  /**
   * Request body for an editorial update: the field values, plus the version
   * the editor started from.
   *
   * An envelope rather than a key inside `values`, because `update` is a strict
   * object of *content fields* and `expectedVersion` is transport. Empty for a
   * content type without `editorial`, whose update body stays exactly as it was.
   */
  updateEnvelope: z.ZodType<{
    expectedVersion: number;
    values: ContentUpdateInput<TDefinition>;
  }>;
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
    case "group": {
      const inner = contentInnerFields(fieldValue);

      return z.object(
        Object.fromEntries(
          Object.entries(inner).map(([leaf, leafValue]) => [
            leaf,
            applyNullable(baseSelectSchema(leafValue), leafValue),
          ]),
        ),
      );
    }
    case "number":
      return numberSchema(fieldValue);
    case "relation":
      return fieldValue.multiple
        ? z.array(referenceSchema())
        : referenceSchema();
    case "repeatable": {
      const inner = contentInnerFields(fieldValue);

      return z.array(
        z.object({
          id: referenceSchema(),
          ...Object.fromEntries(
            Object.entries(inner).map(([leaf, leafValue]) => [
              leaf,
              applyNullable(baseSelectSchema(leafValue), leafValue),
            ]),
          ),
        }),
      );
    }
    case "slug":
      // Never empty: the service normalises before writing, and a value that
      // folds to nothing is rejected rather than stored.
      return textSchema({
        maxLength: fieldValue.maxLength ?? CONTENT_SLUG_DEFAULT_LENGTH,
        minLength: 1,
      });
    case "text":
    case "textarea":
      return textSchema(fieldValue);
    case "user":
      return fieldValue.multiple
        ? z.array(referenceSchema())
        : referenceSchema();
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
    fieldValue.kind !== "group" &&
    fieldValue.kind !== "relation" &&
    fieldValue.kind !== "repeatable" &&
    fieldValue.kind !== "slug" &&
    fieldValue.kind !== "user" &&
    fieldValue.defaultValue !== undefined
  ) {
    return schema.default(fieldValue.defaultValue);
  }

  return schema.optional();
};

/**
 * The set of target identifiers a to-many relation accepts.
 *
 * Positive integers, distinct, and bounded. Distinctness is enforced here rather
 * than deduplicated silently: `[2, 2, 5]` is a caller that thinks it is setting
 * three categories, and quietly storing two would be the kind of "helpful"
 * behaviour that hides a bug in the caller's own list handling.
 */
/**
 * A set of references, with the field's own bounds on it.
 *
 * `min` is how a content type says "at least one" about something the *storage*
 * cannot say it about: a to-many reference is never `required`, because the
 * empty set is a legitimate value for a column that does not exist. A blog
 * article that must be filed under a category is a rule about the article rather
 * than about the junction table, so it is enforced here - in the generated
 * schema, which the API and the AdminCP form both go through - rather than by a
 * check somewhere one of the two would eventually skip.
 */
const relationSetSchema = (fieldValue: ContentFieldDescriptor): z.ZodType => {
  const min = (fieldValue as { min?: number }).min;
  let schema = z.array(referenceSchema()).max(CONTENT_RELATION_COLLECTION_MAX);
  if (min !== undefined) schema = schema.min(min);

  return schema.refine(value => new Set(value).size === value.length, {
    message: "Relation targets must be distinct.",
  });
};

/**
 * One repeatable child, as it is written.
 *
 * `id` is optional and is the whole protocol: present means "this is the
 * existing child with that identifier", absent means "create a new one". There
 * is no `position` - the array order is the order, so a payload cannot describe
 * two rows in the same slot.
 */
const repeatableRowSchema = (fieldValue: ContentFieldDescriptor): z.ZodType => {
  const inner = contentInnerFields(fieldValue);
  const names = Object.keys(inner);

  return z.strictObject({
    id: referenceSchema().optional(),
    ...leafInputShape(inner, names),
  });
};

const repeatableSchema = (fieldValue: ContentFieldDescriptor): z.ZodType =>
  z
    .array(repeatableRowSchema(fieldValue))
    .min(contentRepeatableMin(fieldValue))
    .max(contentRepeatableMax(fieldValue));

/** The leaf half of {@link inputShape}, with no advanced kind to consider. */
const leafInputShape = (
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
 * A group, as it is written on create: a nested object of its leaves.
 *
 * Strict, like every other content object in this file: an unknown key inside
 * `seo` is a typo the author wants to hear about, not something to drop. The
 * four presence states a group can be in - absent, `null`, present-and-complete,
 * present-with-a-required-leaf-missing - fall straight out of `.nullable()`,
 * `.optional()` and the leaves' own requiredness, with no fifth code path.
 */
const groupInputSchema = (fieldValue: ContentFieldDescriptor): z.ZodType => {
  const inner = contentInnerFields(fieldValue);
  const object = z.strictObject(leafInputShape(inner, Object.keys(inner)));

  return applyPresence(applyNullable(object, fieldValue), fieldValue);
};

/**
 * A group, as it is written on update: every leaf optional.
 *
 * This is what makes `{ seo: { description } }` a one-leaf change rather than a
 * request to blank `seo.title`. `.refine` keeps the object from being empty, so
 * `{ seo: {} }` is a mistake rather than a silent no-op that still counts as a
 * write.
 */
const groupPatchSchema = (fieldValue: ContentFieldDescriptor): z.ZodType => {
  const inner = contentInnerFields(fieldValue);
  const names = Object.keys(inner);
  const object = z
    .strictObject(
      Object.fromEntries(
        names.map(name => [
          name,
          applyNullable(baseInputSchema(inner[name]), inner[name]).optional(),
        ]),
      ),
    )
    .refine(value => Object.keys(value).length > 0, {
      message: "Provide at least one leaf to update, or send null.",
    });

  return applyNullable(object, fieldValue).optional();
};

const inputShape = (
  fields: ContentFieldMap,
  names: readonly string[],
): z.ZodRawShape =>
  Object.fromEntries(
    names.map(name => {
      const fieldValue = fields[name];

      if (fieldValue.kind === "group") {
        return [name, groupInputSchema(fieldValue)];
      }
      if (fieldValue.kind === "repeatable") {
        // Defaulted rather than optional: a create that says nothing about
        // `faq` means "no entries", and the empty array is what that is.
        return [name, repeatableSchema(fieldValue).default([])];
      }
      if (isContentReferenceCollection(fieldValue)) {
        return [name, relationSetSchema(fieldValue).default([])];
      }

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

      if (fieldValue.kind === "group") {
        return [name, groupPatchSchema(fieldValue)];
      }
      if (fieldValue.kind === "repeatable") {
        return [name, repeatableSchema(fieldValue).optional()];
      }
      if (isContentReferenceCollection(fieldValue)) {
        return [name, relationSetSchema(fieldValue).optional()];
      }

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
            return [name, z.coerce.number().optional()];
          case "relation":
          case "user":
            // A to-many reference filters by membership, and it arrives from a
            // query string as one identifier: `?categories=7`. The transform is
            // what turns it into the `{ contains }` object the query builder
            // branches on, so the wire format stays as flat as every other
            // filter while the service still sees a shape it cannot confuse
            // with an equality.
            return fieldValue.multiple
              ? [
                  name,
                  z.coerce
                    .number()
                    .optional()
                    .transform(value =>
                      value === undefined ? undefined : { contains: value },
                    ),
                ]
              : [name, z.coerce.number().optional()];
          default:
            return [name, z.string().optional()];
        }
      }),
  );

/**
 * An exposed relation comes back as an identifier, and nothing else.
 *
 * No label: the only one available is the target's `admin.titleField`, which is
 * administrative metadata and may name a field the target never publishes. See
 * `ContentPublicRelation` for the reasoning.
 */
const publicRelationSchema = (): z.ZodObject<z.ZodRawShape> =>
  z.object({ id: z.number() });

/**
 * The public response shape, built from the allowlist and nothing else.
 *
 * This is also what the public service's `SELECT` map is derived from, so a
 * field missing here is a field that never leaves Postgres - not one that is
 * fetched and then deleted.
 *
 * Takes **every** declared field, shared and localized alike: a public localized
 * response is one base row joined to one translation, so where a value is stored
 * is a fact about the query rather than about the response.
 */
/**
 * Groups an allowlist's leaf paths by the container they belong to.
 *
 * `["title", "seo.title", "seo.description"]` becomes `{ seo: ["title",
 * "description"] }` and leaves `"title"` to the flat pass. Order within a
 * container follows the allowlist, so the generated response shape is as
 * deterministic as everything else the engine emits.
 */
export const groupPublicLeafPaths = (
  names: readonly string[],
): Map<string, string[]> => {
  const owners = new Map<string, string[]>();

  for (const name of names) {
    const path = splitContentFieldPath(name);
    if (!path) continue;

    const [owner, leaf] = path;
    const leaves = owners.get(owner);
    if (leaves) {
      leaves.push(leaf);
      continue;
    }
    owners.set(owner, [leaf]);
  }

  return owners;
};

/**
 * One exposed container - a group or a repeatable - carrying **only** the leaves
 * the allowlist named.
 *
 * This is where leaf-level privacy is actually implemented: `seo.indexable` is
 * absent from the shape, and therefore absent from the `SELECT` the shape drives,
 * however many other `seo.*` paths are public.
 */
const publicContainerSchema = (
  fieldValue: ContentFieldDescriptor,
  leaves: readonly string[],
): z.ZodType => {
  const inner = contentInnerFields(fieldValue);
  const shape = Object.fromEntries(
    leaves.map(leaf => [
      leaf,
      applyNullable(baseSelectSchema(inner[leaf]), inner[leaf]),
    ]),
  );

  if (fieldValue.kind === "repeatable") {
    return z.array(z.object({ id: z.number(), ...shape }));
  }

  return applyNullable(z.object(shape), fieldValue);
};

const publicSelectShape = (
  fields: ContentFieldMap,
  publicApi: ResolvedContentPublicApiConfig,
  localization: ResolvedContentLocalizationConfig,
): z.ZodRawShape => ({
  // The language actually served, which with a fallback is not always the one
  // that was asked for. `defineContentType` reserves the name on a localized
  // content type, so this cannot shadow a declared field.
  ...(localization.enabled ? { locale: z.string() } : {}),
  ...Object.fromEntries(
    publicApi.fields
      .filter(name => splitContentFieldPath(name) === null)
      .map(name => {
        if (name === "id") return [name, z.number()];
        if (name === "createdAt" || name === "updatedAt") {
          return [name, z.date()];
        }
        if (name === "publishedAt") return [name, z.date().nullable()];

        const fieldValue = fields[name];
        if (fieldValue.kind === "relation") {
          // A to-many relation is a list of identifiers rather than a list of
          // `{ id }` objects: the single-relation wrapper exists so a `null`
          // relation is distinguishable from a missing key, and an empty array
          // already says that on its own.
          if (fieldValue.multiple) return [name, z.array(z.number())];

          const relation = publicRelationSchema();

          return [name, fieldValue.nullable ? relation.nullable() : relation];
        }

        return [name, applyNullable(baseSelectSchema(fieldValue), fieldValue)];
      }),
  ),
  ...Object.fromEntries(
    [...groupPublicLeafPaths(publicApi.fields)].map(([owner, leaves]) => [
      owner,
      publicContainerSchema(fields[owner], leaves),
    ]),
  ),
});

/**
 * Takes only the pieces it needs rather than a whole definition, so
 * `defineContentType` can call it before the definition object exists and
 * without re-widening its field map.
 */
/**
 * The translation schemas for one content type, or `null` when it has none.
 *
 * Localized fields only, and never a metadata key: `itemId` and `languageId`
 * identify the row rather than describing it, and `version` is assigned by the
 * conditional `UPDATE` that guards on it. All three are absent from the strict
 * `values` object, which is what stops any of them being mass-assigned.
 */
const buildTranslationSchemas = <TDefinition>({
  admin,
  localizedFields,
  localization,
  publication,
}: {
  admin: ResolvedContentAdminConfig;
  localization: ResolvedContentLocalizationConfig;
  localizedFields: ContentFieldMap;
  publication: boolean;
}): ContentTranslationSchemas<TDefinition> | null => {
  if (!localization.enabled) return null;

  const names = Object.keys(localizedFields);

  const create = z.strictObject(inputShape(localizedFields, names));
  const update = z
    .strictObject(updateShape(localizedFields, names))
    .refine(value => Object.keys(value).length > 0, {
      message: "Provide at least one localized field to update.",
    });

  const expectedVersion = z.number().int().positive();
  // Read-only on the wire, exactly like the base row's pair: absent from
  // `create` and `update` (both strict), so the only way to move them is
  // `publish` / `unpublish`.
  const selectMeta = z.object({
    createdAt: z.date(),
    itemId: z.number().int().positive(),
    languageId: z.number().int().positive(),
    locale: z.string(),
    ...(publication
      ? {
          publishedAt: z.date().nullable(),
          status: z.enum(CONTENT_PUBLICATION_STATUSES),
        }
      : {}),
    updatedAt: z.date(),
    version: expectedVersion,
  });

  const values = z.object(
    Object.fromEntries(
      names.map(name => [
        name,
        applyNullable(
          baseSelectSchema(localizedFields[name]),
          localizedFields[name],
        ),
      ]),
    ),
  );

  return {
    create: create as unknown as z.ZodType<ContentLocalizedValues<TDefinition>>,
    createEnvelope: z.strictObject({ values: create }) as unknown as z.ZodType<{
      values: ContentLocalizedValues<TDefinition>;
    }>,
    createObject: create,
    // The declared form fields, narrowed to the localized ones: a locale tab
    // edits one language's values and nothing else.
    form: z.object(
      inputShape(
        localizedFields,
        admin.form.fields.filter(name => localizedFields[name] !== undefined),
      ),
    ),
    params: z.object({
      id: z.coerce.number(),
      // Loose on purpose, like `publicParams.slug`: an unknown locale and a
      // malformed one are both answered the same way, and the value is a bound
      // parameter rather than an identifier.
      locale: z.string().min(1).max(CONTENT_LOCALE_MAX_LENGTH),
    }),
    select: selectMeta.extend({ values }),
    selectMeta,
    update: update as unknown as z.ZodType<
      ContentLocalizedUpdateValues<TDefinition>
    >,
    updateEnvelope: z.strictObject({
      // Positive, so a client that forgot to send one cannot coerce `0` past the
      // guard and race the very check it is meant to lose.
      expectedVersion,
      values: update,
    }) as unknown as z.ZodType<{
      expectedVersion: number;
      values: ContentLocalizedUpdateValues<TDefinition>;
    }>,
    versionEnvelope: z.strictObject({ expectedVersion }),
  };
};

export const buildContentSchemas = <TDefinition>({
  admin,
  advanced = contentAdvancedDisabled(),
  editorial = false,
  fields,
  localization = contentLocalizationDisabled(),
  publicApi = DISABLED_PUBLIC_API,
  publication = false,
}: {
  admin: ResolvedContentAdminConfig;
  advanced?: ResolvedContentAdvancedConfig;
  editorial?: boolean;
  /** Every declared field. Partitioned here, so no caller has to. */
  fields: ContentFieldMap;
  localization?: ResolvedContentLocalizationConfig;
  publicApi?: ResolvedContentPublicApiConfig;
  publication?: boolean;
}): ContentSchemas<TDefinition> => {
  // Everything below this line is about the base table, so it reads the shared
  // half only. The localized half gets its own schemas at the bottom.
  const { collectionFields, localizedFields, sharedFields } =
    partitionContentFields(fields);
  // A to-many relation and a repeatable are shared values that are not columns.
  // They belong in every schema that describes what a caller may *write* - and
  // in none of the ones that describe a row.
  const writableFields: ContentFieldMap = {
    ...sharedFields,
    ...collectionFields,
  };
  const writableNames = Object.keys(writableFields);
  const fieldNames = Object.keys(sharedFields);

  // Read-only on the wire: absent from `create` and `update` (both strict), so
  // the only way to move them is `service.publish` / `service.unpublish`.
  const publicationSelectShape: z.ZodRawShape = publication
    ? {
        publishedAt: z.date().nullable(),
        status: z.enum(CONTENT_PUBLICATION_STATUSES),
      }
    : {};

  // Read-only for the same reason, and returned for one: a client needs it to
  // send `expectedVersion` back on the next write.
  const editorialSelectShape: z.ZodRawShape = editorial
    ? { version: z.number().int().positive() }
    : {};

  const selectShape: z.ZodRawShape = {
    id: z.number(),
    ...Object.fromEntries(
      fieldNames.map(name => [
        name,
        applyNullable(baseSelectSchema(sharedFields[name]), sharedFields[name]),
      ]),
    ),
    ...publicationSelectShape,
    ...editorialSelectShape,
    createdAt: z.date(),
    updatedAt: z.date(),
  };

  // `strictObject` blocks mass assignment: an unknown key is an error, not
  // something quietly stripped. System columns are absent from the shape, so
  // they can never be set from a request.
  const create = z.strictObject(inputShape(writableFields, writableNames));
  const update = z
    .strictObject(updateShape(writableFields, writableNames))
    .refine(value => Object.keys(value).length > 0, {
      message: "Provide at least one field to update.",
    });

  const orderable = [
    ...admin.list.orderableFields,
    ...CONTENT_SYSTEM_FIELDS,
    ...(publication ? CONTENT_PUBLICATION_FIELDS : []),
    ...(editorial ? CONTENT_EDITORIAL_FIELDS : []),
  ];
  const selectObject = z.object(selectShape);

  const publicSelectObject = z.object(
    publicSelectShape(fields, publicApi, localization),
  );
  const publicFilterable = new Set(publicApi.filterableFields);
  // Derived from the same `filterShape`, then narrowed to the configured
  // allowlist - so a public filter can never reach a field the admin filter
  // schema would not have accepted either.
  //
  // Over **every** field rather than the shared half: a localized field can be
  // filtered on publicly, because the localized public service evaluates that
  // filter against the one translation the reader is actually being served. The
  // admin filter schema below stays shared-only, since an admin list is a query
  // over the base table.
  const publicFilters = z.object(
    Object.fromEntries(
      Object.entries(filterShape(fields)).filter(([name]) =>
        publicFilterable.has(name),
      ),
    ),
  );

  return {
    // Keyed by the generated tables rather than by the field map, so a
    // collection that has no table cannot appear here and a table that has no
    // schema cannot be read - the two lists are resolved from the same place.
    advancedSelect: z.object(
      Object.fromEntries(
        [
          ...advanced.junctions.map(entry => entry.field),
          ...advanced.repeatables.map(entry => entry.field),
        ].map(name => [name, baseSelectSchema(collectionFields[name])]),
      ),
    ),
    // The shapes are assembled in a loop, so their Zod types are erased.
    // Re-attaching the descriptor-derived types here means every consumer -
    // route handler, service, AdminCP - stays fully typed with no further
    // casts. `buildContentSchemas` is covered by `schemas.test-d.ts`.
    create: create as unknown as z.ZodType<ContentCreateInput<TDefinition>>,
    filters: z.object({
      ...filterShape(writableFields),
      ...(publication
        ? { status: z.enum(CONTENT_PUBLICATION_STATUSES).optional() }
        : {}),
    }),
    // The declared form fields, narrowed to the ones this schema describes. A
    // localized name is not dropped by accident: `admin.form.fields` covers one
    // form, and this half of it is the base row - the translation schemas below
    // build the other half from the same list.
    form: z.object(
      inputShape(
        writableFields,
        admin.form.fields.filter(name => writableFields[name] !== undefined),
      ),
    ),
    order: z.object({
      order: z.enum(["asc", "desc"]).optional(),
      orderBy: z.enum(orderable as [string, ...string[]]).optional(),
    }),
    params: z.object({ id: z.coerce.number() }),
    publicFilters,
    publicOrder: z.object({
      order: z.enum(["asc", "desc"]).optional(),
      orderBy: z
        .enum(
          (publicApi.orderableFields.length > 0
            ? publicApi.orderableFields
            : [CONTENT_PUBLIC_ALWAYS_ORDERABLE]) as [string, ...string[]],
        )
        .optional(),
    }),
    // Loose on purpose: an unknown slug and a malformed one are both a 404, so
    // there is nothing for a stricter pattern to buy. The value is a bound
    // parameter, never an identifier.
    publicParams: z.object({ slug: z.string().min(1) }),
    publicSelect: publicSelectObject as unknown as z.ZodType<
      ContentPublicSelect<TDefinition>
    >,
    publicSelectObject,
    select: selectObject as unknown as z.ZodType<ContentSelect<TDefinition>>,
    selectObject,
    translation: buildTranslationSchemas<TDefinition>({
      admin,
      localization,
      localizedFields,
      publication,
    }),
    update: update as unknown as z.ZodType<ContentUpdateInput<TDefinition>>,
    updateEnvelope: z.strictObject({
      // Positive, so a client that forgot to send one cannot coerce `0` past
      // the guard and race the very check it is meant to lose.
      expectedVersion: z.number().int().positive(),
      values: update,
    }) as unknown as z.ZodType<{
      expectedVersion: number;
      values: ContentUpdateInput<TDefinition>;
    }>,
  };
};
