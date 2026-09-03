"use client";

import React from "react";
import { useTranslations } from "use-intl";

import type { AdminSearchNavItem } from "@/views/admin/layouts/search/flatten-nav";
import type {
  AdminNavGroupDeclaration,
  AdminNavTranslator,
  NavAdminParent,
} from "@/views/admin/layouts/sidebar/nav/nav-model";

import { flattenAdminNav } from "@/views/admin/layouts/search/flatten-nav";
import { adminSearchOnlyItems } from "@/views/admin/layouts/search/search-only-pages";
import {
  adminNavDeclarations,
  resolveAdminNav,
} from "@/views/admin/layouts/sidebar/nav/nav-model";

import { useAdminPermissions } from "./permissions";

/**
 * The AdminCP navigation, resolved once per render and read by everything that
 * needs it.
 *
 * Three things in the shell are the same list seen from different angles - the
 * sidebar, the command palette and the breadcrumb's labels - and the one thing
 * that must not happen is for them to be three lists. A second tree is a second
 * chance to forget a permission check, and the failure mode is a search box that
 * reveals the existence of every screen an admin cannot open, or a crumb that
 * names one. So it is resolved here, once, and shared.
 *
 * ## The two stages, and why this one is the second
 *
 * `adminNavDeclarations(config)` is stage one: pure, config-only, no admin and no
 * language. `resolveAdminNav` is stage two: it needs the permission set and the
 * translator, both of which only exist in a rendered browser tree. Splitting
 * them is what lets a host run stage one wherever its plugin registry actually
 * lives - which in a TanStack Start app is deliberately *not* the browser bundle
 * (see `apps/web/src/vitnode.shell.config.ts`, which omits `plugins` on
 * purpose).
 *
 * That is why `declarations` is a prop rather than something this reads from
 * `getVitNodeConfig()`. A host with no browser-side plugin registry passes
 * nothing and gets core's own navigation; a host that has projected its plugins'
 * navigation into browser-safe data passes that instead and the plugin groups
 * appear. `apps/web` does the second: `@vitnode/core/framework/admin-nav` writes
 * one literal import per configured plugin that exports an `admin/nav` module,
 * and `adminNavBundle` turns those into declarations plus the message namespaces
 * they need. Nothing here changes either way.
 *
 * No navigation is derived from a plugin's route tree: routes and navigation stay
 * separate concepts, and a nav entry may point at a plugin route, at a screen
 * another application serves, or at another origin entirely.
 */
interface AdminNavValue {
  nav: NavAdminParent[];
  searchItems: AdminSearchNavItem[];
}

const AdminNavContext = React.createContext<AdminNavValue | null>(null);

/**
 * Core's own navigation declarations - the fallback when a host passes none.
 *
 * A module-level constant rather than a call per render, so the memo below has a
 * stable identity to compare against and the whole tree is not rebuilt on every
 * keystroke in the palette.
 */
const CORE_ONLY_DECLARATIONS: AdminNavGroupDeclaration[] = adminNavDeclarations(
  { plugins: [] },
);

export const AdminNavProvider = ({
  children,
  declarations = CORE_ONLY_DECLARATIONS,
}: {
  children: React.ReactNode;
  /**
   * The navigation to resolve, before permissions and translation.
   *
   * Defaults to core's own. See the note above on why this is a prop.
   */
  declarations?: AdminNavGroupDeclaration[];
}) => {
  const permissions = useAdminPermissions();
  /**
   * The whole message tree, not a namespace.
   *
   * The keys this resolves are assembled at runtime and span namespaces - core's
   * own `admin.global.nav.*`, a plugin's `{pluginId}.admin.nav.*`, a content
   * type's `{pluginId}.content.*` - so a namespaced translator could not reach
   * them. The cast is the one `ContentLabelTranslator` exists for: `use-intl`
   * types its keys as a union of every message in the catalogue, which a runtime
   * key cannot satisfy.
   */
  const t = useTranslations() as unknown as AdminNavTranslator;

  const value = React.useMemo<AdminNavValue>(() => {
    const nav = resolveAdminNav({ declarations, permissions, t });

    return {
      nav,
      /**
       * The palette's index: the navigation flattened, plus the pages that are
       * deliberately not in the sidebar - each behind its own permission check,
       * against the same set the navigation was filtered by.
       *
       * Built here rather than in the palette so there is exactly one tree. A
       * second one assembled from the config would be a second chance to forget
       * a filter, and the failure mode is a search box that names every screen
       * an admin cannot open.
       */
      searchItems: [
        ...flattenAdminNav(nav),
        ...adminSearchOnlyItems({ permissions, t }),
      ],
    };
  }, [declarations, permissions, t]);

  return <AdminNavContext value={value}>{children}</AdminNavContext>;
};

/**
 * The navigation this admin can see.
 *
 * Throws rather than returning an empty list when no provider is above it: an
 * empty sidebar and a missing provider look identical on screen, and the first
 * is a legitimate state (an admin with no permissions) that must not be able to
 * hide the second.
 */
const useAdminNavValue = (): AdminNavValue => {
  const value = React.use(AdminNavContext);

  if (value === null) {
    throw new Error(
      "useAdminNav must be rendered inside <AdminNavProvider>. The AdminCP shell mounts one.",
    );
  }

  return value;
};

export const useAdminNav = (): NavAdminParent[] => useAdminNavValue().nav;

/**
 * The same navigation, flattened for the command palette.
 *
 * Derived from {@link useAdminNav} rather than assembled again, which is the
 * whole point: an entry can only be found by search if it survived the
 * permission filter, because there is nothing else for search to read.
 *
 * Pages the palette offers that are *not* in the sidebar - the debug screen is
 * the standing example - are appended by the caller, each behind its own
 * permission check. See `adminSearchOnlyItems`.
 */
export const useAdminSearchNavItems = (): AdminSearchNavItem[] =>
  useAdminNavValue().searchItems;
