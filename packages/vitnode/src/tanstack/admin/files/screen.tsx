"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";

import type { DataTableNavigation } from "@/components/table/navigation";

import { DataTableNavigationProvider } from "@/components/table/navigation";
import { HeaderContent } from "@/components/ui/header-content";
import { CONFIG_PLUGIN } from "@/config";
import { FilesTableContent } from "@/views/admin/views/core/system/files/files-table-content";

import type { AdminTableNavigate } from "../table-search";
import type { AdminFilesRouteData } from "./route";
import type {
  AdminFilesRouteSearch,
  UncheckedAdminFilesSearch,
} from "./route-search";

import { RouteMessages } from "../../i18n/route-messages";
import { useAdminPermission } from "../permissions";
import { adminFilesQuery, useAdminFilesDeleteCallbacks } from "./query";
import { ADMIN_FILES_NAMESPACES } from "./route";
import { FILES_MODULE } from "./route";
import { adminFilesSearchFrom, adminFilesSearchParams } from "./route-search";

export interface AdminFilesRouteProps extends AdminFilesRouteData {
  navigate: AdminTableNavigate<AdminFilesRouteSearch>;
  search: UncheckedAdminFilesSearch;
}

export const AdminFilesRouteContent = ({
  description,
  navigate,
  params,
  search,
  title,
}: AdminFilesRouteProps) => {
  const { data } = useSuspenseQuery(adminFilesQuery({ params }));
  const { onDeleteFile, onDeleteFiles } = useAdminFilesDeleteCallbacks();
  const canDelete = useAdminPermission({
    module: FILES_MODULE,
    permission: "can_delete",
    plugin: CONFIG_PLUGIN.pluginId,
  });
  const canDownload = useAdminPermission({
    module: FILES_MODULE,
    permission: "can_download",
    plugin: CONFIG_PLUGIN.pluginId,
  });

  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({
          resetScroll: false,
          search: adminFilesSearchFrom(nextSearch),
        });
      },
      searchParams: adminFilesSearchParams(search),
    }),
    [navigate, search],
  );

  return (
    <RouteMessages namespaces={ADMIN_FILES_NAMESPACES}>
      <div className="p-4">
        <HeaderContent desc={description} h1={title} />

        <DataTableNavigationProvider value={navigation}>
          <FilesTableContent
            canDelete={canDelete}
            canDownload={canDownload}
            data={data}
            onDeleteFile={onDeleteFile}
            onDeleteFiles={onDeleteFiles}
          />
        </DataTableNavigationProvider>
      </div>
    </RouteMessages>
  );
};
