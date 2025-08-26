"use client";

import { BugIcon, HomeIcon, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/lib/navigation";
import { logOutMutationApi } from "@/views/layouts/theme/header/user/auth/log-out-mutation-api";

export const ClientUserBarAdmin = ({
  user,
}: {
  user: {
    email: string;
    name: string;
  };
}) => {
  const t = useTranslations("admin.global.nav.user_bar");

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
        <DropdownMenuItem asChild>
          <Link href="/" target="_blank">
            <HomeIcon />
            {t("home_page")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin/core/debug">
            <BugIcon />
            {t("debug")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="text-destructive focus:text-destructive"
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
