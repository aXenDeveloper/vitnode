"use client";

import { useRouterState } from "@tanstack/react-router";
import React from "react";

import type { AdminUserSearch } from "@/views/admin/layouts/search/search-users";
import type { AdminNavBundle } from "@/views/admin/layouts/sidebar/nav/nav-model";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { NavSidebarAdminContent } from "@/views/admin/layouts/sidebar/nav/nav-content";
import { SidebarAdminContent } from "@/views/admin/layouts/sidebar/sidebar-content";

import { RouteMessages } from "../i18n/route-messages";
import { RouterLink } from "../layout/router-link";
import { useAdminBreadcrumb } from "./breadcrumb";
import { adminShellNamespaces } from "./intl";
import { AdminNavProvider, useAdminNav } from "./nav";
import { AdminPermissionsProvider } from "./permissions";
import { AdminSearch } from "./search";
import { AdminUserBar } from "./user-bar";

/**
 * The AdminCP shell, on TanStack Start.
 *
 * The same document the Next.js `AdminLayout` renders - floating sidebar, a
 * 16-unit sticky header carrying the trigger, the breadcrumb, the palette and
 * the user menu, and one `<main>` - assembled from the same components. The two
 * frameworks cannot drift into two AdminCPs because there is only one set of
 * parts.
 *
 * ## It is its own shell, not a page inside the public one
 *
 * Mounted by `_admin`, which is a sibling of `_main` rather than a child. The
 * AdminCP has its own header, its own navigation and its own `<main>`; nesting
 * it under the public shell would give every admin screen the site header above
 * it and a second `<main>` landmark inside it. `SidebarInset` *is* the `<main>`,
 * exactly as in the Next.js layout, so a page renders its own container and
 * padding and never a landmark.
 *
 * ## What the shell mounts, in order, and why
 *
 *     RouteMessages              the shell's strings, plus the navigation's
 *     AdminPermissionsProvider   the resolved permission set
 *     AdminNavProvider           one navigation, read by sidebar + palette + trail
 *     SidebarProvider            the open/collapsed state and the mobile drawer
 *
 * `RouteMessages` is outermost, and it is the shell's own provider rather than
 * something a page can be relied on to bring. Most of what the chrome renders -
 * the palette's label, the user menu, core's own sidebar entries - is an
 * `admin.global` key, and the root route provides `core.global` alone. Without a
 * provider here `useTranslations` in `AdminNavProvider` finds no message for
 * `admin.global.nav.core` and renders the key itself, so the whole sidebar reads
 * as dotted identifiers in every language. A page's own `RouteMessages` cannot
 * cover it: the pages mount *below* `{children}` and the chrome is above them.
 *
 * The rest is the navigation's, and it is why {@link AdminShellContent} takes a
 * `nav` bundle rather than bare declarations. A plugin group's heading is
 * `{pluginId}.title`, a content type's noun is under `{pluginId}.content.…`, and
 * a declared entry is under `{pluginId}.admin.nav` - none of which a package can
 * know in advance. `adminNavBundle` derives that list from the same declarations
 * the sidebar is built from, so the two cannot disagree, and `adminShellNamespaces`
 * joins it to the shell's own two.
 *
 * It reads rather than fetches - `_admin`'s loader has already warmed the
 * identical `intlQueryOptions` through `loadAdminMessages`, from the same
 * namespace list - so nothing suspends here. A screen still mounts its own with
 * its feature namespace, which replaces this one for its subtree; both lists
 * start with `core.global`, so nothing a page renders loses the design system's
 * strings.
 *
 * The permission provider is outermost of the two data providers because the
 * navigation is a function of what it holds. Neither suspends by the time this
 * renders: `_admin`'s `beforeLoad` has already resolved the admin session, and a
 * failed read never arrives here at all - the query rejects and the route's
 * error boundary owns the screen. An empty permission set reaching this tree
 * always means "asked, and this browser holds nothing", never "could not find
 * out".
 *
 * ## What a host still supplies
 *
 * Only what a package cannot answer: how the palette moves without a link
 * (`onNavigate` - Enter on a highlighted entry is a navigation nobody clicked),
 * which language switcher to render, how to look a user up, and its own AdminCP
 * navigation - the declarations *and* the namespaces they need - built from the
 * plugins that application actually configured. `LinkComponent` is there too,
 * but it defaults to `RouterLink` and most hosts leave it alone.
 *
 * Sign-out is deliberately **not** on that list. It is the canonical action plus
 * the shell's own cache clearing, and a host that could replace it could replace
 * it incompletely - see the note on `AdminUserBar`.
 */
export const AdminShellContent = ({
  children,
  languageSwitcher,
  LinkComponent = RouterLink,
  nav,
  onNavigate,
  searchUsers,
}: {
  children: React.ReactNode;
  /** The host's language switcher, or nothing on a single-language install. */
  languageSwitcher?: React.ReactNode;
  LinkComponent?: AuthLinkComponent;
  /**
   * This installation's AdminCP navigation, from `adminNavBundle(...)`.
   *
   * The declarations and the namespaces they render from, together, because
   * passing one without the other is a sidebar of dotted identifiers rather than
   * an error. Omitted, the shell renders core's own navigation and loads only
   * its own strings - which is exactly right for an application with no plugin
   * navigation to declare.
   */
  nav?: AdminNavBundle;
  onNavigate?: (href: string) => void;
  searchUsers?: AdminUserSearch;
}) => {
  // Memoised on the bundle rather than recomputed per render: this list is the
  // `RouteMessages` query's input, and a host holds its bundle at module scope,
  // so one array identity per bundle is one provider that never re-mounts.
  const namespaces = React.useMemo(
    () => adminShellNamespaces(nav?.namespaces),
    [nav],
  );

  return (
    <RouteMessages namespaces={namespaces}>
      <AdminPermissionsProvider>
        <AdminNavProvider declarations={nav?.declarations}>
          <AdminShellFrame
            languageSwitcher={languageSwitcher}
            LinkComponent={LinkComponent}
            onNavigate={onNavigate}
            searchUsers={searchUsers}
          >
            {children}
          </AdminShellFrame>
        </AdminNavProvider>
      </AdminPermissionsProvider>
    </RouteMessages>
  );
};

/**
 * The frame, split from the providers so it can read them.
 *
 * A component cannot consume a context its own element mounts, and the sidebar
 * needs the navigation - so the providers go above and everything that reads
 * them goes here.
 */
const AdminShellFrame = ({
  children,
  languageSwitcher,
  LinkComponent,
  onNavigate,
  searchUsers,
}: {
  children: React.ReactNode;
  languageSwitcher?: React.ReactNode;
  LinkComponent: AuthLinkComponent;
  onNavigate?: (href: string) => void;
  searchUsers?: AdminUserSearch;
}) => {
  const nav = useAdminNav();
  const breadcrumb = useAdminBreadcrumb();
  /**
   * Where the visitor is, as the router's *internal* pathname.
   *
   * Subscribed through `useRouterState` rather than read from a match, because
   * the sidebar highlight has to change on every navigation within the subtree -
   * including the ones that do not remount this. `/admin` is outside the
   * localized URL space, so there is no locale prefix to strip.
   */
  const pathname = useRouterState({ select: state => state.location.pathname });

  return (
    <SidebarProvider>
      <SidebarAdminContent
        languageSwitcher={languageSwitcher}
        LinkComponent={LinkComponent}
      >
        <NavSidebarAdminContent
          LinkComponent={LinkComponent}
          nav={nav}
          pathname={pathname}
        />
      </SidebarAdminContent>

      <SidebarInset>
        <header className="bg-background sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1 shrink-0" />
          {breadcrumb != null && (
            <>
              <Separator className="mr-1 h-4 shrink-0" orientation="vertical" />
              <div className="min-w-0 flex-1">{breadcrumb}</div>
            </>
          )}

          <div className="ml-auto flex shrink-0 items-center justify-center gap-2 px-2">
            <AdminSearch
              LinkComponent={LinkComponent}
              onNavigate={onNavigate}
              searchUsers={searchUsers}
            />
            <AdminUserBar LinkComponent={LinkComponent} />
          </div>
        </header>

        {children}
      </SidebarInset>
    </SidebarProvider>
  );
};
