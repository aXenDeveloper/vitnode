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
