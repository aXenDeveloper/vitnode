import { useSuspenseQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { PermissionStaffType } from "@/api/lib/permission-staff";
import type { ActivityFilterOptions } from "@/views/activity-logs/activity-query";
import type { ActivityRouteSearch } from "@/views/activity-logs/activity-search";

import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-title";
import { manifest } from "@/manifest";
import {
  activityPluginNamespaces,
  useActivityStaffFilters,
} from "@/views/activity-logs/activity-labels";
import {
  activityFilterOptionsQueryOptions,
  downloadActivityExport,
} from "@/views/activity-logs/activity-query";
import { ActivityScreen } from "@/views/activity-logs/activity-screen";

import type { AdminTableNavigate } from "../table-search";
import type { AdminStaffLogsRouteData } from "./logs-route";

import { RouteMessages } from "../../i18n/route-messages";
import { useAdminPermission } from "../permissions";
import {
  ACTIVITY_LOGS_MODULE,
  ADMIN_STAFF_LOGS_NAMESPACES,
} from "./logs-route";

const permission = (name: string) => ({
  module: ACTIVITY_LOGS_MODULE,
  permission: name,
  plugin: manifest.id,
});

const ExportButton = ({
  options,
  search,
  type,
}: {
  options: ActivityFilterOptions;
  search: ActivityRouteSearch;
  type: PermissionStaffType;
}) => {
  const t = useTranslations("admin.staff.logs");
  const filters = useActivityStaffFilters({ options, search, staff: type });
  const tError = useTranslations("core.global.errors");
  const [isExporting, setIsExporting] = React.useState(false);

  return (
    <Button
      isLoading={isExporting}
      onClick={async () => {
        setIsExporting(true);
        try {
          await downloadActivityExport(filters);
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

  return (
    <RouteMessages
      namespaces={[
        ...ADMIN_STAFF_LOGS_NAMESPACES,
        ...activityPluginNamespaces(options.plugins),
      ]}
    >
      <div className="flex flex-col gap-6 p-6">
        <PageTitle desc={description} h1={title}>
          {canExport ? (
            <ExportButton options={options} search={search} type={type} />
          ) : null}
        </PageTitle>
        <ActivityScreen
          onSearchChange={next => {
            void navigate({ resetScroll: false, search: next });
          }}
          search={search}
          staff={type}
        />
      </div>
    </RouteMessages>
  );
};
