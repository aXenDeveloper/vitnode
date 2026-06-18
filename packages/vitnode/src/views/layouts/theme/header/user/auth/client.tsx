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
        <DropdownMenuItem asChild>
          <Link href={`/users/${user.nameCode}`}>
            <UserIcon />
            <span>{t("my_profile")}</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/settings/overview">
            <Settings />
            <span>{t("settings")}</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuGroup>

      <DropdownMenuSeparator />

      {(user.isAdmin || user.isModerator) && (
        <>
          <DropdownMenuGroup>
            {user.isModerator && (
              <DropdownMenuItem asChild>
                <Link href="/mod_cp">
                  <ShieldIcon />
                  <span>{t("mod_cp")}</span>
                </Link>
              </DropdownMenuItem>
            )}
            {user.isAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/admin" target="_blank">
                  <KeyRoundIcon />
                  <span>{t("admin_cp")}</span>
                </Link>
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
