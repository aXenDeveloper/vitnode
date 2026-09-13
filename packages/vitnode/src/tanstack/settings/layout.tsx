import { Link, useRouterState } from "@tanstack/react-router";

import type { AuthLinkProps } from "@/views/auth/auth-link";

import { SettingsNavContent } from "@/views/auth/settings/nav-content";
import { SettingsShellContent } from "@/views/auth/settings/shell-content";

import { RouteMessages } from "../i18n/route-messages";
import { SETTINGS_NAMESPACES } from "./route";

const SettingsNavLink = ({ children, href, ...props }: AuthLinkProps) => (
  <Link {...props} activeOptions={{ exact: true }} to={href}>
    {children}
  </Link>
);

export const SettingsLayoutContent = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const pathname = useRouterState({ select: state => state.location.pathname });

  return (
    <RouteMessages namespaces={SETTINGS_NAMESPACES}>
      <SettingsShellContent
        nav={
          <SettingsNavContent
            LinkComponent={SettingsNavLink}
            pathname={pathname}
          />
        }
      >
        {children}
      </SettingsShellContent>
    </RouteMessages>
  );
};
