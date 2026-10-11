import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { externalGraph, runtimeImports } from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

const SHARED = {
  header: join(here, "header-content.tsx"),
};

const sharedEntries = Object.entries(SHARED).map(([name, path]) => ({
  name,
  path,
}));

describe("the shared header is framework-neutral", () => {
  it.each(sharedEntries)(
    "$name never reaches a server-only module",
    ({ path }) => {
      // Importing one pulls the fetcher and the whole API module graph behind
      // it. The header's one mutation - sign-out - lives in the user slot,
      // which is a prop.
      const reached = [...externalGraph(path).keys()];

      expect(reached.some(one => one.endsWith(".server"))).toBe(false);
      expect(runtimeImports(path).some(one => one.includes(".server"))).toBe(
        false,
      );
    },
  );
});
