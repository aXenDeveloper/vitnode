import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { reachedFiles, SRC_ROOT } from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

describe("the engine's server half and the browser editor stay apart", () => {
  it("never reaches a file under the visual editor", () => {
    const reached = reachedFiles(join(here, "server", "index.ts"), {
      srcRoot: SRC_ROOT,
    }).filter(file => file.startsWith("editor/"));

    expect(reached).toStrictEqual([]);
  });
});
