"use client";

import { BugIcon, HomeIcon, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CONFIG_PLUGIN } from "@/config";
import { Link } from "@/lib/navigation";
import { logOutMutationApi } from "@/views/layouts/theme/header/user/auth/log-out-mutation-api.server";

export const ClientUserBarAdmin = ({
  user,
}: {
  user: {
    email: string;
    name: string;
  };
}) => {
  const t = useTranslations("admin.global.nav.user_bar");
  const canViewDebug = useAdminStaffPermission({
    plugin: CONFIG_PLUGIN.pluginId,
    module: "debug",
    permission: "can_view",
  });

  return (
    <>
      <DropdownMenuLabel className="p-0 font-normal">
        <div className="flex flex-col px-2 py-2 text-left">
          <span className="font-medium">{user.name}</span>
          <span className="text-muted-foreground text-xs">{user.email}</span>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem render={<Link href="/" target="_blank" />}>
          <HomeIcon />
          {t("home_page")}
        </DropdownMenuItem>
        {canViewDebug && (
          <DropdownMenuItem render={<Link href="/admin/core/debug" />}>
            <BugIcon />
            {t("debug")}
          </DropdownMenuItem>
        )}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="text-destructive data-highlighted:text-destructive"
        onClick={async () => {
          await logOutMutationApi({ isAdmin: true });
        }}
      >
        <LogOut />
        {t("log_out")}
      </DropdownMenuItem>
    </>
  );
};
