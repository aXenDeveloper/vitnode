// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { externalGraph, runtimeImports } from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

const SHARED_ENTRY = join(here, "search-feed-content.tsx");

const SHARED_CONTROLS = join(here, "search-controls-content.tsx");

describe("the shared search feed is framework-neutral", () => {
  it("takes its translations from use-intl", () => {
    expect(runtimeImports(SHARED_ENTRY)).toContain("use-intl");
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

describe("the shared search controls are framework-neutral", () => {
  it("takes its translations from use-intl", () => {
    expect(runtimeImports(SHARED_CONTROLS)).toContain("use-intl");
  });

  it("walks into the design system it renders", () => {
    // Otherwise the assertions above would pass on a graph that stopped at the
    // controls themselves - which is exactly the graph that cannot break.
    const reached = [...externalGraph(SHARED_CONTROLS).keys()];
    const visited = runtimeImports(SHARED_CONTROLS);

    expect(visited).toContain("@/components/ui/input-group");
    expect(reached).toContain("lucide-react");
  });

  it("takes its query as a prop rather than building one", () => {
    const code = readFileSync(SHARED_CONTROLS, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    // Neither a locale nor a transport: the whole request is `feedQuery`'s, and
    // `feedQuery` comes from whichever app is rendering this.
    expect(code).not.toContain("useLocale");
    expect(code).not.toContain("searchFeedQueryOptions");
    expect(code).toContain("feedQuery: SearchFeedQueryFactory;");
    // One feed, and it is the shared one. A second renderer here is the drift
    // this boundary exists to prevent.
    expect(code.match(/<SearchFeedContent/g)).toHaveLength(1);
  });
});
