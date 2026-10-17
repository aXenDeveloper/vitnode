/**
 * One permission a plugin declares: its key (e.g. `"can_delete"`), or an object
 * when it has dependencies or a scope. Labels come from the plugin's locale
 * file as `"{pluginId}:{module}:{permission}"`.
 */
export type PermissionStaffEntryInput =
  | string
  | {
      /**
       * Permissions of the same module this one requires. The AdminCP staff
       * editor keeps them granted together, and a scoped moderator grant is
       * narrowed to the scope of its dependencies.
       */
      dependsOn?: string[];
      permission: string;
      /**
       * A moderation scope family id (e.g. `"forum.section"`), so the grant can
       * be limited to selected resources. Moderator permissions only.
       */
      scope?: string;
    };

/**
 * Author-facing module map - what a plugin declares in its API config.
 */
export type PermissionStaffModulesInput = Record<
  string,
  PermissionStaffEntryInput[]
>;

export interface PermissionStaffEntry {
  dependsOn: string[];
  permission: string;
  scope?: string;
}

export type PermissionStaffModules = Record<string, PermissionStaffEntry[]>;

/**
 * The staff permissions a plugin declares in `buildApiPlugin({ permissionStaff })`,
 * grouped by staff type and then by module.
 *
 * Core adds `can_view`/`can_create`/`can_edit`/`can_delete` for each content
 * type and container collection, unless the plugin declares that module
 * itself. Enforce an admin permission with `adminStaffPermission` in
 * `buildRoute`, or any permission with `assertStaffPermission`.
 *
 * @example
 * ```ts
 * permissionStaff: {
 *   admin: {
 *     posts: ["can_view", { permission: "can_delete", dependsOn: ["can_view"] }],
 *   },
 * }
 * ```
 */
export interface PermissionStaffConfig {
  /** Permissions grantable to AdminCP administrators. */
  admin?: PermissionStaffModulesInput;
  /** Permissions grantable to moderators. */
  moderator?: PermissionStaffModulesInput;
}

export type PermissionStaffType = "admin" | "moderator";

export const normalizePermissionStaffModules = (
  modules: PermissionStaffModulesInput = {},
): PermissionStaffModules =>
  Object.fromEntries(
    Object.entries(modules).map(([module, entries]) => [
      module,
      entries.map(entry =>
        typeof entry === "string"
          ? { permission: entry, dependsOn: [] }
          : {
              permission: entry.permission,
              dependsOn: entry.dependsOn ?? [],
              ...(entry.scope ? { scope: entry.scope } : {}),
            },
      ),
    ]),
  );

/** Limits a grant to every resource of a scope family, or to the selected ids. */
export type PermissionStaffScope =
  | { family: string; ids: string[]; mode: "selected" }
  | { family: string; mode: "all" };

/** One permission tuple: which plugin, module and permission key. */
export interface PermissionsStaffArgs {
  module: string;
  permission: string;
  plugin: string;
  scope?: PermissionStaffScope;
}

/** The resource a scoped permission is checked against, e.g. a forum section. */
export interface PermissionStaffResource {
  family: string;
  id: string;
}

/**
 * The catalog as aggregated onto the request context (`c.get("core").permissionStaff`).
 */
export interface PermissionStaffCatalogEntry {
  admin: PermissionStaffModules;
  moderator: PermissionStaffModules;
  pluginId: string;
}

/**
 * The resolved effective permissions for a user. `root` short-circuits every
 * check to `true`.
 */
export interface StaffPermissionSet {
  permissions: PermissionsStaffArgs[];
  root: boolean;
}

export interface ResolvedStaffPermissionSet extends StaffPermissionSet {
  staff: boolean;
}
