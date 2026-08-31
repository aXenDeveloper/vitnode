// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { runtimeImports } from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The three modules a feed page is assembled from, and the props each takes.
 *
 * `/discover` is a heading, a row of controls and a feed, and the interesting
 * thing about all three is what they *don't* own: no locale, no transport, no
 * router. The query arrives as options, the link arrives as a component, and the
 * strings come from whichever `use-intl` record the host provided into.
 *
 * That is the claim only this file can make. "Reaches nothing from `next/*`" was
 * also here, three times over, and is now `next-boundary.test.ts`'s - asserted
 * over every file in the package instead of over the graph a walk from these
 * three entry points happens to cover.
 */
const SHARED_FEED = join(here, "search-feed-content.tsx");
const SHARED_CONTROLS = join(here, "search-controls-content.tsx");

/**
 * The heading, which lives in the design system rather than here.
 *
 * Pinned in this file because it is half of what a feed page renders, and
 * because it is the cautionary case: it was Next-only for one back button, which
 * made every page that showed a heading Next-only too.
 */
const HEADER_CONTENT = join(here, "../../components/ui/header-content.tsx");

const withoutComments = (path: string): string =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

describe("the shared search feed takes its framework parts as props", () => {
  it("reads its strings from the use-intl record the host provides", () => {
    // The positive half is the one worth asserting: a component that translates
    // nothing at all would satisfy any "does not import next-intl" check.
    expect(runtimeImports(SHARED_FEED)).toContain("use-intl");
  });

  it("takes its query as a prop rather than building one", () => {
    // Comments stripped first - the file explains at length *why* it no longer
    // resolves a locale or builds a request, and prose is not a call site.
    const code = withoutComments(SHARED_FEED);

    expect(code).not.toContain("useLocale");
    expect(code).toContain("queryOptions: SearchFeedQueryOptions;");
    // One `useInfiniteQuery`, and it is handed its definition. A second
    // implementation here is the bug this boundary exists to prevent.
    expect(code.match(/useInfiniteQuery\(/g)).toHaveLength(1);
    expect(code).toContain("useInfiniteQuery(queryOptions)");
  });
});

describe("the shared header takes its back link as a prop", () => {
  it("is handed the link rather than importing one", () => {
    expect(withoutComments(HEADER_CONTENT)).toContain("BackLink");
  });
});

describe("the shared search controls take their framework parts as props", () => {
  it("reads its strings from the use-intl record the host provides", () => {
    expect(runtimeImports(SHARED_CONTROLS)).toContain("use-intl");
  });

  it("takes its query and its link as props rather than building either", () => {
    const code = withoutComments(SHARED_CONTROLS);

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
