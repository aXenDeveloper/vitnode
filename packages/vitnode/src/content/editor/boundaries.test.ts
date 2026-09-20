// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  reachedFiles,
  reachedSpecifiers,
  SRC_ROOT,
} from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

const EAGERLY = { dynamic: false } as const;

const reached = (entry: string): string[] =>
  reachedFiles(entry, { srcRoot: SRC_ROOT });

describe("the editable page definition", () => {
  const entry = join(here, "index.ts");

  it("reaches no third-party module at all, which is what lets a public page import it", () => {
    expect(reachedSpecifiers(entry, SRC_ROOT)).toStrictEqual([]);
    expect(
      reachedSpecifiers(join(SRC_ROOT, "content", "define.ts"), SRC_ROOT),
    ).toContain("zod");
  });

  it("is small enough that the whole graph can be named", () => {
    expect(reached(entry)).toStrictEqual([
      "blocks/area.ts",
      "blocks/const.ts",
      "blocks/errors.ts",
      "blocks/instance.ts",
      "blocks/namespace.ts",
      "blocks/zone-meta.ts",
      "content/editor/adapter.ts",
      "content/editor/const.ts",
      "content/editor/define.ts",
      "content/editor/index.ts",
      "content/editor/types.ts",
      "content/errors.ts",
    ]);
  });
});

describe("the provider that hands a zone its blocks", () => {
  const entry = join(SRC_ROOT, "blocks", "page.tsx");
  const context = join(SRC_ROOT, "blocks", "page-context.ts");

  it("keeps the context and its hook in a module that renders nothing", () => {
    expect(reachedSpecifiers(context, SRC_ROOT)).toStrictEqual(["react"]);
    expect(readFileSync(context, "utf8")).not.toContain("createElement");
  });

  it("eagerly reaches React alone, and the editor only through the seam", () => {
    expect(reachedSpecifiers(entry, SRC_ROOT, EAGERLY).sort()).toStrictEqual([
      "react",
    ]);
    expect(reachedSpecifiers(entry, SRC_ROOT)).toContain("@dnd-kit/core");
  });
});

describe("the client adapter that talks to the page layout route", () => {
  it("is two modules, neither of them the editor's zod-costing barrel", () => {
    expect(reached(join(here, "adapter.ts"))).toStrictEqual([
      "content/editor/adapter.ts",
      "content/errors.ts",
    ]);
    expect(
      reachedSpecifiers(
        join(SRC_ROOT, "editor", "adapter", "index.ts"),
        SRC_ROOT,
      ),
    ).toContain("zod");
  });
});
