"use client";

import { useRouterState } from "@tanstack/react-router";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { SettingsNavContent } from "@/views/auth/settings/nav-content";
import { isSettingsRootPath } from "@/views/auth/settings/settings-nav";
import { SettingsShellContent } from "@/views/auth/settings/shell-content";

import { RouteMessages } from "../i18n/route-messages";
import { SETTINGS_NAMESPACES } from "./route";

export const SettingsLayoutContent = ({
  children,
  LinkComponent,
}: {
  children: React.ReactNode;
  LinkComponent: AuthLinkComponent;
}) => {
  const pathname = useRouterState({ select: state => state.location.pathname });

  return (
    <RouteMessages namespaces={SETTINGS_NAMESPACES}>
      <SettingsShellContent
        BackLink={LinkComponent}
        isRoot={isSettingsRootPath(pathname)}
        nav={
          <SettingsNavContent
            LinkComponent={LinkComponent}
            pathname={pathname}
          />
        }
      >
        {children}
      </SettingsShellContent>
    </RouteMessages>
  );
};
