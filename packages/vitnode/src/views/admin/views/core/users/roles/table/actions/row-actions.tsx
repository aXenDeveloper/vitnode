"use client";

import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { CONFIG_PLUGIN } from "@/config";

import { DeleteAction } from "./delete-action";
import { EditAction } from "./edit-action";

interface RoleRowData {
  allowUploadFiles: boolean;
  color: null | string;
  default: boolean;
  grantsAdmin: boolean;
  guest: boolean;
  id: number;
  maxStorageForSubmit: null | number;
  name: { languageCode: string; name: string }[];
  protected: boolean;
  root: boolean;
  totalMaxStorage: null | number;
  usersCount: number;
}

export const RowActions = ({ data }: { data: RoleRowData }) => {
  const canEdit = useAdminStaffPermission({
    plugin: CONFIG_PLUGIN.pluginId,
    module: "roles",
    permission: "can_edit",
  });
  const canEditAdmin = useAdminStaffPermission({
    plugin: CONFIG_PLUGIN.pluginId,
    module: "roles",
    permission: "can_edit_admin",
  });
  const canDelete = useAdminStaffPermission({
    plugin: CONFIG_PLUGIN.pluginId,
    module: "roles",
    permission: "can_delete",
  });
  const canDeleteAdmin = useAdminStaffPermission({
    plugin: CONFIG_PLUGIN.pluginId,
    module: "roles",
    permission: "can_delete_admin",
  });

  // System roles (root/guest access and the default role for new sign-ups, plus
  // anything flagged protected) are required by the platform and cannot be
  // removed - only edited.
  const isSystem = data.protected || data.default || data.root || data.guest;

  // A role that grants admin access needs the elevated permission on top of the
  // base one - mirroring the backend guard in the update/delete routes.
  const showEdit = canEdit && (!data.grantsAdmin || canEditAdmin);
  const showDelete =
    canDelete && !isSystem && (!data.grantsAdmin || canDeleteAdmin);

  if (!showEdit && !showDelete) {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {showEdit && <EditAction data={data} />}
      {showDelete && <DeleteAction data={data} />}
    </div>
  );
};
