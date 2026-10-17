import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";

import { PageTitle } from "@/components/ui/page-title";
import { manifest } from "@/manifest";
import { PluginList } from "@/views/admin/views/core/system/plugins/plugin-list";
import { pluginRowsOf } from "@/views/admin/views/core/system/plugins/plugin-rows";
import {
  checkPluginUpdates,
  pluginUpdatesQueryOptions,
} from "@/views/admin/views/core/system/plugins/plugin-updates-query";
import { installedPluginsQueryOptions } from "@/views/admin/views/core/system/plugins/plugins-query";
import { PluginsStatus } from "@/views/admin/views/core/system/plugins/plugins-status";

import type { AdminPluginsRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { ADMIN_PLUGINS_NAMESPACES } from "./route";

const AdminPluginsScreen = ({ description, title }: AdminPluginsRouteData) => {
  const t = useTranslations("admin.system.plugins.core");
  const { data } = useSuspenseQuery(installedPluginsQueryOptions());
  // Not suspending: the catalog is useful without update results, and a
  // failure here must not take the list of installed plugins down with it.
  const { data: updates } = useQuery(pluginUpdatesQueryOptions());
  const rows = pluginRowsOf({
    core: { description: t("desc"), id: manifest.id, title: t("title") },
    data,
    updates,
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageTitle className="mb-0" desc={description} h1={title} />

      <PluginsStatus
        onCheck={checkPluginUpdates}
        rows={rows}
        updates={updates}
      />

      <PluginList
        coreVersion={data.core.version}
        enabled={updates?.enabled ?? true}
        rows={rows}
      />
    </div>
  );
};

export const AdminPluginsRouteContent = (props: AdminPluginsRouteData) => (
  <RouteMessages namespaces={ADMIN_PLUGINS_NAMESPACES}>
    <AdminPluginsScreen {...props} />
  </RouteMessages>
);
