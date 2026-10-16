import { cn } from "cn";
import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import type { AdminIntegrations } from "@/views/admin/views/core/system/integrations/integrations-query";
import type { AdminPluginUpdates } from "@/views/admin/views/core/system/plugins/plugin-updates-query";
import type { AdminInstalledPlugins } from "@/views/admin/views/core/system/plugins/plugins-query";

import { DateFormat } from "@/components/date-format";
import { AdminStaffPermissionGate } from "@/components/staff-permission/provider";
import { buttonVariants } from "@/components/ui/button";
import {
  Frame,
  FrameAction,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/ui/frame";
import { DOCS_URLS } from "@/lib/docs-links";
import { ADMIN_DEBUG_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";
import { SendTestEmailAction } from "@/views/admin/views/core/system/integrations/send-test-email/send-test-email";
import { sendTestEmailInBrowser } from "@/views/admin/views/core/system/integrations/send-test-email/send-test-email-mutation";
import { TestAIAction } from "@/views/admin/views/core/system/integrations/test-ai/test-ai";
import { TestStorageAction } from "@/views/admin/views/core/system/integrations/test-storage/test-storage";
import { CheckUpdatesButton } from "@/views/admin/views/core/system/plugins/check-updates-button";
import { checkPluginUpdates } from "@/views/admin/views/core/system/plugins/plugin-updates-query";

import type { DebugArea, DebugService } from "../health/health";

import { ClearCacheAction } from "../actions/clear-cache/clear-cache";
import {
  DEBUG_SERVICES,
  isServiceActive,
  pluginProblem,
} from "../health/health";
import { TONE_TEXT, ToneBadge, ToneIcon } from "../tone";
import { CheckRow, FactRow, FRAME_ACTION_STACKED, FrameRow } from "./frame-row";
import { SecurityUpdatePanel } from "./security";

const SystemHeader = ({
  action,
  area,
}: {
  action?: React.ReactNode;
  area: DebugArea;
}) => {
  const t = useTranslations("admin.debug");
  const tHealth = useTranslations("admin.debug.health");

  return (
    <FrameHeader>
      <FrameTitle className="flex items-center gap-2">
        {t(`nav.${area.id}`)}
        {area.tone === "off" ? null : <ToneBadge tone={area.tone} />}
      </FrameTitle>
      <FrameDescription>
        {tHealth(area.subtitle.key, area.subtitle.values)}
      </FrameDescription>
      {action ? (
        <FrameAction className={FRAME_ACTION_STACKED}>{action}</FrameAction>
      ) : null}
    </FrameHeader>
  );
};

export const VitnodeSection = ({
  area,
  installed,
  updates,
}: {
  area: DebugArea;
  installed: AdminInstalledPlugins;
  updates: AdminPluginUpdates | undefined;
}) => {
  const t = useTranslations("admin.debug.sections.vitnode");
  const core = updates?.core;
  const lastChecked = core?.lastSuccessAt ?? core?.lastAttemptAt;

  return (
    <div className="flex flex-col gap-6">
      <SecurityUpdatePanel updates={updates} version={installed.core.version} />
      <Frame>
        <SystemHeader
          action={<CheckUpdatesButton onCheck={checkPluginUpdates} />}
          area={area}
        />
        <FramePanel>
          {area.checks
            .filter(check => check.id !== "vitnode-security-update")
            .map(check => (
              <CheckRow check={check} key={check.id} />
            ))}
          <FactRow label={t("version")} value={installed.core.version} />
          <FactRow
            label={t("channel")}
            value={
              core?.result?.channel ?? updates?.channelOverride ?? t("auto")
            }
          />
          <FactRow
            label={t("last_checked")}
            value={lastChecked ? <DateFormat date={lastChecked} /> : t("never")}
          />
        </FramePanel>
      </Frame>
    </div>
  );
};

export const PluginsSection = ({
  area,
  installed,
  updates,
}: {
  area: DebugArea;
  installed: AdminInstalledPlugins;
  updates: AdminPluginUpdates | undefined;
}) => {
  const tHealth = useTranslations("admin.debug.health");

  return (
    <Frame>
      <SystemHeader
        action={<CheckUpdatesButton onCheck={checkPluginUpdates} />}
        area={area}
      />
      <FramePanel>
        {installed.plugins.map(plugin => {
          const problem = pluginProblem(
            plugin,
            updates?.plugins.find(update => update.id === plugin.id),
          );

          return (
            <FrameRow className="flex-wrap" key={plugin.id}>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">{plugin.title}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {plugin.id}
                </span>
              </span>
              {problem ? (
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-xs",
                    TONE_TEXT[problem.tone],
                  )}
                >
                  <ToneIcon className="size-3.5" tone={problem.tone} />
                  {tHealth(`plugins.problem.${problem.kind}`, problem.values)}
                </span>
              ) : null}
              <span className="text-sm font-medium tabular-nums">
                {plugin.version ?? "—"}
              </span>
            </FrameRow>
          );
        })}
      </FramePanel>
    </Frame>
  );
};

export const CacheSection = ({
  area,
  integrations,
  onClearCache,
}: {
  area: DebugArea;
  integrations: AdminIntegrations;
  onClearCache: () => Promise<void>;
}) => {
  const t = useTranslations("admin.debug.sections.cache");

  return (
    <Frame>
      <SystemHeader
        action={
          <AdminStaffPermissionGate {...ADMIN_DEBUG_PERMISSIONS.clearCache}>
            <ClearCacheAction onClearCache={onClearCache} />
          </AdminStaffPermissionGate>
        }
        area={area}
      />
      <FramePanel>
        {area.checks.map(check => (
          <CheckRow check={check} key={check.id} />
        ))}
        <FactRow
          label={t("engine")}
          value={integrations.redis.active ? t("redis") : t("memory")}
        />
        <FactRow
          label={t("cross_instance")}
          value={integrations.websocket.crossInstance ? t("yes") : t("no")}
        />
      </FramePanel>
    </Frame>
  );
};

const SERVICE_DOCS: Record<DebugService, string> = {
  ai: DOCS_URLS.ai,
  captcha: DOCS_URLS.captcha,
  email: DOCS_URLS.email,
  storage: DOCS_URLS.storage,
  websocket: DOCS_URLS.websocket,
};

const ServiceTest = ({
  integrations,
  service,
}: {
  integrations: AdminIntegrations;
  service: DebugService;
}) => {
  if (service === "email") {
    return (
      <AdminStaffPermissionGate {...ADMIN_DEBUG_PERMISSIONS.testEmail}>
        <SendTestEmailAction onSend={sendTestEmailInBrowser} />
      </AdminStaffPermissionGate>
    );
  }
  if (service === "storage") {
    return (
      <AdminStaffPermissionGate {...ADMIN_DEBUG_PERMISSIONS.testStorage}>
        <TestStorageAction />
      </AdminStaffPermissionGate>
    );
  }
  if (service === "ai") {
    return (
      <AdminStaffPermissionGate {...ADMIN_DEBUG_PERMISSIONS.testAi}>
        <TestAIAction models={integrations.ai.models} />
      </AdminStaffPermissionGate>
    );
  }

  return null;
};

export const ServicesSection = ({
  area,
  integrations,
}: {
  area: DebugArea;
  integrations: AdminIntegrations;
}) => {
  const t = useTranslations("admin.debug.sections.services");
  const tHealth = useTranslations("admin.debug.health");

  return (
    <Frame>
      <SystemHeader area={area} />
      <FramePanel>
        {DEBUG_SERVICES.map(service => {
          const active = isServiceActive(integrations, service);

          return (
            <FrameRow className="flex-wrap" key={service}>
              <ToneIcon tone={active ? "ok" : "off"} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">
                  {tHealth(`services.${service}`)}
                </span>
                <span className="text-muted-foreground text-xs">
                  {active ? t("active") : t("not_configured")}
                </span>
              </span>
              {active ? (
                <ServiceTest integrations={integrations} service={service} />
              ) : (
                <a
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                  href={SERVICE_DOCS[service]}
                  rel="noreferrer"
                  target="_blank"
                >
                  {t("set_up")}
                  <ExternalLinkIcon aria-hidden />
                </a>
              )}
            </FrameRow>
          );
        })}
      </FramePanel>
    </Frame>
  );
};
