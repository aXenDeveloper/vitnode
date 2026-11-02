import type { ContentAccessInput } from "./define-access";
import type { ContentIdStrategy } from "./ids";
import type {
  AnyContentTypeDefinition,
  ContentAdminConfig,
  ContentAuditInput,
  ContentDeliveryConfig,
  ContentDeliveryDescriptionField,
  ContentDeliveryEnabled,
  ContentDeliveryInput,
  ContentDeliveryNoIndexField,
  ContentDeliveryTitleField,
  ContentDuplicationEnabled,
  ContentDuplicationInput,
  ContentEditorialEnabled,
  ContentEditorialInput,
  ContentFieldMap,
  ContentFieldsConstraint,
  ContentIndexInput,
  ContentLocalizationConfig,
  ContentLocalizationEnabled,
  ContentPreviewEnabled,
  ContentPublicApiConfig,
  ContentPublicExposableField,
  ContentPublicListFieldsResolved,
  ContentPublicOwnershipField,
  ContentPublicPeopleResolved,
  ContentPublicPersonField,
  ContentPublicWritableField,
  ContentPublicWriteInput,
  ContentPublicWriteResolved,
  ContentReportsInput,
  ContentSchedulingEnabled,
  ContentSearchAuthorField,
  ContentSearchConfig,
  ContentSearchDescriptionField,
  ContentSearchEnabled,
  ContentSearchTextField,
  ContentSearchTitleField,
  ContentThreadInput,
  ContentTypeDefinition,
  ResolvedContentAuditConfig,
  ResolvedContentDeliveryConfig,
  ResolvedContentDuplicationConfig,
  ResolvedContentEditorialConfig,
  ResolvedContentLocalizationConfig,
  ResolvedContentPublicApiConfig,
  ResolvedContentSearchConfig,
  ResolvedContentVisibilityConfig,
} from "./types";

import { contentEntityKey } from "./admin/labels";
import {
  assertContentRelationTargets,
  resolveContentAdvanced,
} from "./advanced";
import {
  CONTENT_ID_PATTERN,
  CONTENT_IDENTIFIER_MAX_LENGTH,
  CONTENT_TABLE_NAME_PATTERN,
} from "./const";
import { resolveContentTypeAccess } from "./define-access";
import { resolveAdmin } from "./define-admin";
import { resolveEditorial } from "./define-editorial";
import {
  assertField,
  assertFieldAiAssist,
  assertFieldKind,
  assertFieldName,
  assertSingleContainerField,
  assertSlugSources,
  bindSelfRelations,
} from "./define-fields";
import {
  resolveDuplication,
  resolveIdStrategy,
  resolveVisibility,
} from "./define-lifecycle";
import { resolvePublicApi } from "./define-public-api";
import { resolvePublicWrite } from "./define-public-write";
import { resolveReports } from "./define-reports";
import { resolveSearch } from "./define-search";
import {
  assertContentOptionShapes,
  assertKnownColumns,
  editorialFields,
  publicationFields,
  systemFields,
  visibilityFields,
} from "./define-shared";
import { resolveContentThread } from "./define-thread";
import { defaultThreadSearch } from "./define-thread-search";
import { resolveContentDelivery } from "./delivery";
import { ContentEngineError } from "./errors";
import { resolveContentIndexes } from "./indexes";
import {
  partitionContentFields,
  resolveContentLocalization,
} from "./localization";
import {
  contentStorageColumns,
  isContentReferenceCollection,
  splitContentFieldPath,
} from "./paths";
import { buildContentSchemas } from "./schemas";

const slugifyModule = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const assertIndexable = (
  id: string,
  names: readonly string[],
  fields: ContentFieldMap,
  localizedFields: ContentFieldMap,
): void => {
  for (const name of names) {
    const path = splitContentFieldPath(name);
    const owner = path ? path[0] : name;
    const fieldValue = fields[owner];

    if (localizedFields[owner] !== undefined) {
      throw new ContentEngineError(
        path
          ? `indexes names "${name}", a leaf of the localized group "${owner}". Its column is on the translation table, where the unique scope is per language - see \`localization.translationIndexes\`.`
          : `indexes names the localized field "${owner}", which is not a column on the base table. Localized values are edited through the field's own language switcher.`,
        { contentTypeId: id },
      );
    }

    if (!fieldValue) continue;

    if (fieldValue.kind === "blocks") {
      throw new ContentEngineError(
        `indexes names the block zone "${owner}", which is one JSONB document rather than a value to compare. A btree index over it would order pages by their serialised bytes.`,
        { contentTypeId: id },
      );
    }

    if (fieldValue.kind === "repeatable") {
      throw new ContentEngineError(
        `indexes names "${name}", which belongs to the repeatable "${owner}". Repeatable leaves are columns on a generated child table, not on the base table, so an index here would have nothing to cover. The child table already carries \`(itemId, position)\`.`,
        { contentTypeId: id },
      );
    }

    if (isContentReferenceCollection(fieldValue)) {
      throw new ContentEngineError(
        `indexes names the to-many ${fieldValue.kind === "file" ? "file field" : "relation"} "${owner}", which is not a column: its values live in a generated junction table, which already carries its own primary key and reverse index.`,
        { contentTypeId: id },
      );
    }

    if (fieldValue.kind === "group" && !path) {
      throw new ContentEngineError(
        `indexes names the group "${owner}", which is several columns rather than one. Name the leaves you mean, e.g. \`{ on: ["${owner}.${Object.keys((fieldValue as { fields: ContentFieldMap }).fields)[0]}"] }\`.`,
        { contentTypeId: id },
      );
    }
  }
};

const resolveContentAudit = (
  id: string,
  audit: ContentAuditInput | false | undefined,
  fieldNames: readonly string[],
): ResolvedContentAuditConfig => {
  if (audit === false) {
    return { enabled: false, excludeFields: [], trackChanges: false };
  }
  if (audit !== undefined && (typeof audit !== "object" || audit === null)) {
    throw new ContentEngineError(
      "audit is `false` or an options object. Omit it to keep the default.",
      { contentTypeId: id },
    );
  }

  const excludeFields = [...(audit?.excludeFields ?? [])];
  for (const field of excludeFields) {
    if (!fieldNames.includes(field)) {
      throw new ContentEngineError(
        `audit.excludeFields references unknown field "${field}".`,
        { contentTypeId: id },
      );
    }
  }

  return {
    enabled: true,
    excludeFields,
    trackChanges: audit?.trackChanges ?? true,
  };
};

/**
 * Declares a Content Engine content type: its fields, its storage and the
 * capabilities (publication, localization, public API, editorial workflow,
 * delivery, search, reports, ...) the engine generates for it.
 *
 * Universal and side-effect free: import the result from browser and server
 * code alike. It returns the **resolved** definition - every option normalised
 * and defaulted, plus the generated Zod schemas - which the server turns into
 * tables (`createContentTable()`), a model (`createContentModel()`) and generated API
 * modules, and the AdminCP turns into list and form screens.
 *
 * Mistakes are reported twice: option combinations that cannot work (a preview
 * without a public API, scheduling without publication, a private field in
 * search) are compile errors where the types can express them, and everything
 * is checked again at runtime, so a JavaScript caller gets the same answer.
 *
 * @throws {ContentEngineError} When the definition is invalid - a malformed
 * `id` or `tableName`, an empty `fields` map, an unknown or reserved field
 * name, or an option whose requirements are not met. Thrown at import time.
 *
 * @example
 * ```ts
 * import { defineContentType, field } from "@vitnode/core/content";
 *
 * export const blogCategoryContentType = defineContentType({
 *   id: "blog.category",
 *   tableName: "blog_categories",
 *   localization: { defaultLocale: "en", fallback: "default" },
 *   fields: {
 *     name: field.text({ localized: true, required: true, maxLength: 100 }),
 *     color: field.text({ maxLength: 50, nullable: true }),
 *   },
 *   admin: { titleField: "name", list: { columns: ["name", "color"] } },
 * });
 * ```
 */
export const defineContentType = <
  TId extends string,
  TFields extends ContentFieldsConstraint<
    TPublication,
    ContentEditorialEnabled<TEditorial>
  >,
  TPublication extends boolean = false,
  TPublicField extends ContentPublicExposableField<TFields> = never,
  TPublicEnabled extends boolean = [TPublicField] extends [never]
    ? false
    : true,
  // Inferred from the `search` literal and checked against the public allowlist.
  // The constraint is verified once every other parameter is resolved, which is
  // what makes "an indexed field is a public field" a compile error.
  // The whole `search` argument, inferred as one type. Its *constraint* is what
  // enforces the field rules, and a constraint is checked once every other
  // parameter is resolved - spelling the same unions out inside the parameter
  // type instead lets `TPublicField` fall back to its own constraint while the
  // argument is still being checked, and a private field name slips through.
  //
  // Inferring the object rather than its parts is also what preserves the
  // `enabled` literal: an intersection member is not an inference site.
  TSearch extends
    | ContentSearchConfig<
        ContentSearchTitleField<TFields, TPublicField>,
        ContentSearchDescriptionField<TFields, TPublicField>,
        ContentSearchTextField<TFields, TPublicField>,
        ContentSearchAuthorField<TFields>
      >
    | false
    | undefined = undefined,
  // The whole `editorial` argument, inferred as one type, for the same two
  // reasons `TSearch` is: its constraint is checked once `TPublicEnabled` and
  // `TPublication` are resolved - which is what makes "preview needs a public
  // API" and "scheduling needs publication" compile errors - and an
  // intersection member is not an inference site, so inferring the object is
  // the only way the three `enabled` literals survive.
  TEditorial extends ContentEditorialInput<TPublicEnabled, TPublication> =
    false,
  // The whole `localization` argument, inferred as one type, for the same reason
  // `TSearch` and `TEditorial` are: an intersection member is not an inference
  // site, so this is the only way the `enabled` literal survives - and every
  // conditional that decides whether a translation table, translation schemas
  // and a translation service exist reads that literal.
  TLocalization extends ContentLocalizationConfig | false | undefined =
    undefined,
  // The whole `delivery` argument, inferred as one type, for the same two reasons
  // `TSearch` and `TEditorial` are. Its *constraint* is what enforces the field
  // rules - a constraint is checked once `TPublicField` and `TPublicEnabled` are
  // resolved, which is what makes "delivery needs a public API" and "an SEO field
  // has to be public" compile errors rather than boot-time ones.
  TDelivery extends ContentDeliveryInput<
    TPublicEnabled,
    ContentEditorialEnabled<TEditorial>,
    ContentDeliveryTitleField<TFields, TPublicField>,
    ContentDeliveryDescriptionField<TFields, TPublicField>,
    ContentDeliveryNoIndexField<TFields, TPublicField>
  > = false,
  TPublicPath extends string = string,
  TVisibility extends boolean = false,
  TDuplication extends ContentDuplicationInput = false,
  TIdStrategy extends ContentIdStrategy = "serial",
  TPublicWrite extends
    | ContentPublicWriteInput<
        TPublicEnabled,
        ContentPublicWritableField<TFields>,
        ContentPublicOwnershipField<TFields>
      >
    | undefined = undefined,
  TPublicPeople extends ContentPublicPersonField<TFields> = never,
  TPublicListField extends TPublicField = never,
>({
  access,
  admin = {},
  audit,
  delivery,
  duplication,
  editorial,
  fields,
  id,
  idStrategy,
  indexes = [],
  liveEditing,
  localization,
  publicApi,
  publicWrite,
  publication,
  reports,
  search,
  tableName,
  thread,
  visibility,
}: {
  /**
   * Role-based access rules. `{ scope: true }` makes every record of this type
   * an access scope with its own view, read, comment and download rules (a
   * blog category); `{ from: "categoryId" }` files records under the scopes a
   * relation points at, and a record is readable only when every one of them
   * allows it. Records that answer a parent (thread replies, comments) inherit
   * their parent's access without any option. Omit it and nothing changes.
   */
  access?: ContentAccessInput<keyof TFields & string> | false;
  /**
   * How the generated AdminCP screens present the content type: list columns,
   * form layout, dialog or page mode, title field, URL path and the staff
   * permission module. Every property is optional.
   */
  admin?: ContentAdminConfig<
    TFields,
    TPublication,
    ContentEditorialEnabled<TEditorial>
  >;

  /**
   * Automatic audit logging: every create, edit, publication, visibility,
   * schedule and translation write is recorded in the central audit log with
   * its actor and changed fields. On by default; `false` turns it off, and
   * `excludeFields` keeps noisy fields out of the recorded changes.
   */
  audit?: ContentAuditInput<Extract<keyof TFields, string>> | false;

  /**
   * Public delivery: canonical URLs (`/{publicApi.path}/:slug` by default), SEO
   * metadata, localized alternates, sitemap entries and, with `redirects`, slug
   * history. Needs `publicApi`. `true` enables it with every default.
   */
  delivery?: TDelivery;

  /**
   * Adds a "Duplicate" action that copies a record as a new draft. With
   * `titleSuffix` (on by default when `admin.titleField` is a text field), the
   * copy's title gets a translated "(Copy)" suffix.
   */
  duplication?: TDuplication;

  /**
   * The editorial workflow: a `version` column for optimistic locking, revision
   * history (`revisions.retention`, default 50), share-able draft previews
   * (`preview`, needs `publicApi`) and scheduled publishing (`scheduling`,
   * needs `publication`). `true` enables revisions with defaults only.
   */
  editorial?: TEditorial;
  /**
   * The content type's own fields, built with `field.*`. At least one. System
   * columns (`id`, `createdAt`, `updatedAt`, plus the ones each option adds)
   * are generated and cannot be redeclared.
   */
  fields: TFields;
  /**
   * Stable identifier, `plugin.entity` (lowercase, dot separated), e.g.
   * `blog.post`. Used for events, cache tags, i18n keys and the permission
   * module, so changing it is a breaking change.
   */
  id: TId;
  /** Primary key type: `"serial"` (default, a number), `"uuid"` or `"bigint"` (both strings). */
  idStrategy?: TIdStrategy;
  /**
   * Extra base-table indexes. Indexes for slugs, unique fields, relations and
   * the enabled options are generated automatically; a declared index that
   * duplicates one is merged. Localized fields cannot be indexed here.
   */
  indexes?: ContentIndexInput<
    TFields,
    TPublication,
    ContentEditorialEnabled<TEditorial>
  >[];

  /**
   * Real-time collaborative editing in the AdminCP: field locks and a shared
   * draft. Needs `editorial`. Defaults to `false`.
   */
  liveEditing?: ContentEditorialEnabled<TEditorial> extends true
    ? boolean
    : false;
  /**
   * Enables per-language values for fields marked `localized: true`, stored in
   * a generated `<tableName>_translations` table. `defaultLocale` is the
   * language every record is first created in; `fallback: "default"` serves
   * that language's translation publicly when the requested one is missing
   * (default `"none"`: no fallback).
   */
  localization?: TLocalization;
  /**
   * Opts into a generated read-only public API. Needs `publication` and exactly
   * one exposed slug field. Omit it and nothing public is generated.
   */
  publicApi?:
    | ContentPublicApiConfig<
        TPublicField,
        TPublicPath,
        TPublicPeople,
        TPublicListField
      >
    | false;
  /**
   * Opts into the draft/published lifecycle: adds `status` and `publishedAt`,
   * and only published records reach the public API. Defaults to `false`.
   */
  publication?: TPublication;
  /**
   * Generated public create/update routes for signed-in users. Needs
   * `publicApi` and a single, shared `field.user()` as `ownership.field`, which
   * the server stamps from the session. `create.status` defaults to `"draft"`
   * and `update.own` to `true`. Not available on localized content types.
   */
  publicWrite?: TPublicWrite;
  /**
   * Lets users report records to moderators. Needs `publicApi`. `true` uses
   * `admin.titleField` (when public) as the report title and snapshots the
   * public text, textarea, rich text, enum and file fields other than the
   * title field.
   */
  reports?: ContentReportsInput<keyof TFields & string>;

  /**
   * Indexes published records into the site-wide search. Every indexed field
   * must also be in `publicApi.fields`, and `pathTemplate` must contain one
   * `{slug}` placeholder.
   */
  search?: TSearch;
  /**
   * The base table's Postgres name: snake_case, starting with a letter, at
   * most 63 characters. Generated child, junction and translation tables are
   * named after it.
   */
  tableName: string;
  /**
   * Records that answer each other under one root - forum replies under a
   * topic. Adds the public `GET /thread` route and server-side parent checks.
   */
  thread?: ContentThreadInput<keyof TFields & string> | false;
  /**
   * Lets moderators hide a record from the public site without unpublishing
   * it (`hiddenAt`, `hiddenBy`). Needs `publication: true`. Defaults to `false`.
   */
  visibility?: TVisibility;
}): ContentTypeDefinition<
  TId,
  TFields,
  TPublication,
  TPublicField,
  TPublicEnabled,
  ContentSearchEnabled<TSearch>,
  ContentEditorialEnabled<TEditorial>,
  ContentPreviewEnabled<TEditorial>,
  ContentSchedulingEnabled<TEditorial>,
  ContentLocalizationEnabled<TLocalization>,
  ContentDeliveryEnabled<TDelivery>,
  TPublicPath,
  TVisibility,
  ContentDuplicationEnabled<TDuplication>,
  TIdStrategy,
  ContentPublicWriteResolved<TPublicWrite>,
  ContentPublicPeopleResolved<TPublicPeople>,
  ContentPublicListFieldsResolved<TPublicListField>
> => {
  if (!CONTENT_ID_PATTERN.test(id)) {
    throw new ContentEngineError(
      `Content type id "${id}" must look like "plugin.entity" (lowercase, dot separated).`,
    );
  }

  if (!CONTENT_TABLE_NAME_PATTERN.test(tableName)) {
    throw new ContentEngineError(
      `Table name "${tableName}" must be snake_case and start with a letter.`,
      { contentTypeId: id },
    );
  }

  if (tableName.length > CONTENT_IDENTIFIER_MAX_LENGTH) {
    throw new ContentEngineError(
      `Table name "${tableName}" is longer than the Postgres identifier limit of ${CONTENT_IDENTIFIER_MAX_LENGTH} characters.`,
      { contentTypeId: id },
    );
  }

  // `ContentFieldsConstraint` only pins `kind` (see its doc comment), so widen
  // to the real descriptor union here. This is the only unchecked widening in
  // the engine, and `assertFieldKind` below makes it true at runtime for
  // anything that skipped the `field.*` builders.
  // Before the rebind, which is the only moment a supplied `target` and the
  // self-relation placeholder are still distinguishable.
  assertContentRelationTargets(id, fields as unknown as ContentFieldMap);

  const fieldMap = bindSelfRelations(
    fields as unknown as ContentFieldMap,
    // Read lazily, so `definition` is fully assigned by the time a relation
    // resolves. The widening is the same one `AnyContentTypeDefinition` exists
    // for: a self-relation's target is read by code that cannot know which
    // concrete content type it was handed.
    () => definition as unknown as AnyContentTypeDefinition,
  );
  const fieldNames = Object.keys(fieldMap);
  if (fieldNames.length === 0) {
    throw new ContentEngineError("A content type needs at least one field.", {
      contentTypeId: id,
    });
  }

  assertContentOptionShapes(id, {
    admin,
    delivery,
    duplication,
    editorial,
    localization,
    publicApi,
    publicWrite,
    publication,
    reports,
    search,
    visibility,
  });

  if (publication !== undefined && typeof publication !== "boolean") {
    throw new ContentEngineError(
      "publication is `true` or `false`. It has no options of its own.",
      { contentTypeId: id },
    );
  }

  if (liveEditing !== undefined && typeof liveEditing !== "boolean") {
    throw new ContentEngineError(
      "liveEditing is `true` or `false`. It has no options of its own.",
      { contentTypeId: id },
    );
  }

  const publicationEnabled = publication === true;
  const editorialEnabled = editorial !== undefined && editorial !== false;

  if (liveEditing === true && !editorialEnabled) {
    throw new ContentEngineError(
      "liveEditing needs `editorial`. Field locks and the shared draft are measured against the record version, which only editorial adds.",
      { contentTypeId: id },
    );
  }
  const resolvedIdStrategy = resolveIdStrategy(id, idStrategy);
  const resolvedVisibility = resolveVisibility(
    id,
    visibility,
    publicationEnabled,
  );
  const visibilityEnabled = resolvedVisibility.enabled;

  for (const name of fieldNames) {
    assertFieldName(
      id,
      name,
      publicationEnabled,
      editorialEnabled,
      visibilityEnabled,
    );
    assertFieldKind(id, name, fieldMap[name]);
    assertField(id, name, fieldMap[name]);
  }

  assertSlugSources(id, fieldMap);
  assertSingleContainerField(id, fieldMap);
  assertFieldAiAssist(id, fieldMap);

  // First, because every resolver below is stated in terms of what it produces:
  // the generated table names, and above all the one leaf-path -> column mapping
  // the indexes, the schemas, the services, the revisions, the public projection
  // and the AdminCP all read. It throws on every advanced-field mistake, so
  // nothing downstream has to defend against a half-valid group.
  const resolvedAdvanced = resolveContentAdvanced({
    fields: fieldMap,
    id,
    tableName,
  });

  // The one partition every subsystem downstream of here reads. A localized
  // field is not a column on the base table, so it takes no part in the base
  // indexes, the admin surfaces or the base schemas.
  const { localizedFields, sharedFields } = partitionContentFields(fieldMap);
  // Groups flattened into the columns they generate, which is what an index and
  // a unique constraint actually address.
  const sharedColumns = contentStorageColumns(sharedFields);
  const leafColumnByPath = new Map(
    resolvedAdvanced.leaves.map(leaf => [leaf.path, leaf.columnName]),
  );

  const knownColumns = new Set([
    ...Object.keys(sharedColumns),
    ...resolvedAdvanced.leaves
      .filter(leaf => !leaf.localized)
      .map(leaf => leaf.path),
    ...systemFields,
    ...(publicationEnabled ? publicationFields : []),
    ...(editorialEnabled ? editorialFields : []),
    ...(visibilityEnabled ? visibilityFields : []),
  ]);
  const resolvedIndexes = resolveContentIndexes({
    contentTypeId: id,
    declared: indexes.map(index => {
      const on = index.on.map(String);
      assertIndexable(id, on, fieldMap, localizedFields);
      assertKnownColumns(id, "indexes", on, knownColumns);

      // Declared in canonical paths, materialised against real columns: the
      // author writes `["seo.title"]` and the migration gets `seo_title`.
      return {
        ...index,
        on: on.map(name => leafColumnByPath.get(name) ?? name),
      };
    }),
    // Shared only: a localized slug's unique index is scoped to a language and
    // belongs to the translation table, which `resolveContentTranslationIndexes`
    // builds.
    fields: sharedColumns,
    publication: publicationEnabled,
    tableName,
    thread: thread !== undefined && thread !== false,
    visibility: visibilityEnabled,
  });

  // Every declared field, in declaration order: the AdminCP renders one form,
  // and a localized input sits in it wherever it was written.
  const resolvedAdmin = resolveAdmin(
    id,
    fieldMap,
    localizedFields,
    admin,
    publicationEnabled,
    editorialEnabled,
  );
  // The id, not a display name: a permission module is written into every role
  // that grants it, so it must not move when somebody rewords a heading.
  const permissionModule =
    admin.permissionModule ?? slugifyModule(contentEntityKey(id));

  if (!CONTENT_TABLE_NAME_PATTERN.test(permissionModule)) {
    throw new ContentEngineError(
      `Could not derive a permission module name from the id "${id}". Set \`admin.permissionModule\` explicitly.`,
      { contentTypeId: id },
    );
  }

  const resolvedPublicApi = resolvePublicApi(
    id,
    fieldMap,
    publicApi,
    publicationEnabled,
    localizedFields,
  );

  const resolvedPublicWrite = resolvePublicWrite(id, fieldMap, publicWrite, {
    localized: Object.keys(localizedFields).length > 0,
    publicApi: resolvedPublicApi,
  });

  const resolvedEditorial = resolveEditorial(
    id,
    editorial,
    resolvedPublicApi,
    publicationEnabled,
  );

  // Last, because it reads the field partition every other resolver has already
  // been checked against. There is no capability it refuses any more: every
  // subsystem reads the language it was asked for.
  const resolvedLocalization = resolveContentLocalization({
    fields: fieldMap,
    id,
    localization,
    publication: publicationEnabled,
    tableName,
  });

  // After localization, because "which language owns a historical URL" is read
  // off the field partition, and after `publicApi`, because every canonical path
  // and every SEO field is stated in terms of the resolved public allowlist.
  const resolvedDelivery = resolveContentDelivery({
    delivery: delivery as boolean | ContentDeliveryConfig | undefined,
    // Read off the *resolved* editorial config rather than the argument, so the
    // redirect check sees exactly what `resolveEditorial` decided.
    editorial: resolvedEditorial.enabled,
    fields: fieldMap,
    id,
    localization: {
      defaultLocale: resolvedLocalization.defaultLocale,
      enabled: resolvedLocalization.enabled,
    },
    localizedFields,
    publicApi: resolvedPublicApi,
    publication: publicationEnabled,
  });

  const resolvedReports = resolveReports(id, reports, {
    admin: resolvedAdmin,
    fields: fieldMap,
    publicApi: resolvedPublicApi,
  });

  const resolvedThread = resolveContentThread(id, fieldMap, thread, {
    localized: resolvedLocalization.enabled,
    publicApi: resolvedPublicApi,
    publicWrite: resolvedPublicWrite,
  });

  const resolvedSearch = resolveSearch(
    id,
    fieldMap,
    search ??
      defaultThreadSearch({
        delivery: resolvedDelivery,
        fields: fieldMap,
        publicApi: resolvedPublicApi,
        publicWrite: resolvedPublicWrite,
        thread: resolvedThread,
      }),
    resolvedPublicApi,
    publicationEnabled,
    Object.keys(localizedFields).length > 0,
  );

  const resolvedDuplication = resolveDuplication(
    id,
    duplication,
    fieldMap,
    resolvedAdmin,
  );

  const definition: ContentTypeDefinition<
    TId,
    TFields,
    TPublication,
    TPublicField,
    TPublicEnabled,
    ContentSearchEnabled<TSearch>,
    ContentEditorialEnabled<TEditorial>,
    ContentPreviewEnabled<TEditorial>,
    ContentSchedulingEnabled<TEditorial>,
    ContentLocalizationEnabled<TLocalization>,
    ContentDeliveryEnabled<TDelivery>,
    TPublicPath,
    TVisibility,
    ContentDuplicationEnabled<TDuplication>,
    TIdStrategy,
    ContentPublicWriteResolved<TPublicWrite>,
    ContentPublicPeopleResolved<TPublicPeople>,
    ContentPublicListFieldsResolved<TPublicListField>
  > = {
    access: resolveContentTypeAccess(id, fieldMap, access),
    admin: resolvedAdmin,
    advanced: resolvedAdvanced,
    audit: resolveContentAudit(id, audit, fieldNames),
    delivery: resolvedDelivery as ResolvedContentDeliveryConfig<
      ContentDeliveryEnabled<TDelivery>
    >,
    duplication: resolvedDuplication as ResolvedContentDuplicationConfig<
      ContentDuplicationEnabled<TDuplication>
    >,
    editorial: resolvedEditorial as ResolvedContentEditorialConfig<
      ContentEditorialEnabled<TEditorial>,
      ContentPreviewEnabled<TEditorial>,
      ContentSchedulingEnabled<TEditorial>
    >,
    // The rebound copy, so a self-relation resolves rather than throwing.
    fields: fieldMap as unknown as TFields,
    id,
    idStrategy: resolvedIdStrategy as TIdStrategy,
    indexes: resolvedIndexes,
    liveEditing: { enabled: liveEditing === true },
    localization: resolvedLocalization as ResolvedContentLocalizationConfig<
      ContentLocalizationEnabled<TLocalization>
    >,
    permissionModule,
    publication: {
      enabled: publicationEnabled as TPublication,
    },
    reports: resolvedReports,
    thread: resolvedThread,
    publicApi: resolvedPublicApi as ResolvedContentPublicApiConfig<
      TPublicField,
      TPublicEnabled,
      TPublicPath,
      ContentPublicPeopleResolved<TPublicPeople>,
      ContentPublicListFieldsResolved<TPublicListField>
    >,
    publicWrite:
      resolvedPublicWrite as ContentPublicWriteResolved<TPublicWrite>,
    schemas: buildContentSchemas<
      ContentTypeDefinition<
        TId,
        TFields,
        TPublication,
        TPublicField,
        TPublicEnabled,
        ContentSearchEnabled<TSearch>,
        ContentEditorialEnabled<TEditorial>,
        ContentPreviewEnabled<TEditorial>,
        ContentSchedulingEnabled<TEditorial>,
        ContentLocalizationEnabled<TLocalization>,
        ContentDeliveryEnabled<TDelivery>,
        TPublicPath,
        TVisibility,
        ContentDuplicationEnabled<TDuplication>,
        TIdStrategy,
        ContentPublicWriteResolved<TPublicWrite>,
        ContentPublicPeopleResolved<TPublicPeople>,
        ContentPublicListFieldsResolved<TPublicListField>
      >
    >({
      admin: resolvedAdmin,
      advanced: resolvedAdvanced,
      editorial: editorialEnabled,
      fields: fieldMap,
      idStrategy: resolvedIdStrategy,
      localization: resolvedLocalization,
      publicApi: resolvedPublicApi,
      publicWrite: resolvedPublicWrite,
      publication: publicationEnabled,
      visibility: visibilityEnabled,
    }),
    search: resolvedSearch as ResolvedContentSearchConfig<
      ContentSearchEnabled<TSearch>
    >,
    tableName,
    visibility:
      resolvedVisibility as ResolvedContentVisibilityConfig<TVisibility>,
  };

  return definition;
};
