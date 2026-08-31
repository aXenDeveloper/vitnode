// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { externalGraph } from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * What `/files` keeps out of the browser, and what it takes as props.
 *
 * Two claims, and a reachability walk is the only way to state the first one:
 * the offending import is usually three files away from the one being written -
 * this feature's was inside the confirm dialog, behind the delete button - so a
 * per-file review never finds it.
 *
 * The first claim is a bundle claim. `my-files-delete.ts` needs one string
 * constant that used to live in `@/api/models/storage`, and importing it for
 * that string pulled Hono, Drizzle and all of `@/database` into the browser
 * bundle of every surface that deletes a file. The type-only import is what
 * keeps the route literals inferring without any of that.
 *
 * The host-neutrality claim that used to sit beside it - reaches nothing from
 * `next/*`, from `next-intl`, from a server action - is now
 * `next-boundary.test.ts`'s, asserted over every file in the package rather than
 * over the five entry points listed here.
 */
const SHARED = {
  deletes: join(here, "my-files-delete.ts"),
  query: join(here, "my-files-query.ts"),
  table: join(here, "my-files-table-content.tsx"),
};

const withoutComments = (path: string): string =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

describe("the browser graph stops at the API's edge", () => {
  it.each([
    ["the deletes", SHARED.deletes],
    ["the query", SHARED.query],
  ])("%s reaches neither Drizzle nor Hono", (_name, path) => {
    const reached = [...externalGraph(path).keys()];

    expect(reached).not.toContain("drizzle-orm");
    expect(reached.some(one => one.startsWith("hono"))).toBe(false);
  });

  it("walks far enough to have found them", () => {
    // Guards the guard: both assertions above are "found nothing", which a walk
    // that stopped at the entry file would satisfy completely.
    expect([...externalGraph(SHARED.table).keys()].length).toBeGreaterThan(3);
  });
});

describe("the shared table takes its framework parts as props", () => {
  it("is handed a page rather than fetching one", () => {
    const code = withoutComments(SHARED.table);

    expect(code).toContain("data: MyFilesPage;");
    expect(code).not.toContain("useQuery");
    expect(code).not.toContain("fetcher");
  });

  it("is handed both deletes rather than calling a mutation", () => {
    const code = withoutComments(SHARED.table);

    expect(code).toContain("onDeleteFile: DeleteMyFile;");
    expect(code).toContain("onDeleteFiles: DeleteMyFiles;");
  });

  it("renders the table that leaves the navigation to its host", () => {
    // `ContentDataTable` takes the URL state through the seam in
    // `components/table/navigation`; the wrapper that mounted a router's
    // provider for it is gone.
    expect(withoutComments(SHARED.table)).toContain("ContentDataTable");
  });
});
