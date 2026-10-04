import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";

import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { PageTitle } from "@/components/ui/page-title";
import { ADMIN_AI_PERMISSIONS } from "@/views/admin/views/core/ai/ai-permissions";
import { AiSettingsFormContent } from "@/views/admin/views/core/ai/settings/settings-form-content";

import type { AdminAiRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { adminAiSettingsQuery, useAdminAiMutations } from "./query";
import { ADMIN_AI_NAMESPACES } from "./route";

const AiSettingsBody = ({
  adminUserId,
}: Pick<AdminAiRouteData, "adminUserId">) => {
  const t = useTranslations("admin.ai.settings");
  const { data } = useSuspenseQuery(adminAiSettingsQuery({ adminUserId }));
  const { updateSettings } = useAdminAiMutations();
  const canManage = useAdminStaffPermission(ADMIN_AI_PERMISSIONS.manage);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {t("time_zone", { timeZone: data.timeZone })}
      </p>
      <AiSettingsFormContent
        canManage={canManage}
        data={data}
        onSave={updateSettings}
      />
    </div>
  );
};

export const AdminAiSettingsRouteContent = ({
  adminUserId,
  description,
  title,
}: AdminAiRouteData) => (
  <RouteMessages namespaces={ADMIN_AI_NAMESPACES}>
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <PageTitle className="mb-0" desc={description} h1={title} />
      <AiSettingsBody adminUserId={adminUserId} />
    </div>
  </RouteMessages>
);
