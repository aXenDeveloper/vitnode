// @vitest-environment node
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  externalGraph,
  NEXT_INTL,
  NEXT_ONLY,
  offenders,
} from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../../..");

/**
 * The AdminCP shell, split down the middle.
 *
 * The same boundary `auth-boundaries.test.ts` draws around the auth screens, for
 * the same reason and with the same machinery. Stage 12 gives the AdminCP shell
 * two callers - the Next.js `AdminLayout` and the TanStack Start `_admin` route -
 * and a shared component that reaches `@/lib/navigation`, a `"use server"`
 * module or `next-intl/server` cannot be rendered by the second one. Nothing
 * about that failure is visible until somebody tries: it is a runtime resolution
 * error deep inside a Vite SSR pass, not a type error.
 *
 * Two of these entries are the ones that actually bit. `components/ui/sidebar`
 * and `components/ui/sheet` are shadcn primitives nobody thinks of as
 * Next-coupled, and both imported `useTranslations` from `next-intl` - which
 * resolves a *different* React context than the `use-intl` provider a TanStack
 * route mounts, so the whole AdminCP threw "No intl context found" on the server
 * and silently fell back to client rendering.
 */
const SHARED = {
  breadcrumb: join(here, "breadcrumb/breadcrumb-admin-content.tsx"),
  navActive: join(here, "sidebar/nav/nav-active.ts"),
  navItem: join(here, "sidebar/nav/item-content.tsx"),
  navModel: join(here, "sidebar/nav/nav-model.tsx"),
  navSidebar: join(here, "sidebar/nav/nav-content.tsx"),
  search: join(here, "search/search-content.tsx"),
  searchDialog: join(here, "search/search-dialog-content.tsx"),
  searchFlatten: join(here, "search/flatten-nav.ts"),
  searchOnlyPages: join(here, "search/search-only-pages.tsx"),
  sidebar: join(here, "sidebar/sidebar-content.tsx"),
  sidebarPrimitive: join(srcRoot, "components/ui/sidebar.tsx"),
  sheetPrimitive: join(srcRoot, "components/ui/sheet.tsx"),
  userBar: join(here, "user-bar/user-bar-content.tsx"),
};

/**
 * The Next.js half, by path, so its absence can be asserted.
 *
 * Named rather than deleted along with the assertions that used them: each was
 * the one place a Next.js API was allowed to appear in this subtree, and a test
 * that stops naming them cannot notice one coming back.
 */
const DELETED_NEXT_HALF = {
  breadcrumb: join(here, "breadcrumb/breadcrumb-admin.tsx"),
  navItem: join(here, "sidebar/nav/item.tsx"),
  navSidebar: join(here, "sidebar/nav/nav.tsx"),
  search: join(here, "search/search.tsx"),
  searchIndex: join(here, "search/get-search-nav-items.tsx"),
  sidebar: join(here, "sidebar/sidebar.tsx"),
  userBar: join(here, "user-bar/user-bar.tsx"),
};

const sharedEntries = Object.entries(SHARED).map(([name, path]) => ({
  name,
  path,
}));

describe("the shared AdminCP shell is framework-neutral", () => {
  it.each(sharedEntries)("$name reaches nothing from next/*", ({ path }) => {
    expect(offenders(path, NEXT_ONLY)).toEqual([]);
  });

  it.each(sharedEntries)(
    "$name reaches none of next-intl's Next-only entrypoints",
    ({ path }) => {
      expect(offenders(path, NEXT_INTL)).toEqual([]);
    },
  );

  /**
   * The failure this file was written for.
   *
   * `next-intl` bundles its own copy of `use-intl`, so its `useTranslations`
   * reads a different React context than the `IntlProvider` a TanStack route
   * mounts. A shared component that imports from `next-intl` typechecks, renders
   * fine under Next, and throws "No intl context found" the first time a
   * TanStack Start route server-renders it.
   */
  it.each(sharedEntries)("$name translates through use-intl", ({ path }) => {
    expect(offenders(path, ["next-intl"])).toEqual([]);
  });

  /**
   * A `"use server"` module reaching a shared component is the other half of the
   * same problem: it drags `@/lib/fetcher`, and with it `server-only` and
   * `next/headers`, into the browser graph.
   */
  it.each(sharedEntries)("$name imports no server action", ({ path }) => {
    const serverModules = [...externalGraph(path).keys()].filter(specifier =>
      specifier.endsWith(".server"),
    );

    expect(serverModules).toEqual([]);
  });
});

describe("the Next.js half of this subtree is gone", () => {
  it.each(Object.entries(DELETED_NEXT_HALF))(
    "%s no longer exists",
    (_name, path) => {
      expect(existsSync(path)).toBe(false);
    },
  );
});
