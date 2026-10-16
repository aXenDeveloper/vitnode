import { useTranslations } from "use-intl";

import { debugHealth } from "@/views/admin/views/core/debug/health/health";
import { DebugOverview } from "@/views/admin/views/core/debug/sections/overview";
import {
  CacheSection,
  PluginsSection,
  ServicesSection,
  VitnodeSection,
} from "@/views/admin/views/core/debug/sections/systems";

import type { DebugSystemTab } from "./tabs";

import {
  useClearAdminCache,
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

export const DebugOverviewTab = () => {
  const sources = useDebugSources();
  const onClearCache = useClearAdminCache();
  const { isPending, recheck } = useRecheckDebugSources();

  return (
    <DebugOverview
      health={debugHealth(sources)}
      isRechecking={isPending}
      onClearCache={onClearCache}
      onRecheck={recheck}
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
