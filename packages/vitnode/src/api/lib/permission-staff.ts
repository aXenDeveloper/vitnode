export type PermissionStaffEntryInput =
  string | { dependsOn?: string[]; permission: string };

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
}

export type PermissionStaffModules = Record<string, PermissionStaffEntry[]>;

export interface PermissionStaffConfig {
  admin?: PermissionStaffModulesInput;
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
          : { permission: entry.permission, dependsOn: entry.dependsOn ?? [] },
      ),
    ]),
  );

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
