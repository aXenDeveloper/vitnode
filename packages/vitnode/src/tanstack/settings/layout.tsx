import { useRouterState } from "@tanstack/react-router";

import { SettingsNavContent } from "@/views/auth/settings/nav-content";
import { SettingsShellContent } from "@/views/auth/settings/shell-content";

import { RouteMessages } from "../i18n/route-messages";
import { SETTINGS_NAMESPACES } from "./route";

export const SettingsLayoutContent = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const pathname = useRouterState({ select: state => state.location.pathname });

  return (
    <RouteMessages namespaces={SETTINGS_NAMESPACES}>
      <SettingsShellContent nav={<SettingsNavContent pathname={pathname} />}>
        {children}
      </SettingsShellContent>
    </RouteMessages>
  );
};
