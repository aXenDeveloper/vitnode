import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { externalGraph } from "@/tests/import-graph";

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

const sharedEntries = Object.entries(SHARED).map(([name, path]) => ({
  name,
  path,
}));

describe("the shared AdminCP shell is framework-neutral", () => {
  it.each(sharedEntries)("$name imports no server-only module", ({ path }) => {
    const serverModules = [...externalGraph(path).keys()].filter(specifier =>
      specifier.endsWith(".server"),
    );

    expect(serverModules).toEqual([]);
  });
});
