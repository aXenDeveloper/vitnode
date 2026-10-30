import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { WarningReasonSheetState } from "@/views/admin/views/core/moderation/warnings/warning-reasons-content";
import type { WarningThresholdSheetState } from "@/views/admin/views/core/moderation/warnings/warning-thresholds-content";

import {
  AdminStaffPermissionGate,
  useAdminStaffPermission,
} from "@/components/staff-permission/provider";
import { PageTitle } from "@/components/ui/page-title";
import {
  CreateWarningReasonButton,
  WarningReasonsContent,
} from "@/views/admin/views/core/moderation/warnings/warning-reasons-content";
import {
  CreateWarningThresholdButton,
  WarningThresholdsContent,
} from "@/views/admin/views/core/moderation/warnings/warning-thresholds-content";
import {
  adminWarningReasonsQueryOptions,
  adminWarningReasonsQueryRoot,
  adminWarningThresholdsQueryOptions,
  adminWarningThresholdsQueryRoot,
  deleteAdminWarningThreshold,
  reorderAdminWarningReasons,
  saveAdminWarningReason,
  saveAdminWarningThreshold,
} from "@/views/admin/views/core/moderation/warnings/warnings-admin-api";
import { isAdminMutationError } from "@/views/admin/views/core/shared/admin-mutation";
import { ADMIN_WARNING_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";
import { WARNINGS_QUERY_ROOT } from "@/views/moderation/warnings/warnings-api";

import type { AdminWarningsRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { useAdminIdentity } from "../identity";
import { ADMIN_WARNINGS_NAMESPACES } from "./route";

const WarningReasonsScreen = ({
  description,
  title,
}: AdminWarningsRouteData) => {
  const t = useTranslations("admin.moderation.warning_reasons");
  const adminUserId = useAdminIdentity();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(
    adminWarningReasonsQueryOptions(adminUserId),
  );
  const canEdit = useAdminStaffPermission(ADMIN_WARNING_PERMISSIONS.manage);
  const [sheet, setSheet] = React.useState<WarningReasonSheetState>({
    mode: "create",
  });
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: adminWarningReasonsQueryRoot(adminUserId),
      }),
      queryClient.invalidateQueries({ queryKey: WARNINGS_QUERY_ROOT }),
    ]);
  };

  return (
    <div className="p-6">
      <PageTitle desc={description} h1={title}>
        <AdminStaffPermissionGate {...ADMIN_WARNING_PERMISSIONS.manage}>
          <CreateWarningReasonButton
            count={data.length}
            onCreate={() => {
              setSheet({ mode: "create" });
              setSheetOpen(true);
            }}
          />
        </AdminStaffPermissionGate>
      </PageTitle>

      <WarningReasonsContent
        canEdit={canEdit}
        onOpenSheet={state => {
          setSheet(state);
          setSheetOpen(true);
        }}
        onReorder={async ids => {
          const result = await reorderAdminWarningReasons(ids);
          if (isAdminMutationError(result)) {
            throw new Error(
              `Saving the order answered ${result.error.status}.`,
            );
          }
          await refresh();
          toast.success(t("reorder.success"), {
            description: t("reorder.success_desc"),
          });
        }}
        onSave={async args => {
          const result = await saveAdminWarningReason(args);
          if (!isAdminMutationError(result)) await refresh();

          return result;
        }}
        onSheetOpenChange={setSheetOpen}
        reasons={data}
        sheet={sheet}
        sheetOpen={sheetOpen}
      />
    </div>
  );
};

export const AdminWarningReasonsRouteContent = (
  props: AdminWarningsRouteData,
) => (
  <RouteMessages namespaces={ADMIN_WARNINGS_NAMESPACES}>
    <WarningReasonsScreen {...props} />
  </RouteMessages>
);

const WarningThresholdsScreen = ({
  description,
  title,
}: AdminWarningsRouteData) => {
  const adminUserId = useAdminIdentity();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(
    adminWarningThresholdsQueryOptions(adminUserId),
  );
  const canEdit = useAdminStaffPermission(ADMIN_WARNING_PERMISSIONS.manage);
  const [sheet, setSheet] = React.useState<WarningThresholdSheetState>({
    mode: "create",
  });
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: adminWarningThresholdsQueryRoot(adminUserId),
    });
  };

  return (
    <div className="p-6">
      <PageTitle desc={description} h1={title}>
        <AdminStaffPermissionGate {...ADMIN_WARNING_PERMISSIONS.manage}>
          <CreateWarningThresholdButton
            count={data.length}
            onCreate={() => {
              setSheet({ mode: "create" });
              setSheetOpen(true);
            }}
          />
        </AdminStaffPermissionGate>
      </PageTitle>

      <WarningThresholdsContent
        canEdit={canEdit}
        onDelete={async id => {
          const result = await deleteAdminWarningThreshold(id);
          if (!isAdminMutationError(result)) await refresh();

          return result;
        }}
        onOpenSheet={state => {
          setSheet(state);
          setSheetOpen(true);
        }}
        onSave={async args => {
          const result = await saveAdminWarningThreshold(args);
          if (!isAdminMutationError(result)) await refresh();

          return result;
        }}
        onSheetOpenChange={setSheetOpen}
        sheet={sheet}
        sheetOpen={sheetOpen}
        thresholds={data}
      />
    </div>
  );
};

export const AdminWarningThresholdsRouteContent = (
  props: AdminWarningsRouteData,
) => (
  <RouteMessages namespaces={ADMIN_WARNINGS_NAMESPACES}>
    <WarningThresholdsScreen {...props} />
  </RouteMessages>
);
