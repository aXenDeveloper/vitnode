import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { externalGraph, runtimeImports } from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

const SHARED_ENTRY = join(here, "layout-content.tsx");

describe("the shared main shell is framework-neutral", () => {
  it("never reaches a server-only module", () => {
    const reached = [...externalGraph(SHARED_ENTRY).keys()];

    expect(reached.some(one => one.endsWith(".server"))).toBe(false);
    expect(
      runtimeImports(SHARED_ENTRY).some(one => one.includes(".server")),
    ).toBe(false);
  });
});
