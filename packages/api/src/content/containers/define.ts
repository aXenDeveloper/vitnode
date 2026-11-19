import { z } from "zod";

import type { ContentAccessScopeInput } from "../access/policy";
import type { ContentFieldDescriptor, ContentFieldMap } from "../types";
import type { ContentContainerPoliciesInput } from "./policies";
import type {
  ContentContainerAdminInput,
  ContentContainerDefinition,
  ContentContainerFieldDescriptor,
  ContentContainerFieldMap,
  ContentContainerHierarchyInput,
  ContentContainerLocalizationInput,
  ContentContainerOrderingInput,
  ContentContainerPublicApiInput,
  ContentContainerSchemas,
  ResolvedContentContainerLocalization,
} from "./types";

import { resolveContentAccessScopeInput } from "../access/policy";
import {
  CONTENT_ADMIN_PATH_SEGMENT_PATTERN,
  CONTENT_FIELD_NAME_PATTERN,
  CONTENT_ID_PATTERN,
  CONTENT_PUBLIC_PATH_MAX_LENGTH,
  CONTENT_PUBLIC_PATH_PATTERN,
  CONTENT_PUBLIC_RESERVED_PATHS,
  CONTENT_TABLE_NAME_PATTERN,
} from "../const";
import { ContentEngineError } from "../errors";
import { scalarFieldConstraintIssue } from "../field-constraints";
import { isContentLocaleShaped } from "../locale";
import { contentTypeToPath } from "../registry";
import {
  contentFieldPatchObject,
  contentFieldSelectSchema,
  contentFieldValuesObject,
} from "../schemas";
import {
  CONTENT_CONTAINER_ABSOLUTE_MAX_DEPTH,
  CONTENT_CONTAINER_DEFAULT_MAX_DEPTH,
  CONTENT_CONTAINER_FIELD_KINDS,
  CONTENT_CONTAINER_LOCALIZED_FIELD_KINDS,
  CONTENT_CONTAINER_NAME_MAX_LENGTH,
  CONTENT_CONTAINER_ORDERING_MODES,
  CONTENT_CONTAINER_RESERVED_FIELDS,
  CONTENT_CONTAINER_SLUG_MAX_LENGTH,
} from "./const";
import { CONTENT_CONTAINER_ICON_MAX_LENGTH } from "./icon";
import { resolveContentContainerPolicies } from "./policies";

const fieldKinds: ReadonlySet<string> = new Set(CONTENT_CONTAINER_FIELD_KINDS);
const reservedFields: readonly string[] = CONTENT_CONTAINER_RESERVED_FIELDS;
const orderingModes: readonly string[] = CONTENT_CONTAINER_ORDERING_MODES;
const reservedPublicPaths: readonly string[] = CONTENT_PUBLIC_RESERVED_PATHS;
const localizedKinds: readonly string[] =
  CONTENT_CONTAINER_LOCALIZED_FIELD_KINDS;

const fail = (id: string, message: string): never => {
  throw new ContentEngineError(message, { contentTypeId: id });
};

const assertKnownKeys = (
  id: string,
  label: string,
  value: unknown,
  known: readonly string[],
): void => {
  if (value === undefined) return;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(id, `${label} is an object.`);
  }

  const unknown = Object.keys(value as object).find(
    key => !known.includes(key),
  );
  if (unknown !== undefined) {
    fail(
      id,
      `${label}.${unknown} is not an option. ${label} accepts: ${known.join(", ")}.`,
    );
  }
};

const assertContainerField = (
  id: string,
  name: string,
  fieldValue: ContentContainerFieldDescriptor,
  localization: ResolvedContentContainerLocalization,
): void => {
  if (!CONTENT_FIELD_NAME_PATTERN.test(name)) {
    fail(
      id,
      `Field "${name}" must be camelCase and start with a lowercase letter.`,
    );
  }

  if (reservedFields.includes(name)) {
    fail(
      id,
      `Field "${name}" is reserved. Every container already has ${reservedFields.join(", ")} - declare only what your containers add on top.`,
    );
  }

  if (
    !fieldKinds.has((fieldValue as undefined | { kind?: string })?.kind ?? "")
  ) {
    fail(
      id,
      `Field "${name}" is ${fieldValue?.kind ? `a "${fieldValue.kind}" field` : "not a field descriptor"}. A container field is one value stored beside the container - use field.${CONTENT_CONTAINER_FIELD_KINDS.join("(), field.")}().`,
    );
  }

  if (fieldValue.localized === true && !localization.enabled) {
    fail(
      id,
      `Field "${name}" is \`localized: true\`, and the collection has no \`localization\`. Add \`localization: { defaultLocale }\` to translate it.`,
    );
  }

  if (
    fieldValue.localized === true &&
    !localizedKinds.includes(fieldValue.kind)
  ) {
    fail(
      id,
      `Field "${name}" is a localized "${fieldValue.kind}" field. Only ${localizedKinds.join(" and ")} container fields can be translated.`,
    );
  }

  if ((fieldValue as { unique?: boolean }).unique === true) {
    fail(
      id,
      `Field "${name}" is \`unique: true\`. Container fields live in one JSON document per container, which no unique index covers - only the slug is unique.`,
    );
  }

  if ((fieldValue as { ai?: unknown }).ai !== undefined) {
    fail(
      id,
      `Field "${name}" has \`ai\`. AI assist is for content types only.`,
    );
  }

  if (fieldValue.kind === "icon") return;

  const issue = scalarFieldConstraintIssue(name, fieldValue);
  if (issue) fail(id, issue);
};

const resolveLocalization = (
  id: string,
  localization: ContentContainerLocalizationInput | undefined,
): ResolvedContentContainerLocalization => {
  if (localization === undefined) {
    return { defaultLocale: null, enabled: false };
  }

  assertKnownKeys(id, "localization", localization, ["defaultLocale"]);
  const { defaultLocale } = localization;
  if (
    typeof defaultLocale !== "string" ||
    !isContentLocaleShaped(defaultLocale)
  ) {
    fail(
      id,
      `localization.defaultLocale ${JSON.stringify(defaultLocale)} is not a locale code such as "en" or "pt-BR".`,
    );
  }

  return { defaultLocale: defaultLocale.trim(), enabled: true };
};

const schemaFieldOf = (
  fieldValue: ContentContainerFieldDescriptor,
): ContentFieldDescriptor =>
  fieldValue.kind === "icon"
    ? {
        defaultValue: undefined,
        kind: "text",
        localized: false,
        maxLength: CONTENT_CONTAINER_ICON_MAX_LENGTH,
        nullable: fieldValue.nullable,
        required: fieldValue.required,
      }
    : fieldValue;

const resolveHierarchy = (
  id: string,
  hierarchy: ContentContainerHierarchyInput | undefined,
): { enabled: boolean; maxDepth: number } => {
  assertKnownKeys(id, "hierarchy", hierarchy, ["enabled", "maxDepth"]);

  const enabled = hierarchy?.enabled ?? true;
  if (typeof enabled !== "boolean")
    fail(id, "hierarchy.enabled is `true` or `false`.");

  if (!enabled) {
    if (hierarchy?.maxDepth !== undefined && hierarchy.maxDepth !== 1) {
      fail(
        id,
        "hierarchy.maxDepth is set while hierarchy is disabled. A flat list is one level deep - drop maxDepth, or enable the hierarchy.",
      );
    }

    return { enabled: false, maxDepth: 1 };
  }

  const maxDepth = hierarchy?.maxDepth ?? CONTENT_CONTAINER_DEFAULT_MAX_DEPTH;
  if (
    !Number.isInteger(maxDepth) ||
    maxDepth < 2 ||
    maxDepth > CONTENT_CONTAINER_ABSOLUTE_MAX_DEPTH
  ) {
    fail(
      id,
      `hierarchy.maxDepth must be a whole number from 2 to ${CONTENT_CONTAINER_ABSOLUTE_MAX_DEPTH}. For a single level, set \`hierarchy: { enabled: false }\`.`,
    );
  }

  return { enabled: true, maxDepth };
};

const resolveOrdering = (
  id: string,
  ordering: ContentContainerOrderingInput | undefined,
): { mode: (typeof CONTENT_CONTAINER_ORDERING_MODES)[number] } => {
  assertKnownKeys(id, "ordering", ordering, ["mode"]);
  const mode = ordering?.mode ?? "manual";
  if (!orderingModes.includes(mode)) {
    fail(id, `ordering.mode must be one of: ${orderingModes.join(", ")}.`);
  }

  return { mode };
};

const resolvePublicApi = (
  id: string,
  fields: ContentContainerFieldMap,
  publicApi: ContentContainerPublicApiInput | false | undefined,
): { enabled: boolean; fields: string[]; path: string } => {
  if (publicApi === undefined || publicApi === false) {
    return { enabled: false, fields: [], path: "" };
  }

  assertKnownKeys(id, "publicApi", publicApi, ["fields", "path"]);
  const { path } = publicApi;

  if (typeof path !== "string" || !CONTENT_PUBLIC_PATH_PATTERN.test(path)) {
    fail(
      id,
      `publicApi.path ${JSON.stringify(path)} must be one lowercase URL segment: a letter, then letters, digits or dashes.`,
    );
  }

  if (path.length > CONTENT_PUBLIC_PATH_MAX_LENGTH) {
    fail(
      id,
      `publicApi.path "${path}" is longer than ${CONTENT_PUBLIC_PATH_MAX_LENGTH} characters.`,
    );
  }

  if (reservedPublicPaths.includes(path)) {
    fail(id, `publicApi.path "${path}" is reserved.`);
  }

  const exposed = [...(publicApi.fields ?? [])].map(String);
  for (const [index, name] of exposed.entries()) {
    if (exposed.indexOf(name) !== index) {
      fail(id, `publicApi.fields lists "${name}" twice.`);
    }

    if (fields[name] === undefined) {
      fail(
        id,
        reservedFields.includes(name)
          ? `publicApi.fields lists "${name}", which every public container already returns. List only the definition's own fields.`
          : `publicApi.fields references unknown field "${name}".`,
      );
    }
  }

  return { enabled: true, fields: exposed, path };
};

const resolveAdmin = (
  id: string,
  admin: ContentContainerAdminInput | undefined,
): ContentContainerDefinition["admin"] => {
  assertKnownKeys(id, "admin", admin, [
    "navigation",
    "path",
    "permissionModule",
  ]);

  const path = admin?.path ?? contentTypeToPath(id);
  const invalid = path
    .split("/")
    .find(segment => !CONTENT_ADMIN_PATH_SEGMENT_PATTERN.test(segment));
  if (invalid !== undefined) {
    fail(
      id,
      `admin.path "${path}" is not a URL path. Every segment starts with a lowercase letter and holds only lowercase letters, digits and dashes.`,
    );
  }

  const permissionModule =
    admin?.permissionModule ??
    id.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!CONTENT_TABLE_NAME_PATTERN.test(permissionModule)) {
    fail(
      id,
      `admin.permissionModule "${permissionModule}" must be snake_case and start with a letter.`,
    );
  }

  return {
    navigation: { enabled: admin?.navigation ?? true },
    path,
    permissionModule,
  };
};

const buildSchemas = (
  fields: ContentContainerFieldMap,
  publicFields: readonly string[],
  localization: ResolvedContentContainerLocalization,
): ContentContainerSchemas => {
  const fieldMap: ContentFieldMap = Object.fromEntries(
    Object.entries(fields).map(([name, fieldValue]) => [
      name,
      schemaFieldOf(fieldValue),
    ]),
  );
  const metadata = contentFieldValuesObject(fieldMap);
  const metadataPatch = contentFieldPatchObject(fieldMap);
  const localizedFieldMap: ContentFieldMap = Object.fromEntries(
    Object.entries(fieldMap).filter(
      ([, fieldValue]) => fieldValue.localized === true,
    ),
  );
  const name = z.string().trim().min(1).max(CONTENT_CONTAINER_NAME_MAX_LENGTH);
  const slug = z.string().trim().min(1).max(CONTENT_CONTAINER_SLUG_MAX_LENGTH);
  const id = z.number().int().positive();
  const position = z.number().int().min(0);
  const translation = z.strictObject({
    metadata: contentFieldPatchObject(localizedFieldMap).optional(),
    name: z.string().trim().max(CONTENT_CONTAINER_NAME_MAX_LENGTH).optional(),
    slug: z.string().trim().max(CONTENT_CONTAINER_SLUG_MAX_LENGTH).optional(),
  });
  const translations: z.ZodRawShape = localization.enabled
    ? {
        translations: z
          .record(z.string().refine(isContentLocaleShaped), translation)
          .optional(),
      }
    : {};

  const selectShape = (names: readonly string[]) =>
    z.object(
      Object.fromEntries(
        names.map(fieldName => [
          fieldName,
          contentFieldSelectSchema(fieldMap[fieldName]).nullable(),
        ]),
      ),
    );

  const columns = {
    depth: z.number().int().positive(),
    id,
    name: z.string(),
    parentId: id.nullable(),
    position,
    slug: z.string(),
  };

  return {
    create: z.strictObject({
      metadata: metadata.optional(),
      name,
      parentId: id.nullable().optional(),
      position: position.optional(),
      slug: slug.optional(),
      ...translations,
    }),
    metadata,
    metadataPatch,
    move: z.strictObject({ parentId: id.nullable(), position }),
    publicRecord: z.object({
      ...columns,
      metadata: selectShape(publicFields),
    }),
    record: z.object({
      ...columns,
      createdAt: z.date(),
      metadata: selectShape(Object.keys(fields)),
      translations: z.record(
        z.string(),
        z.object({
          metadata: z.record(z.string(), z.unknown()).optional(),
          name: z.string().optional(),
          slug: z.string().optional(),
        }),
      ),
      updatedAt: z.date(),
    }),
    update: z
      .strictObject({
        metadata: metadataPatch.optional(),
        name: name.optional(),
        slug: slug.optional(),
        ...translations,
      })
      .refine(value => Object.keys(value).length > 0, {
        message: "Provide at least one value to update.",
      }),
  };
};

/**
 * Declares a collection of containers - forums, boards, categories - that
 * records of other content types are filed into with `field.container()`.
 * Containers are stored in core tables, so a collection needs no table of its
 * own; it adds AdminCP screens, optional nesting and ordering, a public API,
 * and per-container publishing policies. Universal.
 *
 * Register it on the server with `buildContentAdminModule({ containers })` /
 * `buildContentPublicModule({ containers })`, and in the AdminCP with
 * `buildPlugin({ containers })`.
 *
 * @throws A `ContentEngineError` at import time for an invalid id, a field
 * kind containers cannot store, or an invalid option.
 *
 * @example
 * ```ts
 * import { defineContentContainer, field } from "@vitnode/core/content";
 *
 * export const forumContainers = defineContentContainer({
 *   id: "forum.forums",
 *   fields: { description: field.textarea({ maxLength: 500, nullable: true }) },
 *   hierarchy: { maxDepth: 4 },
 *   publicApi: { path: "forums", fields: ["description"] },
 *   admin: { path: "forum/forums" },
 * });
 * ```
 */
export const defineContentContainer = <
  const TId extends string,
  const TFields extends ContentContainerFieldMap = Record<never, never>,
  const TPublicField extends keyof TFields & string = never,
  const TPublicPath extends string = string,
  TPublicApi extends
    | ContentContainerPublicApiInput<TPublicField, TPublicPath>
    | false
    | undefined = undefined,
>({
  access,
  admin,
  fields = {} as TFields,
  hierarchy,
  id,
  localization,
  ordering,
  policies,
  publicApi,
}: {
  /**
   * Per-container access rules: who may see a container (`view`), read what is
   * filed in it (`read`), reply to it (`comment`) and download its protected
   * attachments (`downloadAttachments`). Containers inherit from their parent
   * and never open up what a parent hides. `true` starts every action open to
   * everyone; `defaults` sets `{ mode: "members" }` for some. Omit it and the
   * collection has no access rules at all.
   *
   * Only turn it on when every custom route of the plugin that reads content
   * filed here goes through the Content Engine's public services or
   * `createContentAccess(c)` - a route that queries the table directly would
   * ignore the rules.
   */
  access?: boolean | ContentAccessScopeInput;
  admin?: ContentContainerAdminInput;
  fields?: TFields;
  hierarchy?: ContentContainerHierarchyInput;
  id: TId;
  /**
   * Translate containers: `name`, `slug` and every `localized: true` text or
   * textarea field get one value per language, falling back to
   * `defaultLocale`. Public reads take `?locale=`; a slug in any language
   * finds its container. Omit it and containers have one value for everyone.
   */
  localization?: ContentContainerLocalizationInput;
  ordering?: ContentContainerOrderingInput;
  /**
   * Per-container publishing rules for the content types filed here. Omit it
   * and those content types keep their own `publicWrite` behaviour.
   */
  policies?: ContentContainerPoliciesInput | false;
  publicApi?: (
    | ContentContainerPublicApiInput<TPublicField, TPublicPath>
    | false
  ) &
    TPublicApi;
}): ContentContainerDefinition<
  TId,
  TFields,
  TPublicField,
  TPublicApi extends ContentContainerPublicApiInput ? true : false,
  TPublicApi extends ContentContainerPublicApiInput<string, infer TPath>
    ? TPath
    : string
> => {
  if (typeof id !== "string" || !CONTENT_ID_PATTERN.test(id)) {
    throw new ContentEngineError(
      `Container definition id ${JSON.stringify(id)} must look like "plugin.collection" (lowercase, dot separated).`,
    );
  }

  if (typeof fields !== "object" || fields === null || Array.isArray(fields)) {
    fail(id, "fields is an object of `field.*()` descriptors.");
  }

  const resolvedLocalization = resolveLocalization(id, localization);

  for (const [name, fieldValue] of Object.entries(fields)) {
    assertContainerField(id, name, fieldValue, resolvedLocalization);
  }

  const resolvedPublicApi = resolvePublicApi(id, fields, publicApi);

  let resolvedAccess;
  try {
    resolvedAccess = resolveContentAccessScopeInput(access);
  } catch (error) {
    return fail(id, (error as Error).message);
  }

  return {
    access: resolvedAccess,
    admin: resolveAdmin(id, admin),
    fields,
    hierarchy: resolveHierarchy(id, hierarchy),
    id,
    kind: "contentContainer",
    localization: resolvedLocalization,
    ordering: resolveOrdering(id, ordering),
    policies: resolveContentContainerPolicies(id, policies),
    publicApi: resolvedPublicApi as never,
    schemas: buildSchemas(
      fields,
      resolvedPublicApi.fields,
      resolvedLocalization,
    ),
  };
};

export { isContentContainerDefinition } from "./guard";
