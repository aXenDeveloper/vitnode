import { PowerOffIcon, RotateCwIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { debugHealth } from "@/views/admin/views/core/debug/health/health";
import { DebugOverview } from "@/views/admin/views/core/debug/sections/overview";
import { SiteStatusFrame } from "@/views/admin/views/core/debug/sections/site-status";
import {
  CacheSection,
  PluginsSection,
  ServicesSection,
  VitnodeSection,
} from "@/views/admin/views/core/debug/sections/systems";

import type { DebugSystemTab } from "./tabs";

import {
  useClearAdminCache,
  useDebugSiteStatus,
  useDebugSources,
  useRecheckDebugSources,
} from "./query";

const Unavailable = () => {
  const t = useTranslations("admin.debug");

  return (
    <p className="text-muted-foreground ring-foreground/10 rounded-xl px-4 py-10 text-center text-sm ring-1">
      {t("unavailable")}
    </p>
  );
};

const useDebugArea = (tab: DebugSystemTab) => {
  const sources = useDebugSources();
  const area = debugHealth(sources).areas.find(entry => entry.id === tab);

  return { area, sources };
};

const SiteStatusSkeleton = () => (
  <div
    aria-hidden="true"
    className="bg-muted/50 ring-foreground/10 flex flex-col gap-1 rounded-lg p-1 ring-1"
  >
    <div className="flex items-center gap-3 px-3 py-2">
      <Skeleton className="size-10 rounded-lg" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-52" />
      </div>
    </div>
    <Skeleton className="h-24 rounded-md" />
  </div>
);

const DebugSiteStatus = () => {
  const t = useTranslations("admin.system.site_status");
  const { canManage, canView, onSave, query } = useDebugSiteStatus();
  if (!canView) return null;
  if (query.isPending) return <SiteStatusSkeleton />;
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
    <SiteStatusFrame canManage={canManage} data={query.data} onSave={onSave} />
  );
};

export const DebugOverviewTab = () => {
  const sources = useDebugSources();
  const onClearCache = useClearAdminCache();
  const { isPending, recheck } = useRecheckDebugSources();

  return (
    <DebugOverview
      deletions={sources.deletions}
      health={debugHealth(sources)}
      isRechecking={isPending}
      onClearCache={onClearCache}
      onRecheck={recheck}
      siteStatus={<DebugSiteStatus />}
      updates={sources.updates}
      version={sources.installed?.core.version ?? null}
    />
  );
};

export const DebugVitnodeTab = () => {
  const { area, sources } = useDebugArea("vitnode");

  return area && sources.installed ? (
    <VitnodeSection
      area={area}
      installed={sources.installed}
      updates={sources.updates}
    />
  ) : (
    <Unavailable />
  );
};

export const DebugPluginsTab = () => {
  const { area, sources } = useDebugArea("plugins");

  return area && sources.installed ? (
    <PluginsSection
      area={area}
      installed={sources.installed}
      updates={sources.updates}
    />
  ) : (
    <Unavailable />
  );
};

export const DebugCacheTab = () => {
  const { area, sources } = useDebugArea("cache");
  const onClearCache = useClearAdminCache();

  return area && sources.integrations ? (
    <CacheSection
      area={area}
      integrations={sources.integrations}
      onClearCache={onClearCache}
    />
  ) : (
    <Unavailable />
  );
};

export const DebugServicesTab = () => {
  const { area, sources } = useDebugArea("services");

  return area && sources.integrations ? (
    <ServicesSection area={area} integrations={sources.integrations} />
  ) : (
    <Unavailable />
  );
};
