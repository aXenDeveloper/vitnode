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

/**
 * The user area of the main header, rendered by both applications.
 *
 * Presentation only, and framework-free on purpose: it reaches nothing from
 * `next/*`, nothing from `next-intl`'s Next-only entries and no server action,
 * so a TanStack Start route renders exactly what the Next.js header renders. The
 * three things it cannot decide for itself - the session, how a path becomes a
 * navigation, and what ends a session - arrive as props.
 *
 *     UserHeaderContent
 *       state === "loading"        -> the placeholder, at the size of the real thing
 *       state === "anonymous"      -> log in, register
 *       state === "authenticated"  -> avatar -> account links, staff link, sign out
 *
 * It does not fetch the session. That is the whole reason it is reusable: the two
 * applications get it from places that have nothing in common - a Server
 * Component awaiting `getSessionApi()`, and the one canonical session query a
 * router's guards already read - and a component that asked for it itself would
 * be a second source of truth in the app that already has one.
 *
 * The same boundary `SearchFeedContent`, `HeaderContent` and the auth screens
 * draw, for the same reason.
 */

/**
 * What stands in for the user area while the session is unknown.
 *
 * `h-9 w-32` is the size of the two guest buttons, which is the wider of the two
 * outcomes - so the header settles into its final width rather than growing when
 * the session lands. Exported because the Next.js header renders it as a
 * `<Suspense>` fallback *above* this component, before any state exists.
 */
export const UserHeaderSkeleton = () => <Skeleton className="h-9 w-32" />;

/**
 * Ending the session, as the header asks for it.
 *
 * Nothing is returned, because what happens next is entirely the caller's
 * business and the two answers share nothing: a Next.js server action
 * revalidates the layout and redirects, while TanStack Start replaces the cached
 * session and invalidates the router so the guards notice. The header's only job
 * is to say when.
 */
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
