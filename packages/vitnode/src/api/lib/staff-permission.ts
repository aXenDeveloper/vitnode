import type {
  PermissionsStaffArgs,
  StaffPermissionSet,
} from "./permission-staff";

export const hasStaffPermission = (
  set: StaffPermissionSet,
  args: PermissionsStaffArgs,
): boolean => {
  if (set.root) return true;

  return set.permissions.some(
    permission =>
      permission.plugin === args.plugin &&
      permission.module === args.module &&
      permission.permission === args.permission,
  );
};

export const staffPermissionKey = ({
  plugin,
  module,
  permission,
}: PermissionsStaffArgs): string => `${plugin}:${module}:${permission}`;

/**
 * Nobody's permissions - the answer when there is no admin session to read one
 * from.
 *
 * Shared rather than written out at each call site, because three of them
 * existed and each was one typo away from being `{ root: true }`. Frozen so a
 * reader cannot push into the array it holds and quietly grant a permission to
 * every other reader of the same value.
 *
 * It is a *fallback*, never a failure signal: a rejected session read must not
 * arrive here as "this admin has no permissions". See `AdminStaffPermission`'s
 * provider, which mounts this only when the session genuinely answered without
 * one.
 */
const NO_PERMISSIONS: PermissionsStaffArgs[] = [];
Object.freeze(NO_PERMISSIONS);

export const EMPTY_STAFF_PERMISSION_SET: StaffPermissionSet = Object.freeze({
  root: false,
  permissions: NO_PERMISSIONS,
});
