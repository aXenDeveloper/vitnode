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

/**
 * The admin the user bar renders - four fields and no more.
 *
 * A *requirement* rather than a copy of the admin session response: both
 * applications' session shapes satisfy it structurally, so neither has to
 * reshape anything, and a field renamed in the API fails at the two call sites
 * rather than being silently rendered as `undefined`.
 */
export interface AdminUserBarUser {
  avatarColor: string;
  email: string;
  name: string;
  nameCode: string;
}

/**
 * The AdminCP user menu, with the two things it cannot decide for itself handed
 * in.
 *
 *     a link      ->  LinkComponent   the framework's, or the host's migration one
 *     sign-out    ->  onSignOut       the shared auth action, bound by the caller
 *
 * Sign-out is a *prop* rather than an import, and that is the whole reason this
 * file exists. The Next.js menu called a `"use server"` action directly; a
 * TanStack Start host signs out through `useSignOutAction()`, which also brings
 * the canonical session cache back in step before anything navigates. Importing
 * either here would pick one framework, so the component asks its caller and
 * stays out of it.
 *
 * ## The debug entry is gated, and the gate is not a security boundary
 *
 * `useAdminStaffPermission` hides the link when this admin cannot view the debug
 * screen - the same permission tuple the API checks. Hiding it is a courtesy to
 * the reader; the page itself is still refused by Hono, which re-checks the
 * staff permission tables on every request. See `api/lib/check-staff-permission`.
 *
 * Reading permissions here needs no Suspense boundary: by the time this renders,
 * the shell has mounted a provider holding an already-resolved permission set.
 */
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
