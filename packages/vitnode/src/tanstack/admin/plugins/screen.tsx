import { useSuspenseQuery } from "@tanstack/react-query";

import { PageTitle } from "@/components/ui/page-title";
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

  return (
    <RouteMessages namespaces={ADMIN_PLUGINS_NAMESPACES}>
      <div className="p-6">
        <PageTitle desc={description} h1={title} />

        <PluginsContent data={data} />
      </div>
    </RouteMessages>
  );
};
