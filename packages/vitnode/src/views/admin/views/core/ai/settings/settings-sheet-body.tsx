import { useSuspenseQuery } from "@tanstack/react-query";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { useAdminStaffPermission } from "@/components/staff-permission/provider";

import type { AiSettingsFormProps } from "./settings-form-content";

import { ADMIN_AI_PERMISSIONS } from "../ai-permissions";
import { adminAiSettingsQueryOptions } from "../ai-query";
import { AiSettingsFormContent } from "./settings-form-content";

export const AiSettingsSheetBody = ({
  adminUserId,
  onSave,
}: Pick<AiSettingsFormProps, "onSave"> & {
  adminUserId: AdminIdentity;
}) => {
  const { data } = useSuspenseQuery(
    adminAiSettingsQueryOptions({ adminUserId }),
  );
  const canManage = useAdminStaffPermission(ADMIN_AI_PERMISSIONS.manage);

  return (
    <AiSettingsFormContent canManage={canManage} data={data} onSave={onSave} />
  );
};
