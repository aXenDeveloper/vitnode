import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { ReportReasonSheetState } from "@/views/admin/views/core/moderation/report-reasons/report-reasons-content";

import {
  AdminStaffPermissionGate,
  useAdminStaffPermission,
} from "@/components/staff-permission/provider";
import { PageTitle } from "@/components/ui/page-title";
import {
  CreateReportReasonButton,
  ReportReasonsContent,
} from "@/views/admin/views/core/moderation/report-reasons/report-reasons-content";
import { ADMIN_REPORT_REASON_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { AdminReportReasonsRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { useAdminIdentity } from "../identity";
import {
  adminReportReasonsQuery,
  useAdminReportReasonMutations,
} from "./query";
import { ADMIN_REPORT_REASONS_NAMESPACES } from "./route";

const ReportReasonsScreen = ({
  description,
  title,
}: AdminReportReasonsRouteData) => {
  const t = useTranslations("admin.moderation.report_reasons");
  const adminUserId = useAdminIdentity();
  const { data } = useSuspenseQuery(adminReportReasonsQuery(adminUserId));
  const { onDelete, onReorder, onSave } = useAdminReportReasonMutations();
  const canEdit = useAdminStaffPermission(ADMIN_REPORT_REASON_PERMISSIONS.edit);
  const canDelete = useAdminStaffPermission(
    ADMIN_REPORT_REASON_PERMISSIONS.delete,
  );
  const [sheet, setSheet] = React.useState<ReportReasonSheetState>({
    mode: "create",
  });
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const openSheet = (state: ReportReasonSheetState) => {
    setSheet(state);
    setSheetOpen(true);
  };

  return (
    <div className="p-6">
      <PageTitle desc={description} h1={title}>
        <AdminStaffPermissionGate {...ADMIN_REPORT_REASON_PERMISSIONS.create}>
          <CreateReportReasonButton
            count={data.length}
            onCreate={() => {
              openSheet({ mode: "create" });
            }}
          />
        </AdminStaffPermissionGate>
      </PageTitle>

      <ReportReasonsContent
        onDelete={onDelete}
        onOpenSheet={openSheet}
        onReorder={async ids => {
          await onReorder(ids);
          toast.success(t("reorder.success"), {
            description: t("reorder.success_desc"),
          });
        }}
        onSave={onSave}
        onSheetOpenChange={setSheetOpen}
        permissions={{ canDelete, canEdit }}
        reasons={data}
        sheet={sheet}
        sheetOpen={sheetOpen}
      />
    </div>
  );
};

export const AdminReportReasonsRouteContent = (
  props: AdminReportReasonsRouteData,
) => (
  <RouteMessages namespaces={ADMIN_REPORT_REASONS_NAMESPACES}>
    <ReportReasonsScreen {...props} />
  </RouteMessages>
);
