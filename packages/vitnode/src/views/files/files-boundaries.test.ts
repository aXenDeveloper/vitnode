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

const SHARED = {
  bulkActions: join(here, "actions/files-bulk-actions.tsx"),
  deletes: join(here, "my-files-delete.ts"),
  query: join(here, "my-files-query.ts"),
  rowActions: join(here, "actions/file-row-actions.tsx"),
  table: join(here, "my-files-table-content.tsx"),
};

/** The Next.js half: `next/headers`, `notFound`, and the server actions. */

const DELETED_NEXT_HALF = join(here, "my-files-table-view.tsx");

const sharedEntries = Object.entries(SHARED).map(([name, path]) => ({
  name,
  path,
}));

describe("the shared files modules are framework-neutral", () => {
  it.each(sharedEntries)("$name reaches nothing from next/*", ({ path }) => {
    // The table is in here too, which is only true because it renders
    // `ContentDataTable`: `DataTable` mounts the Next.js navigation provider,
    // and every one of the table's controls reads the URL through the seam in
    // `components/table/navigation` instead of `next/navigation`.
    expect(offenders(path, NEXT_ONLY)).toEqual([]);
  });

  it.each(sharedEntries)(
    "$name reaches none of next-intl's Next-only entrypoints",
    ({ path }) => {
      expect(offenders(path, NEXT_INTL)).toEqual([]);
    },
  );

  it.each(sharedEntries)(
    "$name never reaches the locale-aware navigation module directly",
    ({ path }) => {
      const reached = [...externalGraph(path).keys()];

      expect(reached.some(one => one.includes("next-intl/navigation"))).toBe(
        false,
      );
    },
  );

  it.each(sharedEntries)("$name never reaches a server action", ({ path }) => {
    // A `"use server"` module is the other way Next.js gets in: importing one
    // pulls the fetcher, `next/headers` and the whole API module graph behind
    // it. Both deletes are a prop instead.
    const reached = [...externalGraph(path).keys()];

    expect(reached.some(one => one.endsWith(".server"))).toBe(false);
    expect(runtimeImports(path).some(one => one.includes(".server"))).toBe(
      false,
    );
  });

  it("never imports the API's storage model for one string", () => {
    // `readFileInUse` needs the `FILE_IN_USE` code, which used to live in
    // `@/api/models/storage` - a value import that dragged Hono, Drizzle and
    // `@/database` into the browser bundle of every surface that deletes a file.
    const reached = [...externalGraph(SHARED.deletes).keys()];

    expect(reached).not.toContain("drizzle-orm");
    expect(reached.some(one => one.startsWith("hono"))).toBe(false);
  });
});

describe("the shared table takes its framework parts as props", () => {
  const withoutComments = (path: string): string =>
    readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

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

  it("renders the framework-neutral table, not the Next.js one", () => {
    // `DataTable` *is* the Next.js wiring - it mounts `NextDataTableNavigation`.
    // The shared table renders `ContentDataTable` and leaves the provider to
    // whoever is rendering it.
    const code = withoutComments(SHARED.table);

    expect(code).toContain("ContentDataTable");
    expect(code).not.toContain("components/table/data-table");
  });
});

describe("the Next.js half of this subtree is gone", () => {
  it("no longer exists", () => {
    expect(existsSync(DELETED_NEXT_HALF)).toBe(false);
  });
});
