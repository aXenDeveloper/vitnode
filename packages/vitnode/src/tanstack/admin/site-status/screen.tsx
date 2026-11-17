import { useQuery, useQueryClient } from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";
import { PowerOffIcon, RotateCwIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { AdminSiteStatusInput } from "@/views/admin/views/core/system/site-status/site-status-query";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageTitle } from "@/components/ui/page-title";
import { CardsPendingSkeleton } from "@/tanstack/pending";
import { SiteStatusContent } from "@/views/admin/views/core/system/site-status/site-status-content";
import {
  adminSiteStatusQueryOptions,
  updateAdminSiteStatus,
} from "@/views/admin/views/core/system/site-status/site-status-query";

import type { AdminSiteStatusRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { siteStatusQueryKey } from "../../site-status/query";
import { useAdminPermission } from "../permissions";
import { ADMIN_SITE_STATUS_NAMESPACES, SITE_STATUS_MODULE } from "./route";

const SiteStatusScreen = () => {
  const t = useTranslations("admin.system.site_status");
  const queryClient = useQueryClient();
  const query = useQuery(adminSiteStatusQueryOptions());
  const canManage = useAdminPermission({
    module: SITE_STATUS_MODULE,
    permission: "can_manage",
    plugin: manifest.id,
  });

  const onSave = React.useCallback(
    async (values: AdminSiteStatusInput) => {
      const result = await updateAdminSiteStatus(values);
      if ("data" in result) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: adminSiteStatusQueryOptions().queryKey,
          }),
          queryClient.invalidateQueries({ queryKey: siteStatusQueryKey }),
        ]);
      }

      return result;
    },
    [queryClient],
  );

  if (query.isPending) return <CardsPendingSkeleton />;

  if (!query.data) {
    return (
      <Empty className="border" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PowerOffIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("load_error.title")}</EmptyTitle>
          <EmptyDescription>{t("load_error.desc")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            isLoading={query.isFetching}
            onClick={() => void query.refetch()}
            variant="outline"
          >
            <RotateCwIcon aria-hidden="true" />
            {t("retry")}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <SiteStatusContent
      canManage={canManage}
      data={query.data}
      fetchedAt={query.dataUpdatedAt}
      onSave={onSave}
    />
  );
};

export const AdminSiteStatusRouteContent = ({
  description,
  title,
}: AdminSiteStatusRouteData) => (
  <RouteMessages namespaces={ADMIN_SITE_STATUS_NAMESPACES}>
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageTitle className="mb-0" desc={description} h1={title} />
      <SiteStatusScreen />
    </div>
  </RouteMessages>
);
