// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { runtimeImports } from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The data table's URL seam, which is the widest one in the package.
 *
 * Four separate controls used to reach a router directly, so every AdminCP
 * screen and `/files` inherited a host coupling from a header cell. They now ask
 * `useDataTableUrl` where they are and hand the arithmetic to `url-state.ts`,
 * and both halves of that are asserted here because neither is visible in a
 * type: a control that grew its own `URLSearchParams` back would typecheck, pass
 * every render test, and quietly stop agreeing with the other three about what
 * the current page is.
 *
 * The host-neutrality claim that used to sit above this - reaches nothing from
 * `next/*`, reaches no locale-aware router - is now `next-boundary.test.ts`'s,
 * asserted over every file in the package rather than over these eight.
 */
const SHARED = {
  filters: join(here, "filters.tsx"),
  orderHead: join(here, "order-table-head.tsx"),
  pagination: join(here, "pagination.tsx"),
  search: join(here, "search.tsx"),
  urlState: join(here, "url-state.ts"),
};

const withoutComments = (path: string): string =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

const controls = [
  SHARED.filters,
  SHARED.orderHead,
  SHARED.pagination,
  SHARED.search,
];

describe("the URL arithmetic is a pure module", () => {
  it("imports nothing at all", () => {
    // The point of `url-state.ts`: no router, no React, nothing to mock. If an
    // import ever appears here, the seam has started growing a second job.
    expect(runtimeImports(SHARED.urlState)).toEqual([]);
  });
});

describe("the shared controls take their navigation from the seam", () => {
  it("asks the seam where it is rather than a router", () => {
    for (const path of controls) {
      const code = withoutComments(path);

      expect(code).toContain("useDataTableUrl");
      expect(code).not.toContain("useSearchParams");
      expect(code).not.toContain("useRouter");
      expect(code).not.toContain("usePathname");
    }
  });

  it("builds no URLs of its own", () => {
    // Every `new URLSearchParams(...)` in a control was a copy of the current
    // search about to be edited by hand. That is `url-state.ts`'s job now, and
    // a control that starts doing it again is a rule nobody can test.
    for (const path of controls) {
      expect(withoutComments(path)).not.toContain("new URLSearchParams");
    }
  });

  it("never names a pathname, because it is not given one", () => {
    for (const path of controls) {
      expect(withoutComments(path)).not.toContain("pathname");
    }
  });
});
