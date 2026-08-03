import type {
  PermissionStaffConfig,
  PermissionStaffEntryInput,
  PermissionStaffModulesInput,
} from "../api/lib/permission-staff";
import type { AnyContentTypeDefinition } from "./types";

import {
  CONTENT_PERMISSIONS,
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
 */
export const validateContentTypes = (
  entries: RegisteredContentType[],
): RegisteredContentType[] => {
  const byId = new Map<string, RegisteredContentType>();
  const byTable = new Map<string, RegisteredContentType>();
  const byPermission = new Map<string, RegisteredContentType>();
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

    // `resolveContentIndexes` already rejects a collision inside one content
    // type. Postgres index names are unique per *schema*, though, so two
    // content types - from one plugin or from two - cannot share one either.
    for (const index of definition.indexes) {
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
 * The four permissions every content type gets. `can_view` gates the list and
 * the nav item; the writes depend on it so a role cannot create rows it cannot
 * see.
 */
export const contentPermissionEntries = (): PermissionStaffEntryInput[] => [
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
    admin[definition.permissionModule] = contentPermissionEntries();
  }

  return { ...permissionStaff, admin };
};

/** Column names a generated route may order by. */
export const orderableColumns = (
  definition: AnyContentTypeDefinition,
): string[] => [
  ...definition.admin.list.orderableFields,
  ...CONTENT_SYSTEM_FIELDS,
];
