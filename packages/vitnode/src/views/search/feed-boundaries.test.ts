// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  externalGraph,
  NEXT_INTL,
  NEXT_ONLY,
  offenders,
  runtimeImports,
} from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

const SHARED_ENTRY = join(here, "search-feed-content.tsx");

const DELETED_NEXT_HALF = {
  controls: join(here, "search-controls.tsx"),
  feed: join(here, "search-feed.tsx"),
};

const SHARED_CONTROLS = join(here, "search-controls-content.tsx");

const HEADER_CONTENT = join(here, "../../components/ui/header-content.tsx");

describe("the shared search feed is framework-neutral", () => {
  it("reaches nothing from next/* or server-only", () => {
    expect(offenders(SHARED_ENTRY, NEXT_ONLY)).toEqual([]);
  });

  it("reaches none of next-intl's Next-only entrypoints", () => {
    expect(offenders(SHARED_ENTRY, NEXT_INTL)).toEqual([]);
  });

  it("never reaches the locale-aware navigation module", () => {
    const reached = [...externalGraph(SHARED_ENTRY).keys()];

    expect(reached.some(one => one.includes("navigation"))).toBe(false);
  });

  it("takes its translations from use-intl, not from next-intl", () => {
    const imports = runtimeImports(SHARED_ENTRY);

    expect(imports).toContain("use-intl");
    expect(imports).not.toContain("next-intl");
  });

  it("takes its query as a prop rather than building one", () => {
    // Comments stripped first - the file explains at length *why* it no longer
    // resolves a locale or builds a request, and prose is not a call site.
    const code = readFileSync(SHARED_ENTRY, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    expect(code).not.toContain("useLocale");
    expect(code).toContain("queryOptions: SearchFeedQueryOptions;");
    // One `useInfiniteQuery`, and it is handed its definition. A second
    // implementation here is the bug this boundary exists to prevent.
    expect(code.match(/useInfiniteQuery\(/g)).toHaveLength(1);
    expect(code).toContain("useInfiniteQuery(queryOptions)");
  });
});

describe("the shared header is framework-neutral", () => {
  it("reaches nothing from next/* or server-only", () => {
    expect(offenders(HEADER_CONTENT, NEXT_ONLY)).toEqual([]);
  });

  it("reaches none of next-intl's Next-only entrypoints", () => {
    expect(offenders(HEADER_CONTENT, NEXT_INTL)).toEqual([]);
  });

  it("never reaches the locale-aware navigation module", () => {
    // It used to import it directly, for one back button on one admin screen.
    const reached = [...externalGraph(HEADER_CONTENT).keys()];

    expect(reached.some(one => one.includes("navigation"))).toBe(false);
  });

  it("takes the back link as a prop instead of importing one", () => {
    const code = readFileSync(HEADER_CONTENT, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    expect(code).toContain("BackLink");
    expect(code).not.toContain("@/lib/navigation");
  });
});

describe("the shared search controls are framework-neutral", () => {
  it("reaches nothing from next/* or server-only", () => {
    expect(offenders(SHARED_CONTROLS, NEXT_ONLY)).toEqual([]);
  });

  it("reaches none of next-intl's Next-only entrypoints", () => {
    expect(offenders(SHARED_CONTROLS, NEXT_INTL)).toEqual([]);
  });

  it("never reaches the locale-aware navigation module", () => {
    const reached = [...externalGraph(SHARED_CONTROLS).keys()];

    expect(reached.some(one => one.includes("navigation"))).toBe(false);
  });

  it("takes its translations from use-intl, not from next-intl", () => {
    const imports = runtimeImports(SHARED_CONTROLS);

    expect(imports).toContain("use-intl");
    expect(imports).not.toContain("next-intl");
  });

  it("walks into the design system it renders", () => {
    // Otherwise the assertions above would pass on a graph that stopped at the
    // controls themselves - which is exactly the graph that cannot break.
    const reached = [...externalGraph(SHARED_CONTROLS).keys()];
    const visited = runtimeImports(SHARED_CONTROLS);

    expect(visited).toContain("@/components/ui/input-group");
    expect(reached).toContain("lucide-react");
  });

  it("takes its query and its link as props rather than building either", () => {
    const code = readFileSync(SHARED_CONTROLS, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    // Neither a locale nor a transport: the whole request is `feedQuery`'s, and
    // `feedQuery` comes from whichever app is rendering this.
    expect(code).not.toContain("useLocale");
    expect(code).not.toContain("searchFeedQueryOptions");
    expect(code).toContain("feedQuery: SearchFeedQueryFactory;");
    expect(code).toContain("LinkComponent: SearchFeedLinkComponent;");
    // One feed, and it is the shared one. A second renderer here is the drift
    // this boundary exists to prevent.
    expect(code.match(/<SearchFeedContent/g)).toHaveLength(1);
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
