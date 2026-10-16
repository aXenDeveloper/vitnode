import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, RefreshCwIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import type { AdminPluginUpdates } from "@/views/admin/views/core/system/plugins/plugin-updates-query";

import { AdminStaffPermissionGate } from "@/components/staff-permission/provider";
import { Button } from "@/components/ui/button";
import {
  Frame,
  FrameAction,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/ui/frame";
import { debugTabPath } from "@/tanstack/admin/debug/route-search";
import { ADMIN_DEBUG_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { DebugHealth } from "../health/health";

import { ClearCacheAction } from "../actions/clear-cache/clear-cache";
import { DEBUG_TAB_ICONS } from "../nav/debug-nav";
import { ToneIcon } from "../tone";
import { FRAME_ACTION_STACKED } from "./frame-row";
import { SecurityUpdateAlert } from "./security";

const ROW_LINK =
  "hover:bg-muted/50 focus-visible:bg-muted/50 flex items-center gap-3 px-4 py-3 text-start transition-colors outline-none";

export const DebugOverview = ({
  health,
  isRechecking,
  onClearCache,
  onRecheck,
  updates,
  version,
}: {
  health: DebugHealth;
  isRechecking: boolean;
  onClearCache: () => Promise<void>;
  onRecheck: () => void;
  updates: AdminPluginUpdates | undefined;
  version: null | string;
}) => {
  const t = useTranslations("admin.debug");
  const tHealth = useTranslations("admin.debug.health");
  const critical = health.issues.filter(issue => issue.tone === "critical");
  const warnings = health.issues.length - critical.length;

  return (
    <div className="flex flex-col gap-6">
      {version ? (
        <SecurityUpdateAlert updates={updates} version={version} />
      ) : null}

      <Frame>
        <FrameHeader>
          <FrameTitle>
            {health.issues.length > 0
              ? t("overview.attention", { count: health.issues.length })
              : t("overview.healthy")}
          </FrameTitle>
          <FrameDescription>
            {t("overview.summary", {
              critical: critical.length,
              warnings,
            })}
          </FrameDescription>
          <FrameAction className={FRAME_ACTION_STACKED}>
            <Button
              isLoading={isRechecking}
              onClick={onRecheck}
              size="sm"
              variant="outline"
            >
              {isRechecking ? null : <RefreshCwIcon aria-hidden />}
              {t("overview.recheck")}
            </Button>
          </FrameAction>
        </FrameHeader>
        {health.issues.length > 0 ? (
          <FramePanel>
            {health.issues.map(issue => (
              <Link
                className={ROW_LINK}
                key={issue.id}
                resetScroll={false}
                to={debugTabPath(issue.tab)}
              >
                <ToneIcon tone={issue.tone} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium text-pretty">
                    {tHealth(issue.message.key, issue.message.values)}
                  </span>
                  {issue.detail ? (
                    <span className="text-muted-foreground truncate text-xs">
                      {issue.detail}
                    </span>
                  ) : null}
                </span>
                <ChevronRightIcon
                  aria-hidden
                  className="text-muted-foreground size-4 shrink-0"
                />
              </Link>
            ))}
          </FramePanel>
        ) : null}
      </Frame>

      {health.areas.length > 0 ? (
        <Frame>
          <FrameHeader>
            <FrameTitle>{t("overview.systems.title")}</FrameTitle>
            <FrameDescription>{t("overview.systems.desc")}</FrameDescription>
            <AdminStaffPermissionGate {...ADMIN_DEBUG_PERMISSIONS.clearCache}>
              <FrameAction className={FRAME_ACTION_STACKED}>
                <ClearCacheAction onClearCache={onClearCache} />
              </FrameAction>
            </AdminStaffPermissionGate>
          </FrameHeader>
          <FramePanel>
            {health.areas.map(area => {
              const Icon = DEBUG_TAB_ICONS[area.id];

              return (
                <Link
                  className={ROW_LINK}
                  key={area.id}
                  resetScroll={false}
                  to={debugTabPath(area.id)}
                >
                  <Icon
                    aria-hidden
                    className="text-muted-foreground size-4 shrink-0"
                  />
                  <span className="w-32 shrink-0 text-sm font-medium sm:w-40">
                    {t(`nav.${area.id}`)}
                  </span>
                  <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm tabular-nums">
                    {tHealth(area.subtitle.key, area.subtitle.values)}
                  </span>
                  <ToneIcon tone={area.tone} />
                </Link>
              );
            })}
          </FramePanel>
        </Frame>
      ) : null}
    </div>
  );
};
