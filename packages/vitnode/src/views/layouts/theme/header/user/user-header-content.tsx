import { LogOutIcon, Settings2Icon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Avatar } from "@/components/avatar";
import { NewTabIndicator } from "@/components/new-tab-indicator";
import { ThemeSwitcherMenu } from "@/components/switchers/themes/theme-switcher-menu";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenuIdentity } from "@/components/user-menu-identity";

import type {
  UserHeaderLinkComponent,
  UserHeaderState,
  UserHeaderUser,
} from "./user-header-model";

import { USER_HEADER_HREF, userHeaderMenu } from "./user-header-model";

export const UserHeaderSkeleton = () => <Skeleton className="h-9 w-32" />;

export type UserHeaderSignOut = () => Promise<void> | void;

const PreferencesMenu = ({
  languageSwitcher,
}: {
  languageSwitcher?: React.ReactNode;
}) => {
  const t = useTranslations("core.global");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button aria-label={t("preferences")} size="icon" variant="ghost" />
        }
      >
        <Settings2Icon />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48 p-2">
        <ThemeSwitcherMenu />
        {languageSwitcher}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const AnonymousUserHeader = ({
  languageSwitcher,
  LinkComponent,
}: {
  languageSwitcher?: React.ReactNode;
  LinkComponent: UserHeaderLinkComponent;
}) => {
  const t = useTranslations("core.global");

  return (
    <>
      <PreferencesMenu languageSwitcher={languageSwitcher} />

      <LinkComponent
        className={buttonVariants({ variant: "ghost" })}
        href={USER_HEADER_HREF.signIn}
      >
        {t("login")}
      </LinkComponent>

      <LinkComponent
        className={buttonVariants()}
        href={USER_HEADER_HREF.signUp}
      >
        {t("register")}
      </LinkComponent>
    </>
  );
};

const AuthenticatedUserHeader = ({
  languageSwitcher,
  LinkComponent,
  onSignOut,
  user,
}: {
  languageSwitcher?: React.ReactNode;
  LinkComponent: UserHeaderLinkComponent;
  onSignOut: UserHeaderSignOut;
  user: UserHeaderUser;
}) => {
  const t = useTranslations("core.global.user_bar");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button aria-label={user.name} size="icon" variant="ghost" />}
      >
        <Avatar size={24} user={user} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 p-2">
        <DropdownMenuLabel className="flex items-center gap-2 p-1 font-normal">
          <UserMenuIdentity user={user} />
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {userHeaderMenu(user).map(group => (
          <React.Fragment key={group[0].key}>
            <DropdownMenuGroup>
              {group.map(({ href, Icon, key, newTab }) => (
                <DropdownMenuItem
                  key={key}
                  render={
                    <LinkComponent
                      href={href}
                      target={newTab ? "_blank" : undefined}
                    />
                  }
                >
                  <Icon />
                  <span>{t(key)}</span>
                  {newTab && <NewTabIndicator />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
          </React.Fragment>
        ))}

        <DropdownMenuGroup>
          <ThemeSwitcherMenu />
          {languageSwitcher}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onSignOut} variant="destructive">
            <LogOutIcon />
            <span>{t("log_out")}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const UserHeaderContent = ({
  languageSwitcher,
  LinkComponent,
  onSignOut,
  state,
}: {
  languageSwitcher?: React.ReactNode;
  LinkComponent: UserHeaderLinkComponent;
  onSignOut: UserHeaderSignOut;
  state: UserHeaderState;
}) => {
  if (state.status === "loading") return <UserHeaderSkeleton />;

  if (state.status === "anonymous") {
    return (
      <AnonymousUserHeader
        languageSwitcher={languageSwitcher}
        LinkComponent={LinkComponent}
      />
    );
  }

  return (
    <AuthenticatedUserHeader
      languageSwitcher={languageSwitcher}
      LinkComponent={LinkComponent}
      onSignOut={onSignOut}
      user={state.user}
    />
  );
};
