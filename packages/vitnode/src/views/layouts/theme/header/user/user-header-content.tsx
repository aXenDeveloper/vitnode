"use client";

import { LogOutIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Avatar } from "@/components/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

import type {
  UserHeaderLinkComponent,
  UserHeaderState,
  UserHeaderUser,
} from "./user-header-model";

import { USER_HEADER_HREF, userHeaderMenu } from "./user-header-model";

export const UserHeaderSkeleton = () => <Skeleton className="h-9 w-32" />;

export type UserHeaderSignOut = () => Promise<void> | void;

const AnonymousUserHeader = ({
  LinkComponent,
}: {
  LinkComponent: UserHeaderLinkComponent;
}) => {
  const t = useTranslations("core.global");

  return (
    <>
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
  LinkComponent,
  onSignOut,
  user,
}: {
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
        {userHeaderMenu(user).map(group => (
          // Every group is followed by a separator, and the sign-out group
          // below is what the last one separates from. `userHeaderMenu` never
          // returns an empty group, so this cannot draw a stray rule.
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
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
          </React.Fragment>
        ))}

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onSignOut}>
            <LogOutIcon />
            <span>{t("log_out")}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const UserHeaderContent = ({
  LinkComponent,
  onSignOut,
  state,
}: {
  LinkComponent: UserHeaderLinkComponent;
  onSignOut: UserHeaderSignOut;
  state: UserHeaderState;
}) => {
  if (state.status === "loading") return <UserHeaderSkeleton />;

  if (state.status === "anonymous") {
    return <AnonymousUserHeader LinkComponent={LinkComponent} />;
  }

  return (
    <AuthenticatedUserHeader
      LinkComponent={LinkComponent}
      onSignOut={onSignOut}
      user={state.user}
    />
  );
};
