import type {
  AnyContentTypeDefinition,
  ContentAdminConfig,
  ContentDeliveryConfig,
  ContentDeliveryDescriptionField,
  ContentDeliveryEnabled,
  ContentDeliveryInput,
  ContentDeliveryNoIndexField,
  ContentDeliveryTitleField,
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
  ContentSchedulingEnabled,
  ContentSearchAuthorField,
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
  assertFieldAiAssist,
  assertFieldKind,
  assertFieldName,
  assertSlugSources,
  bindSelfRelations,
} from "./define-fields";
import { resolvePublicApi } from "./define-public-api";
import { resolveSearch } from "./define-search";
import {
  assertContentOptionShapes,
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
>({
  admin = {},
  delivery,
  editorial,
  fields,
  id,
  indexes = [],
  liveEditing,
  localization,
  publicApi,
  publication,
  search,
  tableName,
}: {
  admin?: ContentAdminConfig<
    TFields,
    TPublication,
    ContentEditorialEnabled<TEditorial>
  >;

  delivery?: TDelivery;

  editorial?: TEditorial;
  fields: TFields;
  id: TId;
  indexes?: ContentIndexInput<
    TFields,
    TPublication,
    ContentEditorialEnabled<TEditorial>
  >[];

  liveEditing?: ContentEditorialEnabled<TEditorial> extends true
    ? boolean
    : false;
  localization?: TLocalization;
  /**
   * Opts into a generated read-only public API. Needs `publication` and exactly
   * one exposed slug field. Omit it and nothing public is generated.
   */
  publicApi?: ContentPublicApiConfig<TPublicField, TPublicPath> | false;
  /** Opts into the draft/published lifecycle. Omit to stay on Stage 1 behaviour. */
  publication?: TPublication;

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
  ContentDeliveryEnabled<TDelivery>,
  TPublicPath
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
    editorial,
    localization,
    publicApi,
    publication,
    search,
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

  for (const name of fieldNames) {
    assertFieldName(id, name, publicationEnabled, editorialEnabled);
    assertFieldKind(id, name, fieldMap[name]);
    assertField(id, name, fieldMap[name]);
  }

  assertSlugSources(id, fieldMap);
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
    publicApi,
    publicationEnabled,
    localizedFields,
  );

  const resolvedSearch = resolveSearch(
    id,
    fieldMap,
    search,
    resolvedPublicApi,
    publicationEnabled,
    Object.keys(localizedFields).length > 0,
  );

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
    TPublicPath
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
    liveEditing: { enabled: liveEditing === true },
    localization: resolvedLocalization as ResolvedContentLocalizationConfig<
      ContentLocalizationEnabled<TLocalization>
    >,
    permissionModule,
    publication: {
      enabled: publicationEnabled as TPublication,
    },
    publicApi: resolvedPublicApi as ResolvedContentPublicApiConfig<
      TPublicField,
      TPublicEnabled,
      TPublicPath
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
        ContentDeliveryEnabled<TDelivery>,
        TPublicPath
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
