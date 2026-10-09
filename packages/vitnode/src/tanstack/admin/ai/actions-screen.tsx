import { useSuspenseQuery } from "@tanstack/react-query";

import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { PageTitle } from "@/components/ui/page-title";
import { AiActionsContent } from "@/views/admin/views/core/ai/actions/actions-content";
import { ADMIN_AI_PERMISSIONS } from "@/views/admin/views/core/ai/ai-permissions";

import type { AdminAiRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import {
  adminAiActionsQuery,
  adminAiModelsQuery,
  useAdminAiMutations,
} from "./query";
import { ADMIN_AI_NAMESPACES } from "./route";

export const AdminAiActionsRouteContent = ({
  adminUserId,
  description,
  title,
}: AdminAiRouteData) => {
  const { data } = useSuspenseQuery(adminAiActionsQuery({ adminUserId }));
  const { data: modelsData } = useSuspenseQuery(
    adminAiModelsQuery({ adminUserId }),
  );
  const { updateAction } = useAdminAiMutations();
  const canManage = useAdminStaffPermission(ADMIN_AI_PERMISSIONS.manage);

  return (
    <RouteMessages namespaces={ADMIN_AI_NAMESPACES}>
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <PageTitle className="mb-0" desc={description} h1={title} />

        <AiActionsContent
          actions={data.actions}
          canManage={canManage}
          models={modelsData.models}
          onSave={updateAction}
        />
      </div>
    </RouteMessages>
  );
};
