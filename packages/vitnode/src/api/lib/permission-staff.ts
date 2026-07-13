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
 *
 * A permission may be declared as a plain string, or as an object that lists the
 * other permissions (in the same module) it `dependsOn`. The staff form only
 * shows a permission once every permission it depends on is enabled - e.g.
 * `{ permission: "can_create", dependsOn: ["can_view"] }` stays hidden until
 * `can_view` is on.
 */
export type PermissionStaffEntryInput =
  string | { dependsOn?: string[]; permission: string };

/**
 * Author-facing module map - what a plugin declares in its API config.
 */
export type PermissionStaffModulesInput = Record<
  string,
  PermissionStaffEntryInput[]
>;

/**
 * A permission entry after normalization - the shape carried on the request
 * context and returned by the permission catalog. `dependsOn` is always an
 * array (empty when the permission has no prerequisites).
 */
export interface PermissionStaffEntry {
  dependsOn: string[];
  permission: string;
}

export type PermissionStaffModules = Record<string, PermissionStaffEntry[]>;

export interface PermissionStaffConfig {
  admin?: PermissionStaffModulesInput;
  moderator?: PermissionStaffModulesInput;
}

export type PermissionStaffType = "admin" | "moderator";

/**
 * Normalizes the author-facing module map into the canonical
 * `{ permission, dependsOn }` shape, so every downstream reader deals with a
 * single shape regardless of how the plugin declared it.
 */
export const normalizePermissionStaffModules = (
  modules: PermissionStaffModulesInput = {},
): PermissionStaffModules =>
  Object.fromEntries(
    Object.entries(modules).map(([module, entries]) => [
      module,
      entries.map(entry =>
        typeof entry === "string"
          ? { permission: entry, dependsOn: [] }
          : { permission: entry.permission, dependsOn: entry.dependsOn ?? [] },
      ),
    ]),
  );

/**
 * A single granted permission stored against a staff entry. A staff entry's
 * `unrestricted` column grants every permission for the staff type (and any
 * added in the future); when `false`, only the entries in its `permissions`
 * column apply.
 */
export interface PermissionsStaffArgs {
  module: string;
  permission: string;
  plugin: string;
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
