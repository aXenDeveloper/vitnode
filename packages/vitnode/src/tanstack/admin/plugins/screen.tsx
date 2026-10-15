import { useSuspenseQuery } from "@tanstack/react-query";

import type { PluginIconLoader } from "@/lib/plugin-metadata";

import { PageTitle } from "@/components/ui/page-title";
import { PluginsContent } from "@/views/admin/views/core/system/plugins/plugins-content";
import { installedPluginsQueryOptions } from "@/views/admin/views/core/system/plugins/plugins-query";
import { getVitNodeConfig } from "@/vitnode.config";

import type { AdminPluginsRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { ADMIN_PLUGINS_NAMESPACES } from "./route";

/**
 * Icons come from the frontend registrations - the browser is where they are
 * shown, and the API never carries image bytes. A plugin registered only in the
 * API gets the default icon.
 */
const frontendIcons = (): Record<string, PluginIconLoader | undefined> =>
  Object.fromEntries(
    getVitNodeConfig().plugins.map(plugin => [plugin.pluginId, plugin.icon]),
  );

export const AdminPluginsRouteContent = ({
  description,
  title,
}: AdminPluginsRouteData) => {
  const { data } = useSuspenseQuery(installedPluginsQueryOptions());

  return (
    <RouteMessages namespaces={ADMIN_PLUGINS_NAMESPACES}>
      <div className="p-6">
        <PageTitle desc={description} h1={title} />

        <PluginsContent data={data} icons={frontendIcons()} />
      </div>
    </RouteMessages>
  );
};
