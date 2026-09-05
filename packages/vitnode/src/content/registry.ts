import type {
  PermissionStaffConfig,
  PermissionStaffEntryInput,
  PermissionStaffModulesInput,
} from "../api/lib/permission-staff";
import type { AnyContentTypeDefinition } from "./types";

import {
  CONTENT_ADMIN_CREATE_SEGMENT,
  CONTENT_ADMIN_EDIT_SEGMENT,
  CONTENT_EDITORIAL_FIELDS,
  CONTENT_PERMISSIONS,
  CONTENT_PUBLICATION_FIELDS,
  CONTENT_SYSTEM_FIELDS,
  isFilterableFieldKind,
  RESERVED_FILTER_KEYS,
} from "./const";
import { ContentEngineError } from "./errors";
import { partitionContentFields } from "./localization";

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

/** A physical table name, and the field or content type that generated it. */
interface TableOwner {
  entry: RegisteredContentType;
  /** How the name came about, for an error message somebody has to act on. */
  origin: string;
}

const describeTableOwner = (owner: TableOwner): string =>
  `${describe(owner.entry)} (${owner.origin})`;

/**
 * Every physical table one content type puts into the schema.
 *
 * The base table and the translation table are declared; a junction and a
 * repeatable child table are **generated** from a field name, clamped to
 * Postgres' 63-character limit. Two content types can therefore reach the same
 * physical name without either author writing it down - which Postgres would
 * accept, because the second `CREATE TABLE` simply never happens and both
 * definitions then read and write one table.
 */
const physicalTables = (
  entry: RegisteredContentType,
): { name: string; origin: string }[] => {
  const { definition } = entry;

  return [
    { name: definition.tableName, origin: "its base table" },
    ...(definition.localization.enabled
      ? [
          {
            name: definition.localization.translationTableName,
            origin: "its translation table",
          },
        ]
      : []),
    ...definition.advanced.junctions.map(junction => ({
      name: junction.tableName,
      origin: `the junction table of "${junction.field}"`,
    })),
    ...definition.advanced.repeatables.map(repeatable => ({
      name: repeatable.tableName,
      origin: `the child table of "${repeatable.field}"`,
    })),
  ];
};

/**
 * Every index and constraint name one content type puts into the schema.
 *
 * Same namespace problem as the tables, one level down: `UNIQUE (itemId,
 * position)` on a junction is named after the junction, which is named after a
 * field, which is clamped. Postgres keeps index and constraint names unique per
 * schema, so two of them colliding is a migration that fails at deploy time -
 * or, with the truncation, one that silently constrains the wrong table.
 */
const physicalIndexes = (
  entry: RegisteredContentType,
): { columns: string[]; name: string }[] => {
  const { definition } = entry;

  return [
    ...definition.indexes.map(index => ({
      columns: index.on,
      name: index.name,
    })),
    ...definition.localization.translationIndexes.map(index => ({
      columns: index.on,
      name: index.name,
    })),
    ...definition.advanced.junctions.flatMap(junction => [
      {
        columns: [`${junction.field} primary key`],
        name: junction.primaryKeyName,
      },
      {
        columns: [`${junction.field} position`],
        name: junction.positionIndexName,
      },
      {
        columns: [`${junction.field} target`],
        name: junction.relatedIndexName,
      },
    ]),
    ...definition.advanced.repeatables.map(repeatable => ({
      columns: [`${repeatable.field} position`],
      name: repeatable.positionIndexName,
    })),
  ];
};

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
 *
 * **Delivery paths and admin paths are the exceptions**, and the asymmetry is
 * deliberate: an API route carries the plugin id and a browser URL does not, so the
 * second is a site-wide namespace where the first is not. See `byDeliveryPath` and
 * `byAdminPath` below.
 */
export const validateContentTypes = (
  entries: RegisteredContentType[],
): RegisteredContentType[] => {
  const byId = new Map<string, RegisteredContentType>();
  const byTable = new Map<string, TableOwner>();
  const byPermission = new Map<string, RegisteredContentType>();
  const byPublicPath = new Map<string, RegisteredContentType>();
  /**
   * Delivery paths, keyed by the path alone.
   *
   * A **second** map rather than a different key on `byPublicPath`, because the two
   * namespaces are genuinely different and both have to be checked. A generated API
   * route is `/api/{pluginId}/content/{path}`, so `plugin-a` and `plugin-b` may both
   * publish `articles` - and forbidding that would make an app fail to boot over a
   * name neither author can see. A **canonical delivery URL** is `/articles/{slug}`
   * with no plugin id in it at all, so the same pair really would claim one site-wide
   * namespace and `/articles/example` would have two owners.
   */
  const byDeliveryPath = new Map<string, RegisteredContentType>();
  /**
   * AdminCP paths, keyed by the path alone - a site-wide namespace, like delivery
   * and for the same reason.
   *
   * `/admin/content/{admin.path}` has no plugin id in it, and one catch-all route
   * serves every content type: two of them answering to one path would give the
   * screen a first-registered-wins owner, and the other content type would simply
   * have no AdminCP at all. The id-derived default makes that nearly impossible;
   * `admin.path` is what makes it worth checking, because two plugins are each
   * free to think `blog/articles` is theirs.
   */
  const byAdminPath = new Map<string, RegisteredContentType>();
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

    // Base, translation, junction and child tables all in one map: they share
    // one Postgres namespace, so a content type called
    // `example_articles_translations` and a localized `example_articles` would
    // collide - and so would a repeatable called `tags` on `example_articles`
    // and a content type whose own table is `example_articles_tags`. The
    // shortening clamp makes every one of those reachable with two long names
    // that differ only past character 63, and Postgres truncates silently.
    for (const { name, origin } of physicalTables(entry)) {
      const owner = byTable.get(name);
      if (owner) {
        throw new ContentEngineError(
          `Table "${name}" is claimed by both ${describeTableOwner(owner)} and ${describeTableOwner({ entry, origin })}. Two content types cannot share a physical table - rename one of them, or the field that generates it.`,
          { contentTypeId: definition.id },
        );
      }
      byTable.set(name, { entry, origin });
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

    const adminPath = definition.admin.path;
    const duplicateAdminPath = byAdminPath.get(adminPath);
    if (duplicateAdminPath) {
      throw new ContentEngineError(
        `AdminCP path "${adminPath}" is claimed by both ${describe(duplicateAdminPath)} and ${describe(entry)}. One catch-all route serves /admin/content/${adminPath}, so only one of them would have a screen - give one a different \`admin.path\`.`,
        { contentTypeId: definition.id },
      );
    }
    byAdminPath.set(adminPath, entry);

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

      // Delivery is the exception, and only delivery. Its canonical URLs are
      // framework-neutral **site** paths - `/articles/my-article`,
      // `/pl/articles/moj-artykul` - built from `publicApi.path` with no plugin id in
      // them, so two delivery-enabled content types sharing a path would give
      // `/articles/example` two owners: two resolvers claiming one URL, two sitemaps
      // listing it, and one slug reservation table with no way to say which of them a
      // retired address belonged to.
      //
      // The fix is the check, not a prefix: adding the plugin id to the URL would
      // solve the ambiguity by making every public content URL uglier for everybody.
      if (definition.delivery.enabled) {
        const duplicateDeliveryPath = byDeliveryPath.get(path);
        if (duplicateDeliveryPath) {
          throw new ContentEngineError(
            `Delivery path "${path}" is claimed by both ${describe(duplicateDeliveryPath)} and ${describe(entry)}. Delivery paths are site-wide public namespaces and must be globally unique - give one of them a different \`publicApi.path\`, or turn \`delivery\` off on one of them.`,
            { contentTypeId: definition.id },
          );
        }
        byDeliveryPath.set(path, entry);
      }
    }

    // `resolveContentIndexes` already rejects a collision inside one content
    // type. Postgres index and constraint names are unique per *schema*,
    // though, so two content types - from one plugin or from two - cannot share
    // one either. The generated junction and repeatable names are in here too:
    // they are derived from a field name and clamped, so they are exactly the
    // ones nobody wrote down and nobody would think to check.
    for (const index of physicalIndexes(entry)) {
      const owner = byIndexName.get(index.name);
      if (owner) {
        throw new ContentEngineError(
          `Index name "${index.name}" is used by both ${describeIndexOwner(owner)} and ${describeIndexOwner({ columns: index.columns, entry })}. Postgres index names are unique per schema, so rename one of them.`,
          { contentTypeId: definition.id },
        );
      }
      byIndexName.set(index.name, { columns: index.columns, entry });
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

export const contentTypeToPath = (id: string): string =>
  id.split(".").join("/");

export type ContentAdminAddressable = Pick<AnyContentTypeDefinition, "admin">;

/** `/admin/content/blog/articles` */
export const contentAdminHref = (definition: ContentAdminAddressable): string =>
  `/admin/content/${definition.admin.path}`;

/**
 * `/admin/content/blog/articles/create` - the generated create **page**.
 *
 * Built off `contentAdminHref` rather than spelled out again, so the list URL
 * and the two form URLs cannot drift apart. Only meaningful for a content type
 * whose `admin.create.mode` is `page`; the resolver refuses it otherwise.
 */
export const contentCreateHref = (
  definition: ContentAdminAddressable,
): string => `${contentAdminHref(definition)}/${CONTENT_ADMIN_CREATE_SEGMENT}`;

/** `/admin/content/blog/articles/42/edit` - the generated edit **page**. */
export const contentEditHref = (
  definition: ContentAdminAddressable,
  itemId: number,
): string =>
  `${contentAdminHref(definition)}/${itemId}/${CONTENT_ADMIN_EDIT_SEGMENT}`;

/**
 * The edit URL with `{id}` still in it.
 *
 * A create page is a server component and the identifier only exists once the
 * mutation has answered, so the client half is handed a template rather than a
 * callback - a function cannot cross an RSC boundary, and a second copy of the
 * URL shape would be free to drift from {@link contentEditHref}.
 */
export const contentEditHrefTemplate = (
  definition: ContentAdminAddressable,
): string =>
  contentEditHref(
    definition,
    CONTENT_EDIT_HREF_PLACEHOLDER as unknown as number,
  );

/** The token {@link contentEditHrefTemplate} leaves behind for the client. */
export const CONTENT_EDIT_HREF_PLACEHOLDER = "{id}";

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
  // Localization adds no permission of its own. Writing a translation is
  // editing the record in one language, so it is `can_edit` - and a role that
  // may edit an article may edit every language of it.
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
 * Query-string keys the generated **admin list** route accepts as filters.
 *
 * The client-side reading of `filterShape(writableFields)` in
 * `content/schemas.ts`, and it has to stay the client-side reading of *that*
 * rather than a rule of its own. Two things depend on getting it right, and they
 * fail in opposite directions:
 *
 * - Claim a key the route ignores and it is carried in the URL and folded into
 *   a cache key, so two identical requests become two entries.
 * - Miss a key the route honours and a filter silently stops filtering - the
 *   list renders every record and nothing says why.
 *
 * Three rules, each mirroring one line of the schema:
 *
 * - **A filterable kind.** `CONTENT_FILTERABLE_FIELD_KINDS`, the same list the
 *   query builder branches on. A `group`, a `repeatable`, a `date` and a `file`
 *   have no filter and never did.
 * - **Not localized.** The schema filters `writableFields`, which is the shared
 *   and collection halves - a localized `slug` or `text` lives on the
 *   translation table and has no column on the row being filtered.
 * - **Plus `status`**, for a content type with publication. It is not a declared
 *   field, so nothing above would find it, and it is the one filter the AdminCP
 *   list actually uses in practice.
 *
 * Sorted, so the set is deterministic wherever it is compared or serialised.
 */
export const contentFilterableFields = (
  definition: AnyContentTypeDefinition,
): string[] => {
  const { collectionFields, sharedFields } = partitionContentFields(
    definition.fields,
  );

  return [
    ...Object.entries({ ...sharedFields, ...collectionFields })
      .filter(([, field]) => isFilterableFieldKind(field.kind))
      .map(([name]) => name),
    ...(definition.publication.enabled ? ["status"] : []),
  ].sort((a, b) => a.localeCompare(b));
};

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
