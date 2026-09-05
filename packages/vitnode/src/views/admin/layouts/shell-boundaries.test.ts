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

  it.each(sharedEntries)("$name translates through use-intl", ({ path }) => {
    expect(offenders(path, ["next-intl"])).toEqual([]);
  });

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
