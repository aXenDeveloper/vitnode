/**
 * Plugin-based staff permission catalog.
 *
 * A plugin declares, in its API config, which permissions exist for moderators
 * and for admins. Permissions are grouped by module string, mirroring the way a
 * plugin is split into modules elsewhere in the API.
 *
 * The i18n label for each permission lives in the plugin's locale file under the
 * flat top-level key `{pluginId}:{module}:{permission}` (e.g.
 * `@vitnode/blog:posts:can_delete`).
 */
export type PermissionStaffModules = Record<string, string[]>;

export interface PermissionStaffConfig {
  admin?: PermissionStaffModules;
  moderator?: PermissionStaffModules;
}

export type PermissionStaffType = "admin" | "moderator";

/**
 * A single granted permission stored against a staff entry.
 */
export interface PermissionsStaffArgs {
  module: string;
  permission: string;
  plugin: string;
}

/**
 * The value persisted in a staff entry's `data` jsonb column.
 *
 * `unrestricted` grants every permission for the staff type (and any added in
 * the future); when `false`, only the explicitly listed `permissions` apply.
 */
export interface StaffPermissionsData {
  permissions: PermissionsStaffArgs[];
  unrestricted: boolean;
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
