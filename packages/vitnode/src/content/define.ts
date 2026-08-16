import type {
  AnyContentTypeDefinition,
  ContentAdminConfig,
  ContentDeliveryConfig,
  ContentDeliveryDescriptionField,
  ContentDeliveryEnabled,
  ContentDeliveryNoIndexField,
  ContentDeliveryTitleField,
  ContentEditorialConfig,
  ContentEditorialEnabled,
  ContentFieldMap,
  ContentFieldsConstraint,
  ContentIndexInput,
  ContentLocalizationConfig,
  ContentLocalizationEnabled,
  ContentPreviewEnabled,
  ContentPublicApiConfig,
  ContentPublicationConfig,
  ContentPublicExposableField,
  ContentSchedulingEnabled,
  ContentSearchConfig,
  ContentSearchDescriptionField,
  ContentSearchEnabled,
  ContentSearchTextField,
  ContentSearchTitleField,
  ContentTypeDefinition,
  ResolvedContentDeliveryConfig,
  ResolvedContentEditorialConfig,
  ResolvedContentLocalizationConfig,
  ResolvedContentPublicApiConfig,
  ResolvedContentSearchConfig,
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
import { resolveAdmin } from "./define-admin";
import { resolveEditorial } from "./define-editorial";
import {
  assertField,
  assertFieldKind,
  assertFieldName,
  assertSlugSources,
  bindSelfRelations,
} from "./define-fields";
import { resolvePublicApi } from "./define-public-api";
import { resolveSearch } from "./define-search";
import {
  assertKnownColumns,
  editorialFields,
  publicationFields,
  systemFields,
} from "./define-shared";
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

/**
 * Checks that every column an index names is one it can actually be built on.
 *
 * A repeatable leaf and a to-many relation are refused **loudly** rather than
 * silently dropped: `{ on: ["faq.answer"] }` looks like it works, and an index
 * that was quietly not created is a performance bug nobody can see. Both live on
 * their own generated tables, which already carry the indexes they need.
 */
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
          : `indexes names the localized field "${owner}", which is not a column on the base table. Localized values get their own AdminCP surface in Stage 5B.`,
        { contentTypeId: id },
      );
    }

    if (!fieldValue) continue;

    if (fieldValue.kind === "repeatable") {
      throw new ContentEngineError(
        `indexes names "${name}", which belongs to the repeatable "${owner}". Repeatable leaves are columns on a generated child table, not on the base table, so an index here would have nothing to cover. The child table already carries \`(itemId, position)\`.`,
        { contentTypeId: id },
      );
    }

    if (isContentReferenceCollection(fieldValue)) {
      throw new ContentEngineError(
        `indexes names the to-many relation "${owner}", which is not a column: its values live in a generated junction table, which already carries its own primary key and reverse index.`,
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

/**
 * Declares a content type. The result is plain data - zod and objects only -
 * so the same definition can be imported by `buildPlugin` (client) and by
 * `createContentModel` in `src/database/*.ts` (server) without dragging Drizzle
 * into a client bundle.
 */
export const defineContentType = <
  TId extends string,
  TFields extends ContentFieldsConstraint<
    TPublication,
    ContentEditorialEnabled<TEditorial>
  >,
  TPublication extends boolean = false,
  TPublicField extends ContentPublicExposableField<TFields> = never,
  TPublicEnabled extends boolean = false,
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
        ContentSearchTextField<TFields, TPublicField>
      >
    | { enabled: false } = { enabled: false },
  // The whole `editorial` argument, inferred as one type, for the same two
  // reasons `TSearch` is: its constraint is checked once `TPublicEnabled` and
  // `TPublication` are resolved - which is what makes "preview needs a public
  // API" and "scheduling needs publication" compile errors - and an
  // intersection member is not an inference site, so inferring the object is
  // the only way the three `enabled` literals survive.
  TEditorial extends
    ContentEditorialConfig<TPublicEnabled, TPublication> | { enabled: false } =
    { enabled: false },
  // The whole `localization` argument, inferred as one type, for the same reason
  // `TSearch` and `TEditorial` are: an intersection member is not an inference
  // site, so this is the only way the `enabled` literal survives - and every
  // conditional that decides whether a translation table, translation schemas
  // and a translation service exist reads that literal.
  TLocalization extends ContentLocalizationConfig | { enabled: false } = {
    enabled: false;
  },
  // The whole `delivery` argument, inferred as one type, for the same two reasons
  // `TSearch` and `TEditorial` are. Its *constraint* is what enforces the field
  // rules - a constraint is checked once `TPublicField` and `TPublicEnabled` are
  // resolved, which is what makes "delivery needs a public API" and "an SEO field
  // has to be public" compile errors rather than boot-time ones.
  TDelivery extends
    | ContentDeliveryConfig<
        TPublicEnabled,
        ContentEditorialEnabled<TEditorial>,
        ContentDeliveryTitleField<TFields, TPublicField>,
        ContentDeliveryDescriptionField<TFields, TPublicField>,
        ContentDeliveryNoIndexField<TFields, TPublicField>
      >
    | { enabled: false } = { enabled: false },
>({
  admin = {},
  delivery,
  editorial,
  fields,
  id,
  indexes = [],
  localization,
  publicApi,
  publication,
  search,
  tableName,
}: {
  /**
   * How the AdminCP presents this content type. Every key has a default, so a
   * content type that wants the generated screens as they come omits it - the
   * record's name is a translation, not something declared here.
   */
  admin?: ContentAdminConfig<
    TFields,
    TPublication,
    ContentEditorialEnabled<TEditorial>
  >;
  /**
   * Opts into the delivery layer: canonical URLs, slug history, automatic
   * redirects, localized alternates, `hreflang`, SEO projection and sitemap
   * entries. Needs `publicApi`, and every SEO field it names has to be in
   * `publicApi.fields`. Omit it and nothing about the content type changes.
   */
  delivery?: TDelivery;
  /**
   * Opts into the editorial workflow: a `version` column, optimistic locking
   * and revision history, plus optional preview and scheduling. Omit it and
   * nothing changes.
   */
  editorial?: TEditorial;
  fields: TFields;
  id: TId;
  indexes?: ContentIndexInput<
    TFields,
    TPublication,
    ContentEditorialEnabled<TEditorial>
  >[];
  /**
   * Opts into per-language content: every field marked `localized: true` moves
   * into a generated `<tableName>_translations` table, one row per language.
   * Omit it and nothing changes.
   */
  localization?: TLocalization;
  /**
   * Opts into a generated read-only public API. Needs `publication` and exactly
   * one exposed slug field. Omit it and nothing public is generated.
   */
  publicApi?:
    ContentPublicApiConfig<TPublicField> | { enabled: TPublicEnabled };
  /** Opts into the draft/published lifecycle. Omit to stay on Stage 1 behaviour. */
  publication?: ContentPublicationConfig | { enabled: TPublication };
  /**
   * Opts into automatic search synchronization. Needs `publication` and
   * `publicApi`, and every indexed field must be in `publicApi.fields`. Omit it
   * and nothing is indexed.
   */
  search?: TSearch;
  tableName: string;
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
  ContentDeliveryEnabled<TDelivery>
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

  const publicationEnabled = publication?.enabled === true;
  const editorialEnabled = editorial?.enabled === true;

  for (const name of fieldNames) {
    assertFieldName(id, name, publicationEnabled, editorialEnabled);
    assertFieldKind(id, name, fieldMap[name]);
    assertField(id, name, fieldMap[name]);
  }

  assertSlugSources(id, fieldMap);

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
    // The `{ enabled: TPublicEnabled }` arm of the parameter exists only so an
    // `enabled: false` literal still typechecks; `resolvePublicApi` returns the
    // disabled config for anything that is not `enabled: true`.
    publicApi as ContentPublicApiConfig<TPublicField> | undefined,
    publicationEnabled,
    localizedFields,
  );

  const resolvedSearch = resolveSearch(
    id,
    fieldMap,
    // Same shape of widening as `publicApi` above: the `{ enabled: false }` arm
    // exists only so an explicit literal typechecks.
    search as ContentSearchConfig | undefined,
    resolvedPublicApi,
    publicationEnabled,
    Object.keys(localizedFields).length > 0,
  );

  const resolvedEditorial = resolveEditorial(
    id,
    // The `{ enabled: false }` arm of the parameter exists only so an explicit
    // literal typechecks - the same widening `publicApi` and `search` do.
    editorial as ContentEditorialConfig | undefined,
    resolvedPublicApi,
    publicationEnabled,
  );

  // Last, because it reads the field partition every other resolver has already
  // been checked against. There is no capability it refuses any more: every
  // subsystem reads the language it was asked for.
  const resolvedLocalization = resolveContentLocalization({
    fields: fieldMap,
    id,
    // The `{ enabled: false }` arm exists only so an explicit literal
    // typechecks - the same widening `publicApi`, `search` and `editorial` do.
    localization: localization as ContentLocalizationConfig | undefined,
    publication: publicationEnabled,
    tableName,
  });

  // After localization, because "which language owns a historical URL" is read
  // off the field partition, and after `publicApi`, because every canonical path
  // and every SEO field is stated in terms of the resolved public allowlist.
  const resolvedDelivery = resolveContentDelivery({
    // The `{ enabled: false }` arm exists only so an explicit literal typechecks -
    // the same widening `publicApi`, `search`, `editorial` and `localization` do.
    delivery: delivery as ContentDeliveryConfig | undefined,
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
    ContentDeliveryEnabled<TDelivery>
  > = {
    admin: resolvedAdmin,
    advanced: resolvedAdvanced,
    delivery: resolvedDelivery as ResolvedContentDeliveryConfig<
      ContentDeliveryEnabled<TDelivery>
    >,
    editorial: resolvedEditorial as ResolvedContentEditorialConfig<
      ContentEditorialEnabled<TEditorial>,
      ContentPreviewEnabled<TEditorial>,
      ContentSchedulingEnabled<TEditorial>
    >,
    // The rebound copy, so a self-relation resolves rather than throwing.
    fields: fieldMap as unknown as TFields,
    id,
    indexes: resolvedIndexes,
    localization: resolvedLocalization as ResolvedContentLocalizationConfig<
      ContentLocalizationEnabled<TLocalization>
    >,
    permissionModule,
    publication: {
      enabled: publicationEnabled as TPublication,
    },
    publicApi: resolvedPublicApi as ResolvedContentPublicApiConfig<
      TPublicField,
      TPublicEnabled
    >,
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
        ContentDeliveryEnabled<TDelivery>
      >
    >({
      admin: resolvedAdmin,
      advanced: resolvedAdvanced,
      editorial: editorialEnabled,
      fields: fieldMap,
      localization: resolvedLocalization,
      publicApi: resolvedPublicApi,
      publication: publicationEnabled,
    }),
    search: resolvedSearch as ResolvedContentSearchConfig<
      ContentSearchEnabled<TSearch>
    >,
    tableName,
  };

  return definition;
};
