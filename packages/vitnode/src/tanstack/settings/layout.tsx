import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import {
  SETTINGS_ZONE_IDS,
  settingsPage,
} from "@vitnode/api/modules/pages/settings-page";

import {
  aiUsageQueryOptions,
  hasAiFeatures,
} from "@/views/auth/settings/ai/ai-usage-query";
import { SettingsNavContent } from "@/views/auth/settings/nav-content";
import { visibleSettingsNavItems } from "@/views/auth/settings/settings-nav";
import { SettingsShellContent } from "@/views/auth/settings/shell-content";

import { useMiddlewareConfigQuery } from "../auth/middleware-config";
import { isChatUiEnabled } from "../chat/config";
import { RouteMessages } from "../i18n/route-messages";
import { PageWidgets, PageWidgetsZone } from "../widgets";
import { SETTINGS_NAMESPACES } from "./route";

export const SettingsLayoutContent = ({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId?: number;
}) => {
  const pathname = useRouterState({ select: state => state.location.pathname });
  const { data: config } = useMiddlewareConfigQuery();
  const siteHasAi = (config.ai?.models.length ?? 0) > 0;
  const { data: aiUsage } = useQuery({
    ...aiUsageQueryOptions({ userId: userId ?? 0 }),
    enabled: siteHasAi && userId !== undefined,
  });

  return (
    <RouteMessages namespaces={SETTINGS_NAMESPACES}>
      <PageWidgets page={settingsPage}>
        <SettingsShellContent
          footer={<PageWidgetsZone id={SETTINGS_ZONE_IDS.footer} />}
          header={<PageWidgetsZone id={SETTINGS_ZONE_IDS.header} />}
          nav={
            <SettingsNavContent
              items={visibleSettingsNavItems({
                ...config,
                aiFeatures: aiUsage !== undefined && hasAiFeatures(aiUsage),
                chat: isChatUiEnabled() && config.chat?.enabled !== false,
              })}
              pathname={pathname}
            />
          }
        >
          {children}
        </SettingsShellContent>
      </PageWidgets>
    </RouteMessages>
  );
};
