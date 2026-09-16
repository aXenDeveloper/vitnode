// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { offenders, reachedSpecifiers } from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

const EDITOR_PACKAGES = [
  "@dnd-kit/core",
  "@dnd-kit/modifiers",
  "@dnd-kit/sortable",
  "@tanstack/react-form",
  "@tiptap/react",
  "cmdk",
];

describe("block metadata", () => {
  const entry = join(here, "index.ts");

  it("never pulls React in", () => {
    expect(reachedSpecifiers(entry)).not.toContain("react");
  });

  it("does not re-export the renderer", () => {
    const surface = readFileSync(entry, "utf8");

    expect(surface).not.toContain("./renderer");
    expect(surface).toContain("./registry");
  });

  it("reaches nothing an editor would need", () => {
    expect(offenders(entry, EDITOR_PACKAGES)).toStrictEqual([]);
  });
});

describe("the public renderer", () => {
  const entry = join(here, "renderer.tsx");

  it("reaches no editor, AdminCP or drag-and-drop code", () => {
    expect(offenders(entry, EDITOR_PACKAGES)).toStrictEqual([]);
  });

  it("makes no request of its own", () => {
    expect(offenders(entry, ["@tanstack/react-query"])).toStrictEqual([]);
  });

  it("does not need a router", () => {
    expect(
      offenders(entry, ["@tanstack/react-router", "@tanstack/react-start"]),
    ).toStrictEqual([]);
  });
});

describe("core's own blocks", () => {
  const entry = join(here, "built-in", "index.tsx");

  it("stay out of the AdminCP and the editor", () => {
    expect(offenders(entry, EDITOR_PACKAGES)).toStrictEqual([]);
  });

  it("render with nothing but React and a class helper", () => {
    expect(reachedSpecifiers(entry).sort()).toStrictEqual(["cn", "zod"]);
  });
});
