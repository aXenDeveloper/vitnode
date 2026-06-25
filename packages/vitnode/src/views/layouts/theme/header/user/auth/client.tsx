"use client";

import {
  KeyRoundIcon,
  LogOutIcon,
  Settings,
  ShieldIcon,
  UserIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { SessionApi } from "@/lib/api/get-session-api";

import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/lib/navigation";

import { logOutMutationApi } from "./log-out-mutation-api";

export const ClientAuthUserHeader = ({
  user,
}: {
  user: NonNullable<SessionApi["user"]>;
}) => {
  const t = useTranslations("core.global.user_bar");

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuItem render={<Link href={`/users/${user.nameCode}`} />}>
          <UserIcon />
          <span>{t("my_profile")}</span>
        </DropdownMenuItem>

        <DropdownMenuItem render={<Link href="/settings" />}>
          <Settings />
          <span>{t("settings")}</span>
        </DropdownMenuItem>
      </DropdownMenuGroup>

      <DropdownMenuSeparator />

      {(user.isAdmin || user.isModerator) && (
        <>
          <DropdownMenuGroup>
            {user.isModerator && (
              <DropdownMenuItem render={<Link href="/mod_cp" />}>
                <ShieldIcon />
                <span>{t("mod_cp")}</span>
              </DropdownMenuItem>
            )}
            {user.isAdmin && (
              <DropdownMenuItem render={<Link href="/admin" target="_blank" />}>
                <KeyRoundIcon />
                <span>{t("admin_cp")}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
        </>
      )}

      <DropdownMenuGroup>
        <DropdownMenuItem
          onClick={async () => {
            await logOutMutationApi({});
          }}
        >
          <LogOutIcon />
          <span>{t("log_out")}</span>
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>
  );
};
