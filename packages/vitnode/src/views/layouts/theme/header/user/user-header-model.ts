import type { LucideIcon } from "lucide-react";

import { FileIcon, KeyRoundIcon, SettingsIcon, UserIcon } from "lucide-react";

export interface UserHeaderLinkProps extends Omit<
  React.ComponentProps<"a">,
  "href"
> {
  href: string;
}

export type UserHeaderLinkComponent = (
  props: UserHeaderLinkProps,
) => React.ReactNode;

export interface UserHeaderUser {
  avatarColor: string;
  isAdmin: boolean;
  name: string;
  nameCode: string;
}

export type UserHeaderState =
  | { status: "anonymous" }
  | { status: "authenticated"; user: UserHeaderUser }
  | { status: "loading" };

export const USER_HEADER_HREF = {
  adminCp: "/admin",
  files: "/files",
  settings: "/settings",
  signIn: "/login",
  signUp: "/register",
} as const;

export const userProfileHref = (nameCode: string): string =>
  `/users/${encodeURIComponent(nameCode)}`;

/**
 * One item in the user menu.
 *
 * `key` is both the React key and the `core.global.user_bar` message key, which
 * is deliberate: an item cannot exist without a label, and a second field
 * holding the same string is a second thing to keep in step.
 */
export interface UserHeaderMenuItem {
  href: string;
  Icon: LucideIcon;
  key: UserHeaderMenuItemKey;
  /** Opens in a new tab, as the AdminCP link always has. */
  newTab?: boolean;
}

export type UserHeaderMenuItemKey =
  "admin_cp" | "files" | "my_profile" | "settings";

/**
 * The signed-in visitor's menu, grouped exactly as it is drawn.
 *
 * Groups rather than a flat list because the separators are part of the design
 * and are not per-item: the account links are one block, the staff link its own,
 * and sign-out - which is not a link and so is not here - a third that the
 * component always appends. An empty group is never returned, so the component
 * can put a separator after every one of them without ever drawing a stray rule.
 *
 * ## Only `isAdmin` branches
 *
 * `isModerator` exists in the session response and is hardcoded `false` (see
 * `session.route.ts`: `// TODO: implement moderator role`), and the `/mod_cp`
 * page it used to link to does not exist in either application. So the item was
 * unreachable copy pointing at a 404, and it is deliberately not carried over -
 * there is no moderator role to model yet, and a menu that renders one would
 * start linking to a missing page the day the API answers `true`.
 */
export const userHeaderMenu = (
  user: UserHeaderUser,
): UserHeaderMenuItem[][] => {
  const account: UserHeaderMenuItem[] = [
    {
      href: userProfileHref(user.nameCode),
      Icon: UserIcon,
      key: "my_profile",
    },
    { href: USER_HEADER_HREF.files, Icon: FileIcon, key: "files" },
    { href: USER_HEADER_HREF.settings, Icon: SettingsIcon, key: "settings" },
  ];

  if (!user.isAdmin) return [account];

  return [
    account,
    [
      {
        href: USER_HEADER_HREF.adminCp,
        Icon: KeyRoundIcon,
        key: "admin_cp",
        newTab: true,
      },
    ],
  ];
};

export const userHeaderState = ({
  isError = false,
  session,
}: {
  isError?: boolean;
  session?: undefined | { user: null | UserHeaderUser };
}): UserHeaderState => {
  if (session) {
    return session.user
      ? { status: "authenticated", user: session.user }
      : { status: "anonymous" };
  }

  return isError ? { status: "anonymous" } : { status: "loading" };
};
