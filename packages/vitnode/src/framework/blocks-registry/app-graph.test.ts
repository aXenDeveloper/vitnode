// @vitest-environment node
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  reachedFiles,
  reachedSpecifiers,
  SRC_ROOT,
} from "@/tests/import-graph";

const APP_SRC = resolve(SRC_ROOT, "..", "..", "..", "apps", "web", "src");

const ROUTER = join(APP_SRC, "router.tsx");

const BLOCK_MODULE = /^@vitnode\/[^/]+\/(widgets|blocks)(\/|$)/;

const present = existsSync(ROUTER);

describe.skipIf(!present)("the application's root router", () => {
  it("does not reach the generated block registry", () => {
    const eager = reachedFiles(ROUTER, { dynamic: false, srcRoot: APP_SRC });

    expect(eager).not.toContain("blocks.gen.ts");
  });

  it("does not reach it lazily either, so no root chunk asks for it", () => {
    const everything = reachedFiles(ROUTER, { srcRoot: APP_SRC });

    expect(everything).not.toContain("blocks.gen.ts");
  });

  it("reaches no plugin block module", () => {
    const reached = reachedSpecifiers(ROUTER, APP_SRC).filter(specifier =>
      BLOCK_MODULE.test(specifier),
    );

    expect(reached).toStrictEqual([]);
  });
});

describe.skipIf(!present)("the generated block registry", () => {
  it("is what pulls every plugin's block components in", () => {
    const entry = join(APP_SRC, "blocks.gen.ts");
    const reached = reachedSpecifiers(entry, APP_SRC).filter(specifier =>
      BLOCK_MODULE.test(specifier),
    );

    expect(reached.length).toBeGreaterThan(0);
  });
});
