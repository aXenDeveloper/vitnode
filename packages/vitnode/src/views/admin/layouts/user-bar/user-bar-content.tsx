import {
  BugIcon,
  ChevronsUpDownIcon,
  CircleAlertIcon,
  GlobeIcon,
  HomeIcon,
  LogOut,
} from "lucide-react";
import { useTranslations } from "use-intl";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { NewTabIndicator } from "@/components/new-tab-indicator";
import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { ThemeSwitcherMenu } from "@/components/switchers/themes/theme-switcher-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { UserMenuIdentity } from "@/components/user-menu-identity";
import { CONFIG_PLUGIN } from "@/config";
import { VITNODE_ISSUES_URL, VITNODE_WEBSITE_URL } from "@/lib/docs-links";

export interface AdminUserBarUser {
  avatarColor: string;
  email: string;
  name: string;
  nameCode: string;
}

export const UserBarAdminContent = ({
  languageSwitcher,
  LinkComponent,
  onSignOut,
  user,
}: {
  languageSwitcher?: React.ReactNode;
  LinkComponent: AuthLinkComponent;
  onSignOut: () => Promise<void> | void;
  user: AdminUserBarUser;
}) => {
  const t = useTranslations("admin.global.nav.user_bar");
  const { isMobile } = useSidebar();
  const canViewDebug = useAdminStaffPermission({
    plugin: CONFIG_PLUGIN.pluginId,
    module: "debug",
    permission: "can_view",
  });

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                aria-label={user.name}
                className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
                size="lg"
              />
            }
          >
            <UserMenuIdentity user={user} />
            <ChevronsUpDownIcon className="ms-auto" />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-(--anchor-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="flex items-center gap-2 p-1 font-normal">
              <UserMenuIdentity user={user} />
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                render={<LinkComponent href="/" target="_blank" />}
              >
                <HomeIcon />
                {t("home_page")}
                <NewTabIndicator />
              </DropdownMenuItem>
              {canViewDebug && (
                <DropdownMenuItem
                  render={<LinkComponent href="/admin/core/debug" />}
                >
                  <BugIcon />
                  {t("debug")}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                render={
                  <a
                    href={VITNODE_WEBSITE_URL}
                    rel="noopener noreferrer"
                    target="_blank"
                  />
                }
              >
                <GlobeIcon />
                {t("website")}
                <NewTabIndicator />
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <a
                    href={VITNODE_ISSUES_URL}
                    rel="noopener noreferrer"
                    target="_blank"
                  />
                }
              >
                <CircleAlertIcon />
                {t("report_issue")}
                <NewTabIndicator />
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <ThemeSwitcherMenu />
              {languageSwitcher}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut} variant="destructive">
              <LogOut />
              {t("log_out")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
