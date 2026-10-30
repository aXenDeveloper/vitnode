import { useSuspenseQuery } from "@tanstack/react-query";
import { DownloadIcon, Settings2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { PermissionStaffType } from "@/api/lib/permission-staff";
import type { ActivityRouteSearch } from "@/views/activity-logs/activity-search";

import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-title";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { manifest } from "@/manifest";
import { activityPluginNamespaces } from "@/views/activity-logs/activity-labels";
import {
  activityFilterOptionsQueryOptions,
  downloadActivityExport,
} from "@/views/activity-logs/activity-query";
import { ActivityScreen } from "@/views/activity-logs/activity-screen";
import {
  activityFiltersOf,
  activitySearchOf,
} from "@/views/activity-logs/activity-search";

import type { AdminTableNavigate } from "../table-search";
import type { AdminStaffLogsRouteData } from "./logs-route";

import { RouteMessages } from "../../i18n/route-messages";
import { useAdminPermission } from "../permissions";
import {
  ACTIVITY_LOGS_MODULE,
  ADMIN_STAFF_LOGS_NAMESPACES,
} from "./logs-route";

const ActivityRetentionForm = React.lazy(
  async () => await import("@/views/activity-logs/activity-retention-form"),
);

const permission = (name: string) => ({
  module: ACTIVITY_LOGS_MODULE,
  permission: name,
  plugin: manifest.id,
});

const ExportButton = ({
  search,
  type,
}: {
  search: ActivityRouteSearch;
  type: PermissionStaffType;
}) => {
  const t = useTranslations("admin.staff.logs");
  const tError = useTranslations("core.global.errors");
  const [isExporting, setIsExporting] = React.useState(false);

  return (
    <Button
      isLoading={isExporting}
      onClick={async () => {
        setIsExporting(true);
        try {
          await downloadActivityExport({
            ...activityFiltersOf(search),
            staff: type,
          });
        } catch {
          toast.error(tError("title"), { description: t("export_error") });
        } finally {
          setIsExporting(false);
        }
      }}
      variant="outline"
    >
      <DownloadIcon aria-hidden />
      {t("export")}
    </Button>
  );
};

const RetentionSheet = ({ canManage }: { canManage: boolean }) => {
  const t = useTranslations("admin.staff.logs.settings");
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Sheet onOpenChange={setIsOpen} open={isOpen}>
      <SheetTrigger render={<Button variant="outline" />}>
        <Settings2Icon aria-hidden />
        {t("open")}
      </SheetTrigger>
      <SheetContent className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b pe-14">
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription className="leading-relaxed text-pretty">
            {t("desc")}
          </SheetDescription>
        </SheetHeader>
        <React.Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center">
              <Spinner size="xl" />
            </div>
          }
        >
          <ActivityRetentionForm
            canManage={canManage}
            onSaved={() => {
              setIsOpen(false);
            }}
          />
        </React.Suspense>
      </SheetContent>
    </Sheet>
  );
};

export interface AdminStaffLogsRouteProps extends AdminStaffLogsRouteData {
  navigate: AdminTableNavigate<ActivityRouteSearch>;
  search: ActivityRouteSearch;
}

/** AdminCP -> Staff -> Administrators / Moderators -> Logs. */
export const AdminStaffLogsRouteContent = ({
  description,
  navigate,
  search,
  title,
  type,
}: AdminStaffLogsRouteProps) => {
  const { data: options } = useSuspenseQuery(
    activityFilterOptionsQueryOptions(),
  );
  const canExport = useAdminPermission(permission("can_export"));
  const canManageRetention = useAdminPermission(
    permission("can_manage_retention"),
  );

  return (
    <RouteMessages
      namespaces={[
        ...ADMIN_STAFF_LOGS_NAMESPACES,
        ...activityPluginNamespaces(options.plugins),
      ]}
    >
      <div className="flex flex-col gap-6 p-6">
        <PageTitle desc={description} h1={title} />
        <ActivityScreen
          actions={
            <>
              {canExport ? <ExportButton search={search} type={type} /> : null}
              <RetentionSheet canManage={canManageRetention} />
            </>
          }
          entryId={search.log ?? null}
          filters={activityFiltersOf(search)}
          onNavigate={next => {
            void navigate({
              resetScroll: false,
              search: activitySearchOf(next),
            });
          }}
          staff={type}
        />
      </div>
    </RouteMessages>
  );
};
