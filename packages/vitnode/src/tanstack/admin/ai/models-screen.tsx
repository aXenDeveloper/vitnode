import { useSuspenseQuery } from "@tanstack/react-query";

import {
  AdminStaffPermissionGate,
  useAdminStaffPermission,
} from "@/components/staff-permission/provider";
import { PageTitle } from "@/components/ui/page-title";
import { ADMIN_AI_PERMISSIONS } from "@/views/admin/views/core/ai/ai-permissions";
import {
  AiModelsContent,
  AiSyncPricingButton,
} from "@/views/admin/views/core/ai/models/models-content";

import type { AdminAiRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { adminAiModelsQuery, useAdminAiMutations } from "./query";
import { ADMIN_AI_NAMESPACES } from "./route";

export const AdminAiModelsRouteContent = ({
  adminUserId,
  description,
  title,
}: AdminAiRouteData) => {
  const { data } = useSuspenseQuery(adminAiModelsQuery({ adminUserId }));
  const { deletePricing, syncPricing, updatePricing } = useAdminAiMutations();
  const canManage = useAdminStaffPermission(ADMIN_AI_PERMISSIONS.manage);

  return (
    <RouteMessages namespaces={ADMIN_AI_NAMESPACES}>
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <PageTitle className="mb-0" desc={description} h1={title}>
          <AdminStaffPermissionGate {...ADMIN_AI_PERMISSIONS.manage}>
            <AiSyncPricingButton onSync={syncPricing} />
          </AdminStaffPermissionGate>
        </PageTitle>

        <AiModelsContent
          canManage={canManage}
          models={data.models}
          onDeletePricing={deletePricing}
          onSavePricing={updatePricing}
        />
      </div>
    </RouteMessages>
  );
};
