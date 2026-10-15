import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { PageTitle } from "@/components/ui/page-title";
import { CheckUpdatesButton } from "@/views/admin/views/core/system/plugins/check-updates-button";
import { CoreUpdateCard } from "@/views/admin/views/core/system/plugins/core-update-card";
import {
  checkPluginUpdates,
  pluginUpdatesQueryOptions,
} from "@/views/admin/views/core/system/plugins/plugin-updates-query";
import { PluginsContent } from "@/views/admin/views/core/system/plugins/plugins-content";
import { installedPluginsQueryOptions } from "@/views/admin/views/core/system/plugins/plugins-query";

import type { AdminPluginsRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { ADMIN_PLUGINS_NAMESPACES } from "./route";

export const AdminPluginsRouteContent = ({
  description,
  title,
}: AdminPluginsRouteData) => {
  const { data } = useSuspenseQuery(installedPluginsQueryOptions());
  // Not suspending: the catalog is useful without update results, and a
  // failure here must not take the list of installed plugins down with it.
  const { data: updates } = useQuery(pluginUpdatesQueryOptions());

  return (
    <RouteMessages namespaces={ADMIN_PLUGINS_NAMESPACES}>
      <div className="flex flex-col gap-6 p-6">
        <PageTitle className="mb-0" desc={description} h1={title}>
          <CheckUpdatesButton onCheck={checkPluginUpdates} />
        </PageTitle>

        <CoreUpdateCard updates={updates} version={data.core.version} />

        <PluginsContent data={data} updates={updates} />
      </div>
    </RouteMessages>
  );
};
