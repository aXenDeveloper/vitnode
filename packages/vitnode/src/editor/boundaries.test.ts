// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  offenders,
  reachedFiles,
  reachedSpecifiers,
  SRC_ROOT,
} from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));
const blocks = join(SRC_ROOT, "blocks");

const EAGERLY = { dynamic: false } as const;

const EDITOR_PACKAGES = [
  "@dnd-kit/core",
  "@dnd-kit/modifiers",
  "@dnd-kit/sortable",
  "@dnd-kit/utilities",
  "@tanstack/react-form",
  "@tanstack/react-query",
  "@tanstack/react-router",
  "sonner",
];

const PUBLIC_PAGE_FORBIDDEN = [...EDITOR_PACKAGES, "cmdk", "zod"];

const SERVER_PACKAGES = ["drizzle-kit", "drizzle-orm", "hono", "postgres"];

const sourceFilesUnder = (dir: string): string[] => {
  const found: string[] = [];

  const walk = (at: string) => {
    for (const entry of readdirSync(at).sort()) {
      const full = join(at, entry);

      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }

      if (!/\.tsx?$/.test(entry)) continue;
      if (/\.test(-d)?\.tsx?$/.test(entry)) continue;

      found.push(full);
    }
  };

  walk(dir);

  return found;
};

describe("the public content zone, now that an editor exists", () => {
  const entry = join(blocks, "zone.tsx");

  it("eagerly reaches React and nothing else", () => {
    expect(reachedSpecifiers(entry, SRC_ROOT, EAGERLY).sort()).toStrictEqual([
      "react",
    ]);
  });

  it("has no dynamic import at all, so that is its entire graph", () => {
    expect(reachedSpecifiers(entry, SRC_ROOT).sort()).toStrictEqual(["react"]);
  });

  it("reaches no editor package by either kind of import", () => {
    expect(offenders(entry, PUBLIC_PAGE_FORBIDDEN, SRC_ROOT)).toStrictEqual([]);
  });

  it("reaches no database or server code", () => {
    expect(offenders(entry, SERVER_PACKAGES, SRC_ROOT)).toStrictEqual([]);
  });

  it("asks for the edit runtime through a component-free module", () => {
    const source = readFileSync(entry, "utf8");

    expect(source).toContain('from "./edit-context"');
    expect(source).not.toContain("../editor/");
  });
});

describe("the edit seam a page opts into", () => {
  const entry = join(blocks, "edit.tsx");

  it("eagerly reaches React and nothing else", () => {
    expect(reachedSpecifiers(entry, SRC_ROOT, EAGERLY).sort()).toStrictEqual([
      "react",
    ]);
  });

  it("eagerly reaches no editor package", () => {
    expect(
      offenders(entry, PUBLIC_PAGE_FORBIDDEN, SRC_ROOT, EAGERLY),
    ).toStrictEqual([]);
  });

  it("does reach the editor once dynamic imports are followed", () => {
    expect(reachedSpecifiers(entry, SRC_ROOT)).toContain("@dnd-kit/core");
  });

  it("reaches the editor by a dynamic import and by nothing else", () => {
    const source = readFileSync(entry, "utf8");

    expect(source).toContain("lazy(");
    expect(source).toContain('import("../editor/root")');
    expect(source).not.toContain('from "../editor/root"');
  });

  it("names the adapter type without importing its module", () => {
    expect(readFileSync(entry, "utf8")).toContain(
      'import type { VisualEditorAdapter } from "../editor/adapter/types"',
    );
  });
});

describe("the block metadata surface", () => {
  const entry = join(blocks, "index.ts");

  it("still pulls no React in", () => {
    expect(reachedSpecifiers(entry, SRC_ROOT)).not.toContain("react");
  });

  it("still reaches nothing an editor needs", () => {
    expect(offenders(entry, EDITOR_PACKAGES, SRC_ROOT)).toStrictEqual([]);
  });

  it("does not re-export the edit seam", () => {
    const source = readFileSync(entry, "utf8");

    expect(source).not.toContain("./edit");
  });
});

describe("the public renderer", () => {
  const entry = join(blocks, "renderer.tsx");

  it("was left alone by edit mode and still reaches React only", () => {
    expect(reachedSpecifiers(entry, SRC_ROOT).sort()).toStrictEqual(["react"]);
  });
});

describe("where the editor's weight actually sits", () => {
  const entry = join(SRC_ROOT, "editor", "root.tsx");

  it("is the module that pays for drag and drop", () => {
    expect(reachedSpecifiers(entry, SRC_ROOT)).toContain("@dnd-kit/core");
  });

  it("is the module that pays for the form stack", () => {
    expect(reachedSpecifiers(entry, SRC_ROOT)).toContain(
      "@tanstack/react-form",
    );
  });

  it("is the module that pays for the toasts", () => {
    expect(reachedSpecifiers(entry, SRC_ROOT)).toContain("sonner");
  });

  it("stopped paying for cmdk once the sidebar replaced the modal picker", () => {
    expect(reachedSpecifiers(entry, SRC_ROOT)).not.toContain("cmdk");
  });

  it("mounts the one sidebar that is now both picker and toolbar", () => {
    expect(reachedFiles(entry, { srcRoot: SRC_ROOT })).toContain(
      "editor/sidebar/sidebar.tsx",
    );
  });

  it("is a default export, because React.lazy takes nothing else", () => {
    expect(readFileSync(entry, "utf8")).toContain("export default EditorRoot");
  });
});

describe("which way the dependency arrow points", () => {
  const editorFiles = sourceFilesUnder(join(SRC_ROOT, "editor"));

  it("has an editor to check, sidebar included", () => {
    expect(editorFiles.length).toBeGreaterThan(10);
    expect(editorFiles).toContain(join(SRC_ROOT, "editor", "root.tsx"));
    expect(editorFiles).toContain(
      join(SRC_ROOT, "editor", "sidebar", "sidebar.tsx"),
    );
  });

  it("never reaches AdminCP page code", () => {
    const crossings = editorFiles.flatMap(file =>
      reachedFiles(file, { srcRoot: SRC_ROOT })
        .filter(reached => reached.startsWith("views/admin/"))
        .map(reached => `${relative(SRC_ROOT, file)} -> ${reached}`),
    );

    expect(crossings).toStrictEqual([]);
  });

  it("never reaches database or server code", () => {
    const found = editorFiles.flatMap(file =>
      offenders(file, SERVER_PACKAGES, SRC_ROOT),
    );

    expect(found).toStrictEqual([]);
  });

  it("is the only place this test file lives, next to what it guards", () => {
    expect(here).toBe(join(SRC_ROOT, "editor"));
  });
});

describe("what the sidebar replaced", () => {
  it("left no fixed bottom toolbar behind", () => {
    expect(existsSync(join(SRC_ROOT, "editor", "toolbar"))).toBe(false);
  });

  it("left no modal block picker behind", () => {
    expect(
      existsSync(join(SRC_ROOT, "editor", "block-picker", "dialog.tsx")),
    ).toBe(false);
  });

  it("put the footer actions and the catalog in the same aside", () => {
    const reached = reachedFiles(
      join(SRC_ROOT, "editor", "sidebar", "sidebar.tsx"),
      {
        srcRoot: SRC_ROOT,
      },
    );

    expect(reached).toContain("editor/sidebar/blocks-panel.tsx");
    expect(reached).toContain("editor/sidebar/footer.tsx");
    expect(reached).toContain("editor/sidebar/preview-bar.tsx");
    expect(reached).toContain("editor/properties/panel.tsx");
  });
});

describe("the editor's published entry points", () => {
  const exportMap = (): Record<string, unknown> => {
    const manifest: unknown = JSON.parse(
      readFileSync(join(SRC_ROOT, "..", "package.json"), "utf8"),
    );

    return manifest instanceof Object && "exports" in manifest
      ? (manifest.exports as Record<string, unknown>)
      : {};
  };

  it("is reachable as `@vitnode/core/editor`", () => {
    expect(exportMap()["./editor"]).toStrictEqual({
      default: "./dist/src/editor/index.js",
      import: "./dist/src/editor/index.js",
      types: "./dist/src/editor/index.d.ts",
    });
  });

  it("publishes the adapter on its own, for a host that only saves", () => {
    expect(exportMap()["./editor/adapter"]).toStrictEqual({
      default: "./dist/src/editor/adapter/index.js",
      import: "./dist/src/editor/adapter/index.js",
      types: "./dist/src/editor/adapter/index.d.ts",
    });
  });
});

describe("what decides whether a target accepts a block", () => {
  const capabilities = join(SRC_ROOT, "editor", "state", "capabilities.ts");
  const reducer = join(SRC_ROOT, "editor", "state", "reducer.ts");
  const pureDrop = join(SRC_ROOT, "editor", "dnd", "resolve-drop.ts");

  it("keeps the drop resolver pure, with no registry to consult on its own", () => {
    const source = readFileSync(pureDrop, "utf8");

    expect(reachedSpecifiers(pureDrop, SRC_ROOT)).toStrictEqual([]);
    expect(source).not.toContain("blocks/registry");
    expect(source).not.toContain("isBlockAllowed");
    expect(source).toContain("TargetCapabilities");
  });

  it("answers the question in one module both layers can reach", () => {
    expect(reachedFiles(reducer, { srcRoot: SRC_ROOT })).toContain(
      "editor/state/capabilities.ts",
    );
    expect(readFileSync(capabilities, "utf8")).toContain(
      'from "../../blocks/registry"',
    );
  });

  it("leaves the reducer free of React and of drag and drop", () => {
    expect(reachedSpecifiers(reducer, SRC_ROOT)).not.toContain("react");
    expect(
      reachedFiles(reducer, { srcRoot: SRC_ROOT }).filter(file =>
        file.startsWith("editor/dnd/"),
      ),
    ).toStrictEqual([]);
  });
});
