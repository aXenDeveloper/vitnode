import type { LucideIcon } from "lucide-react";

import { FileIcon, KeyRoundIcon, SettingsIcon, UserIcon } from "lucide-react";

/**
 * The user area of the main header, as data.
 *
 * No JSX, no framework and no I/O, so the three questions the header actually
 * answers - who is asking, which items they get, and where each one leads - can
 * be stated and tested without a router, a session or a DOM. The component in
 * `user-header-content.tsx` renders exactly what this returns and decides
 * nothing itself.
 *
 * That split is what makes the same header work in both applications. The
 * Next.js app resolves the session in a Server Component; the TanStack Start app
 * reads it from the canonical session query (`#/lib/auth/query` in `apps/web`).
 * Both end up handing a {@link UserHeaderState} to one component.
 *
 * ## What it is not
 *
 * Not an authorization rule. `isAdmin` decides whether to *draw a link*, and
 * nothing more: the AdminCP runs on its own session with its own sign-in, and
 * every private read is authorized by Hono from the session cookie. A visitor
 * who edits a cached session gets an extra menu item and an API that still
 * refuses them.
 */

/**
 * The anchor a user-header link ends up rendering.
 *
 * Every prop of one, not just `href`: the menu items put a link inside a Base UI
 * `render`, which clones the element with the children, the class name and the
 * ref it needs to stay a menu item. A wrapper accepting only `href` would drop
 * all three, so the type says so.
 */
export interface UserHeaderLinkProps extends Omit<
  React.ComponentProps<"a">,
  "href"
> {
  href: string;
}

/**
 * The one thing this header cannot decide for itself.
 *
 * Turning `/settings` into a navigation is the single question whose answer
 * differs by host: a TanStack Start app wants the router's own `Link`, and a
 * host that mounts VitNode differently wants its own. Each is a component taking
 * {@link UserHeaderLinkProps}, so the header takes one and stops caring - and
 * importing none of them is what keeps this file host-neutral.
 *
 * Required rather than defaulting to `<a>`: a missing wrapper would degrade
 * silently into a full document reload on every menu item.
 */
export type UserHeaderLinkComponent = (
  props: UserHeaderLinkProps,
) => React.ReactNode;

/**
 * The visitor, as the header needs them - four fields and no more.
 *
 * A *requirement* rather than a copy of the session response: both applications'
 * `SessionApi["user"]` satisfy it structurally, so neither has to reshape
 * anything and a field renamed in `api/modules/users/routes/session.route.ts`
 * fails at the two call sites rather than being silently rendered as
 * `undefined`. The same shape `Avatar` already asks for, plus the one flag the
 * menu branches on.
 */
export interface UserHeaderUser {
  avatarColor: string;
  isAdmin: boolean;
  name: string;
  nameCode: string;
}

/**
 * A session as the state the header renders.
 *
 * Three states rather than a nullable user, because "we do not know yet" is a
 * real one and the header is on every page: the Next.js app answers it with a
 * `<Suspense>` fallback while the Server Component awaits the session, and the
 * TanStack Start app with a query that has not resolved. Both need a placeholder
 * of the right size, and a `user: null` that meant both "signed out" and "still
 * loading" would render the login buttons for a moment to somebody who is signed
 * in.
 */
export type UserHeaderState =
  | { status: "anonymous" }
  | { status: "authenticated"; user: UserHeaderUser }
  | { status: "loading" };

/**
 * Where the header links to.
 *
 * Ordinary data, not a route table - nothing here derives an href from a route
 * file, and nothing here is conditional on a route existing. The *link
 * component* turns each one into a navigation, so a route that moves needs no
 * edit here.
 *
 * That is a claim worth having been tested rather than asserted, and it has
 * been: every href in this record has changed which framework renders it at
 * least once, and none of those changes edited this file.
 * `apps/web/src/tests/header-navigation.test.ts` pins it.
 */
export const USER_HEADER_HREF = {
  adminCp: "/admin",
  files: "/files",
  settings: "/settings",
  signIn: "/login",
  signUp: "/register",
} as const;

/**
 * A visitor's own profile page.
 *
 * `encodeURIComponent` because a name code reaches this from the API and a path
 * segment is not a place to interpolate an unescaped string. Today's codes are
 * slug-safe and it is a no-op for all of them.
 */
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

/**
 * A session read as the state the header renders.
 *
 * Total and pure, and the one place the three states are decided:
 *
 *     a session      -> its `user` decides: signed in, or anonymous
 *     no session yet  -> loading, unless the read has already failed
 *     a failed read   -> anonymous
 *
 * ## A failed read shows the guest controls
 *
 * Which is the existing behaviour rather than a new decision: the Next.js
 * `getSessionApi()` answers `{ user: null }` for any non-200, so an outage has
 * always rendered the login buttons. The header has to draw *something* and a
 * permanent skeleton is not it.
 *
 * Note what it is not: this is not a route guard, and it must not be used as
 * one. `#/lib/auth/query`'s `ensureAuthState` deliberately *rejects* on a failed
 * read so that a guard never signs anybody out because of a 500 - see the long
 * note in `#/lib/auth/shared`. Drawing a login button for a visitor who is
 * actually signed in costs them one click; sending them to the login page costs
 * them the page they were on.
 *
 * A session already in hand wins over an error, so a signed-in visitor keeps
 * their header through a failed *refetch* rather than flickering to anonymous
 * and back.
 */
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
