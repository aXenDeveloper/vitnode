import type {
  PermissionStaffConfig,
  PermissionStaffEntryInput,
  PermissionStaffModulesInput,
} from "../api/lib/permission-staff";
import type { AnyContentTypeDefinition } from "./types";

import {
  CONTENT_EDITORIAL_FIELDS,
  CONTENT_PERMISSIONS,
  CONTENT_PUBLICATION_FIELDS,
  CONTENT_SYSTEM_FIELDS,
  RESERVED_FILTER_KEYS,
} from "./const";
import { ContentEngineError } from "./errors";

/** A definition plus the plugin that registered it. */
export interface RegisteredContentType {
  definition: AnyContentTypeDefinition;
  pluginId: string;
}

const describe = (entry: RegisteredContentType): string =>
  `${entry.pluginId} -> ${entry.definition.id}`;

const describeIndexOwner = (owner: IndexOwner): string =>
  `${describe(owner.entry)} (table "${owner.entry.definition.tableName}", columns [${owner.columns.join(", ")}])`;

interface IndexOwner {
  columns: string[];
  entry: RegisteredContentType;
}

/**
 * Validates a set of content types coming from one or more plugins.
 *
 * Runs at boot (or at plugin build time), never per request, so a
 * misconfiguration fails loudly and immediately. Returns the entries sorted by
 * id so registries stay deterministic across processes.
 *
 * This is the only place that sees *every* installed content type at once,
 * which makes it the only place that can catch a schema-wide clash: a duplicate
 * table name, or two content types resolving to the same Postgres index name.
 * Permission modules and public paths are checked per plugin, because the
 * plugin id is part of the key each one is addressed by.
 */
export const validateContentTypes = (
  entries: RegisteredContentType[],
): RegisteredContentType[] => {
  const byId = new Map<string, RegisteredContentType>();
  const byTable = new Map<string, RegisteredContentType>();
  const byPermission = new Map<string, RegisteredContentType>();
  const byPublicPath = new Map<string, RegisteredContentType>();
  const byIndexName = new Map<string, IndexOwner>();

  for (const entry of entries) {
    const { definition, pluginId } = entry;

    const duplicateId = byId.get(definition.id);
    if (duplicateId) {
      throw new ContentEngineError(
        `Duplicate content type id, registered by both ${describe(duplicateId)} and ${describe(entry)}.`,
        { contentTypeId: definition.id },
      );
    }
    byId.set(definition.id, entry);

    const duplicateTable = byTable.get(definition.tableName);
    if (duplicateTable) {
      throw new ContentEngineError(
        `Table "${definition.tableName}" is claimed by both ${describe(duplicateTable)} and ${describe(entry)}.`,
        { contentTypeId: definition.id },
      );
    }
    byTable.set(definition.tableName, entry);

    // The generated translation table shares one namespace with every base
    // table, so a content type called `example_articles_translations` and a
    // localized `example_articles` would collide - and the shortening clamp
    // makes that reachable with two long names that differ only past character
    // 63. Both directions are caught by holding one map.
    if (definition.localization.enabled) {
      const translationTable = definition.localization.translationTableName;
      const duplicateTranslationTable = byTable.get(translationTable);
      if (duplicateTranslationTable) {
        throw new ContentEngineError(
          `Translation table "${translationTable}" is claimed by both ${describe(duplicateTranslationTable)} and ${describe(entry)}. Rename one of the base tables.`,
          { contentTypeId: definition.id },
        );
      }
      byTable.set(translationTable, entry);
    }

    // Permission modules are scoped per plugin, so only a collision inside one
    // plugin is ambiguous.
    const permissionKey = `${pluginId}:${definition.permissionModule}`;
    const duplicatePermission = byPermission.get(permissionKey);
    if (duplicatePermission) {
      throw new ContentEngineError(
        `Permission module "${definition.permissionModule}" is derived by both ${describe(duplicatePermission)} and ${describe(entry)}. Set \`admin.permissionModule\` on one of them.`,
        { contentTypeId: definition.id },
      );
    }
    byPermission.set(permissionKey, entry);

    assertFilterKeys(definition);

    // Scoped per plugin, like permission modules and for the same reason: the
    // route is `/api/{pluginId}/content/{path}`, so the plugin id already
    // separates two of them. Two plugins both publishing "articles" is normal
    // and works; forbidding it would make an app fail to boot over a name
    // neither author can see, and force one of them to rename a public URL.
    // Inside one plugin the two really would collide, so that is an error.
    if (definition.publicApi.enabled) {
      const path = definition.publicApi.path;
      const pathKey = `${pluginId}:${path}`;
      const duplicatePath = byPublicPath.get(pathKey);
      if (duplicatePath) {
        throw new ContentEngineError(
          `Public path "${path}" is claimed by both ${describe(duplicatePath)} and ${describe(entry)}. Give one of them a different \`publicApi.path\`.`,
          { contentTypeId: definition.id },
        );
      }
      byPublicPath.set(pathKey, entry);
    }

    // `resolveContentIndexes` already rejects a collision inside one content
    // type. Postgres index names are unique per *schema*, though, so two
    // content types - from one plugin or from two - cannot share one either.
    for (const index of [
      ...definition.indexes,
      ...definition.localization.translationIndexes,
    ]) {
      const owner = byIndexName.get(index.name);
      if (owner) {
        throw new ContentEngineError(
          `Index name "${index.name}" is used by both ${describeIndexOwner(owner)} and ${describeIndexOwner({ columns: index.on, entry })}. Postgres index names are unique per schema, so rename one of them.`,
          { contentTypeId: definition.id },
        );
      }
      byIndexName.set(index.name, { columns: index.on, entry });
    }
  }

  return [...entries].sort((a, b) =>
    a.definition.id.localeCompare(b.definition.id),
  );
};

const reservedFilterKeys: readonly string[] = RESERVED_FILTER_KEYS;

/**
 * A field named `search`, `cursor`, `first`, ... would shadow a pagination
 * query parameter on the generated list route.
 */
const assertFilterKeys = (definition: AnyContentTypeDefinition): void => {
  const fields = definition.fields;
  const clash = Object.keys(fields).find(name =>
    reservedFilterKeys.includes(name),
  );

  if (clash !== undefined) {
    throw new ContentEngineError(
      `Field "${clash}" collides with the "${clash}" pagination query parameter. Rename the field.`,
      { contentTypeId: definition.id },
    );
  }
};

export const findContentTypeById = (
  entries: readonly RegisteredContentType[],
  id: string,
): RegisteredContentType | undefined =>
  entries.find(entry => entry.definition.id === id);

/** `example.article` -> `example/article`, for `/admin/content/[...slug]`. */
export const contentTypeToPath = (id: string): string =>
  id.split(".").join("/");

/** `["example", "article"]` -> `example.article`. */
export const pathToContentTypeId = (slug: readonly string[]): string =>
  slug.join(".");

/** `/admin/content/example/article` */
export const contentAdminHref = (id: string): string =>
  `/admin/content/${contentTypeToPath(id)}`;

/**
 * The permissions every content type gets. `can_view` gates the list and the
 * nav item; the writes depend on it so a role cannot create rows it cannot see.
 *
 * `can_publish` is added only for a content type with publication enabled -
 * publishing is the one generated operation that changes what anonymous
 * visitors can see, so it is worth its own gate. It depends on `can_view` like
 * the rest, which leaves "may publish but not edit" expressible.
 */
export const contentPermissionEntries = (
  definition?: AnyContentTypeDefinition,
): PermissionStaffEntryInput[] => [
  CONTENT_PERMISSIONS.view,
  {
    dependsOn: [CONTENT_PERMISSIONS.view],
    permission: CONTENT_PERMISSIONS.create,
  },
  {
    dependsOn: [CONTENT_PERMISSIONS.view],
    permission: CONTENT_PERMISSIONS.edit,
  },
  {
    dependsOn: [CONTENT_PERMISSIONS.view],
    permission: CONTENT_PERMISSIONS.delete,
  },
  ...(definition?.publication.enabled
    ? [
        {
          dependsOn: [CONTENT_PERMISSIONS.view],
          permission: CONTENT_PERMISSIONS.publish,
        },
      ]
    : []),
  // Restoring is the one generated operation that rewrites many fields at once
  // from a source the editor did not type, so it gets its own gate. It depends
  // on `can_edit` rather than `can_view`: somebody who may not edit must not
  // reach the same outcome through the history.
  ...(definition?.editorial.enabled
    ? [
        {
          dependsOn: [CONTENT_PERMISSIONS.edit],
          permission: CONTENT_PERMISSIONS.restore,
        },
      ]
    : []),
];

/**
 * Merges the derived content permissions into a plugin's `permissionStaff`.
 * An explicitly declared module always wins, so a plugin can still hand-tune
 * the permissions of a generated content type.
 */
export const withContentPermissions = (
  permissionStaff: PermissionStaffConfig | undefined,
  entries: readonly RegisteredContentType[],
): PermissionStaffConfig | undefined => {
  if (entries.length === 0) return permissionStaff;

  const admin: PermissionStaffModulesInput = { ...permissionStaff?.admin };

  for (const { definition } of entries) {
    if (admin[definition.permissionModule]) continue;
    admin[definition.permissionModule] = contentPermissionEntries(definition);
  }

  return { ...permissionStaff, admin };
};

/**
 * Column names a generated route may order by. System columns - and the
 * publication columns when enabled - are always allowed, so they need no entry
 * in `admin.list.orderableFields`.
 */
export const orderableColumns = (
  definition: AnyContentTypeDefinition,
): string[] => [
  ...definition.admin.list.orderableFields,
  ...CONTENT_SYSTEM_FIELDS,
  ...(definition.publication.enabled ? CONTENT_PUBLICATION_FIELDS : []),
  ...(definition.editorial.enabled ? CONTENT_EDITORIAL_FIELDS : []),
];

/**
 * Column names the *public* list route may order by.
 *
 * Deliberately not `orderableColumns`: the admin allowlist includes system
 * columns and every field an editor may sort by, and reusing it would let an
 * anonymous request order by a column the projection does not expose. Already
 * resolved at definition time, so this only restates where it lives.
 */
export const publicOrderableColumns = (
  definition: AnyContentTypeDefinition,
): string[] => definition.publicApi.orderableFields;
