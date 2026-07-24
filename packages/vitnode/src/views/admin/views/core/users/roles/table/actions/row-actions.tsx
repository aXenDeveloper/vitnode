"use client";

import { DeleteAction } from "./delete-action";
import { EditAction } from "./edit-action";

interface RoleRowData {
  allowUploadFiles: boolean;
  color: null | string;
  default: boolean;
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
  // System roles (root/guest access and the default role for new sign-ups, plus
  // anything flagged protected) are required by the platform and cannot be
  // removed - only edited.
  const isSystem = data.protected || data.default || data.root || data.guest;

  return (
    <div className="flex items-center justify-end gap-1">
      <EditAction data={data} />
      {!isSystem && <DeleteAction data={data} />}
    </div>
  );
};
