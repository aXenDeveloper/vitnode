import { useRouterState } from "@tanstack/react-router";

import { SettingsShellContent } from "@/views/auth/settings/shell-content";
import { ModcpNavContent } from "@/views/moderation/modcp/modcp-nav";

import { RouteMessages } from "../i18n/route-messages";
import { MODCP_NAMESPACES } from "./namespaces";

export const ModcpLayoutContent = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const pathname = useRouterState({ select: state => state.location.pathname });

  return (
    <RouteMessages namespaces={MODCP_NAMESPACES}>
      <SettingsShellContent nav={<ModcpNavContent pathname={pathname} />}>
        {children}
      </SettingsShellContent>
    </RouteMessages>
  );
};
