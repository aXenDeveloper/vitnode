import { useRouterState } from "@tanstack/react-router";

import { SettingsNavContent } from "@/views/auth/settings/nav-content";
import { SettingsShellContent } from "@/views/auth/settings/shell-content";
import {
  SETTINGS_ZONE_IDS,
  settingsPage,
} from "@/views/auth/settings/widgets/settings-page";

import { RouteMessages } from "../i18n/route-messages";
import { PageWidgets, PageWidgetsZone } from "../widgets";
import { SETTINGS_NAMESPACES } from "./route";

export const SettingsLayoutContent = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const pathname = useRouterState({ select: state => state.location.pathname });

  return (
    <RouteMessages namespaces={SETTINGS_NAMESPACES}>
      <PageWidgets page={settingsPage}>
        <SettingsShellContent
          footer={<PageWidgetsZone id={SETTINGS_ZONE_IDS.footer} />}
          header={<PageWidgetsZone id={SETTINGS_ZONE_IDS.header} />}
          nav={<SettingsNavContent pathname={pathname} />}
          pathname={pathname}
        >
          {children}
        </SettingsShellContent>
      </PageWidgets>
    </RouteMessages>
  );
};
