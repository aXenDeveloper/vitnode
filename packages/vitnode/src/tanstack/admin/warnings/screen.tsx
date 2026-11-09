import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  useRegisterWarningsCreate,
  WarningsCreateActionContext,
} from "./create-action";
import {
  ADMIN_WARNINGS_NAMESPACES,
  ADMIN_WARNINGS_TAB_PATHS,
  adminWarningsTabFromPath,
} from "./route";

const WarningReasonsPanel = () => {
  const t = useTranslations("admin.moderation.warning_reasons");
  const adminUserId = useAdminIdentity();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(
    adminWarningReasonsQueryOptions(adminUserId),
  );
  const { data: thresholds } = useSuspenseQuery(
    adminWarningThresholdsQueryOptions(adminUserId),
  );
  const canEdit = useAdminStaffPermission(ADMIN_WARNING_PERMISSIONS.manage);
  const [sheet, setSheet] = React.useState<WarningReasonSheetState>({
    mode: "create",
  });
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const openCreate = React.useCallback(() => {
    setSheet({ mode: "create" });
    setSheetOpen(true);
  }, []);
  useRegisterWarningsCreate(openCreate);
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: adminWarningReasonsQueryRoot(adminUserId),
      }),
      queryClient.invalidateQueries({ queryKey: WARNINGS_QUERY_ROOT }),
    ]);
  };

  return (
    <WarningReasonsContent
      canEdit={canEdit}
      onOpenSheet={state => {
        setSheet(state);
        setSheetOpen(true);
      }}
      onReorder={async ids => {
        const result = await reorderAdminWarningReasons(ids);
        if (isAdminMutationError(result)) {
          throw new Error(`Saving the order answered ${result.error.status}.`);
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
      thresholds={thresholds}
    />
  );
};

const WarningThresholdsPanel = () => {
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
  const openCreate = React.useCallback(() => {
    setSheet({ mode: "create" });
    setSheetOpen(true);
  }, []);
  useRegisterWarningsCreate(openCreate);
  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: adminWarningThresholdsQueryRoot(adminUserId),
    });
  };

  return (
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
  );
};

export const AdminWarningReasonsRouteContent = () => (
  <RouteMessages namespaces={ADMIN_WARNINGS_NAMESPACES}>
    <WarningReasonsPanel />
  </RouteMessages>
);

export const AdminWarningThresholdsRouteContent = () => (
  <RouteMessages namespaces={ADMIN_WARNINGS_NAMESPACES}>
    <WarningThresholdsPanel />
  </RouteMessages>
);

const TabCount = ({ value }: { value: number }) => (
  <span className="bg-muted text-muted-foreground min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums">
    {value}
  </span>
);

const WarningsLayout = ({
  children,
  description,
  title,
}: AdminWarningsRouteData & { children: React.ReactNode }) => {
  const t = useTranslations("admin.moderation.warnings.tabs");
  const adminUserId = useAdminIdentity();
  const { data: reasons } = useSuspenseQuery(
    adminWarningReasonsQueryOptions(adminUserId),
  );
  const { data: thresholds } = useSuspenseQuery(
    adminWarningThresholdsQueryOptions(adminUserId),
  );
  const tab = useRouterState({
    select: state => adminWarningsTabFromPath(state.location.pathname),
  });
  const openCreateRef = React.useRef<(() => void) | null>(null);
  const registerCreate = React.useCallback((open: (() => void) | null) => {
    openCreateRef.current = open;
  }, []);
  const onCreate = () => {
    openCreateRef.current?.();
  };

  return (
    <div className="flex flex-col">
      <header className="flex flex-col gap-4 border-b px-4 pt-4 sm:px-6 sm:pt-6">
        <PageTitle className="mb-0" desc={description} h1={title}>
          <AdminStaffPermissionGate {...ADMIN_WARNING_PERMISSIONS.manage}>
            {tab === "thresholds" ? (
              <CreateWarningThresholdButton
                count={thresholds.length}
                onCreate={onCreate}
              />
            ) : (
              <CreateWarningReasonButton
                count={reasons.length}
                onCreate={onCreate}
              />
            )}
          </AdminStaffPermissionGate>
        </PageTitle>

        <Tabs className="min-w-0" value={tab}>
          <TabsList className="h-11" variant="line">
            <TabsTrigger
              className="px-3"
              nativeButton={false}
              render={<Link to={ADMIN_WARNINGS_TAB_PATHS.reasons} />}
              value="reasons"
            >
              {t("reasons")}
              <TabCount value={reasons.length} />
            </TabsTrigger>
            <TabsTrigger
              className="px-3"
              nativeButton={false}
              render={<Link to={ADMIN_WARNINGS_TAB_PATHS.thresholds} />}
              value="thresholds"
            >
              {t("thresholds")}
              <TabCount value={thresholds.length} />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <WarningsCreateActionContext value={registerCreate}>
        <div className="min-w-0 p-4 sm:p-6">{children}</div>
      </WarningsCreateActionContext>
    </div>
  );
};

export const AdminWarningsLayoutContent = (
  props: AdminWarningsRouteData & { children: React.ReactNode },
) => (
  <RouteMessages namespaces={ADMIN_WARNINGS_NAMESPACES}>
    <WarningsLayout {...props} />
  </RouteMessages>
);

const ThresholdsCrumbLabel = () => {
  const t = useTranslations("admin.moderation.warnings.tabs");

  return <>{t("thresholds")}</>;
};

export const AdminWarningThresholdsCrumb = () => (
  <RouteMessages namespaces={ADMIN_WARNINGS_NAMESPACES}>
    <ThresholdsCrumbLabel />
  </RouteMessages>
);
