"use client";

import { useRouterState } from "@tanstack/react-router";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { SettingsNavContent } from "@/views/auth/settings/nav-content";
import { isSettingsRootPath } from "@/views/auth/settings/settings-nav";
import { SettingsShellContent } from "@/views/auth/settings/shell-content";

import { RouteMessages } from "../i18n/route-messages";
import { SETTINGS_NAMESPACES } from "./index";

/**
 * The settings frame - the heading, the navigation card, and the panel every
 * settings page renders inside.
 *
 * What it owns, so that no panel does: the `container`, the `<h1>` and its
 * description, the navigation card, the panel card, the mobile back link and the
 * narrow-screen rule that shows the menu on `/settings` and the panel everywhere
 * else. A panel route renders only its own contents.
 *
 * `SettingsShellContent` and `SettingsNavContent` are the same modules the
 * Next.js layout renders. The one thing neither can resolve for itself is how to
 * build a link, which is why `LinkComponent` is a prop: this module is shared
 * with hosts that are not on TanStack Router, so it may not import one. A
 * TanStack Start host passes `RouterLink`.
 *
 * ## What a panel may assume about the provider
 *
 * That `RouteMessages` is above it - in its component *and in its
 * `pendingComponent`* - so a panel's loading fallback may translate without
 * mounting a provider of its own. The guarantee is structural rather than
 * incidental: a panel's `pendingComponent` renders into the host layout's
 * `<Outlet />`, and that `<Outlet />` is this component's `children`, which only
 * exist once this has run.
 *
 * The one thing *not* covered by it is a `pendingComponent` on the layout route
 * itself. It renders in place of this - above the provider, not inside it - so
 * it must either avoid translating or mount `RouteMessages` itself.
 */
export const SettingsLayoutContent = ({
  children,
  LinkComponent,
}: {
  children: React.ReactNode;
  LinkComponent: AuthLinkComponent;
}) => {
  /**
   * Where the visitor is, as the router's *internal* pathname.
   *
   * Internal is the whole point: the locale rewrite has already stripped the
   * prefix, so `/pl/settings/security` arrives here as `/settings/security` and
   * the shared rules in `settings-nav.ts` compare plain paths. A rule that had to
   * cope with a prefix would be a second copy of the locale routing.
   *
   * Subscribed through `useRouterState` rather than read from a match, because
   * the nav highlight and the narrow-screen behaviour have to change on every
   * navigation within the subtree - including the ones that do not remount this.
   */
  const pathname = useRouterState({ select: state => state.location.pathname });

  return (
    <RouteMessages namespaces={SETTINGS_NAMESPACES}>
      <SettingsShellContent
        BackLink={LinkComponent}
        isRoot={isSettingsRootPath(pathname)}
        nav={
          <SettingsNavContent
            LinkComponent={LinkComponent}
            pathname={pathname}
          />
        }
      >
        {children}
      </SettingsShellContent>
    </RouteMessages>
  );
};
