"use client";

import { BugIcon, HomeIcon, LogOut } from "lucide-react";
import { useTranslations } from "use-intl";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { Avatar } from "@/components/avatar";
import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CONFIG_PLUGIN } from "@/config";

export interface AdminUserBarUser {
  avatarColor: string;
  email: string;
  name: string;
  nameCode: string;
}

export const UserBarAdminContent = ({
  LinkComponent,
  onSignOut,
  user,
}: {
  LinkComponent: AuthLinkComponent;
  onSignOut: () => Promise<void> | void;
  user: AdminUserBarUser;
}) => {
  const t = useTranslations("admin.global.nav.user_bar");
  const canViewDebug = useAdminStaffPermission({
    plugin: CONFIG_PLUGIN.pluginId,
    module: "debug",
    permission: "can_view",
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button aria-label={user.name} size="icon" variant="ghost" />}
      >
        <Avatar size={24} user={user} />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-(--anchor-width) min-w-56 rounded-lg"
        side="bottom"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex flex-col px-2 py-2 text-left">
            <span className="font-medium">{user.name}</span>
            <span className="text-muted-foreground text-xs">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<LinkComponent href="/" target="_blank" />}>
            <HomeIcon />
            {t("home_page")}
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
        <DropdownMenuItem
          className="text-destructive data-highlighted:text-destructive"
          onClick={onSignOut}
        >
          <LogOut />
          {t("log_out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
