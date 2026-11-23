import type { SeoSettingsUpdate } from "@vitnode/api/lib/seo/settings";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { FileCode2Icon, NetworkIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { SeoAdminSettings } from "@/views/admin/views/core/system/seo/seo-query";

import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { PageTitle } from "@/components/ui/page-title";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsPanels,
  TabsTrigger,
} from "@/components/ui/tabs";
import { TablePendingSkeleton } from "@/tanstack/pending";
import { ADMIN_SEO_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";
import { RobotsForm } from "@/views/admin/views/core/system/seo/robots-form";
import {
  adminSeoQueryKey,
  adminSeoQueryOptions,
  updateAdminSeoSettings,
} from "@/views/admin/views/core/system/seo/seo-query";
import { SitemapsForm } from "@/views/admin/views/core/system/seo/sitemaps-form";
import { SourcesTable } from "@/views/admin/views/core/system/seo/sources-table";

import type { AdminSeoRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { ADMIN_SEO_NAMESPACES } from "./route";

const SeoScreen = ({ description, title }: AdminSeoRouteData) => {
  const t = useTranslations("admin.system.seo");
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(adminSeoQueryOptions());
  const canManage = useAdminStaffPermission(ADMIN_SEO_PERMISSIONS.manage);
  // Content sources are named by their plugin's content messages.
  const sourceNamespaces = [
    ...ADMIN_SEO_NAMESPACES,
    ...new Set(
      data.sources.flatMap(source =>
        source.contentType ? [`${source.contentType.pluginId}.content`] : [],
      ),
    ),
  ];

  const save = async (body: SeoSettingsUpdate) => {
    const result = await updateAdminSeoSettings(body);
    if ("data" in result) {
      queryClient.setQueryData<SeoAdminSettings>(adminSeoQueryKey, result.data);
      await queryClient.invalidateQueries({ queryKey: adminSeoQueryKey });
    }

    return result;
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageTitle desc={description} h1={title} />

      <Tabs className="min-w-0 gap-4" defaultValue="general">
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <TabsList className="w-full min-w-max md:w-auto">
            <TabsTrigger value="general">
              <FileCode2Icon aria-hidden="true" />
              {t("tabs.general")}
            </TabsTrigger>
            <TabsTrigger value="sitemaps">
              <NetworkIcon aria-hidden="true" />
              {t("tabs.sitemaps")}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsPanels>
          <TabsContent keepMounted value="general">
            <div className="flex max-w-3xl flex-col gap-6">
              <RobotsForm canManage={canManage} data={data} onSave={save} />
            </div>
          </TabsContent>
          <TabsContent keepMounted value="sitemaps">
            <div className="flex max-w-5xl flex-col gap-8">
              <SitemapsForm
                canManage={canManage}
                data={data}
                onSave={async sitemap => await save({ sitemap })}
              />
              <React.Suspense
                fallback={
                  <TablePendingSkeleton label={t("sources.title")} rows={4} />
                }
              >
                <RouteMessages namespaces={sourceNamespaces}>
                  <SourcesTable
                    canManage={canManage}
                    data={data}
                    onToggle={async (source, enabled) => {
                      const disabled = new Set(
                        data.settings.sitemap.disabledSources,
                      );
                      if (enabled) disabled.delete(source.id);
                      else disabled.add(source.id);

                      return await save({
                        sitemap: { disabledSources: [...disabled] },
                      });
                    }}
                  />
                </RouteMessages>
              </React.Suspense>
            </div>
          </TabsContent>
        </TabsPanels>
      </Tabs>
    </div>
  );
};

export const AdminSeoRouteContent = (props: AdminSeoRouteData) => (
  <RouteMessages namespaces={ADMIN_SEO_NAMESPACES}>
    <SeoScreen {...props} />
  </RouteMessages>
);
