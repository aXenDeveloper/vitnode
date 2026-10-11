import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  offenders,
  reachedFiles,
  reachedSpecifiers,
  SRC_ROOT,
} from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

const EDITOR_PACKAGES = [
  "@dnd-kit/core",
  "@dnd-kit/modifiers",
  "@dnd-kit/sortable",
  "@dnd-kit/utilities",
  "@tanstack/react-form",
  "@tiptap/react",
  "cmdk",
  "sonner",
];

const PUBLIC_RENDER_FORBIDDEN = [...EDITOR_PACKAGES, "zod"];

const editorFiles = (entry: string): string[] =>
  reachedFiles(entry).filter(file => file.split(/[\\/]/)[0] === "editor");

const eagerSpecifiers = (entry: string): string[] =>
  reachedSpecifiers(entry, SRC_ROOT, { dynamic: false }).sort();

describe("block metadata", () => {
  const entry = join(here, "index.ts");

  it("never pulls React in", () => {
    expect(reachedSpecifiers(entry)).not.toContain("react");
    expect(eagerSpecifiers(entry)).not.toContain("react");
  });

  it("reaches nothing an editor would need", () => {
    expect(offenders(entry, EDITOR_PACKAGES)).toStrictEqual([]);
  });

  it("reaches no file under the editor", () => {
    expect(editorFiles(entry)).toStrictEqual([]);
  });
});

describe("defining a block", () => {
  const entry = join(here, "define.ts");

  it("reaches no third-party module at all", () => {
    expect(reachedSpecifiers(entry)).toStrictEqual([]);
  });
});

describe("the registry", () => {
  const entry = join(here, "registry.ts");

  it("reaches no third-party module at all", () => {
    expect(reachedSpecifiers(entry)).toStrictEqual([]);
  });
});

describe("the area model", () => {
  const entry = join(here, "area.ts");

  it("reaches no third-party module at all", () => {
    expect(reachedSpecifiers(entry)).toStrictEqual([]);
  });

  it("reaches no file under the editor", () => {
    expect(editorFiles(entry)).toStrictEqual([]);
  });
});

describe("the public renderer", () => {
  const entry = join(here, "renderer.tsx");

  it("reaches React and nothing else", () => {
    expect(reachedSpecifiers(entry).sort()).toStrictEqual(["react"]);
  });

  it("reaches React and nothing else eagerly either", () => {
    expect(eagerSpecifiers(entry)).toStrictEqual(["react"]);
  });

  it("reaches no editor, AdminCP or drag-and-drop code", () => {
    expect(offenders(entry, PUBLIC_RENDER_FORBIDDEN)).toStrictEqual([]);
  });

  it("reaches no file under the editor", () => {
    expect(editorFiles(entry)).toStrictEqual([]);
  });

  it("makes no request of its own", () => {
    expect(offenders(entry, ["@tanstack/react-query"])).toStrictEqual([]);
  });

  it("does not need a router", () => {
    expect(
      offenders(entry, ["@tanstack/react-router", "@tanstack/react-start"]),
    ).toStrictEqual([]);
  });

  it("does not reach a validation library", () => {
    expect(offenders(entry, ["zod"])).toStrictEqual([]);
  });
});

describe("the structural check the public renderer always makes", () => {
  const entry = join(here, "renderer.tsx");

  it("leaves it reaching React and nothing else, eagerly and dynamically", () => {
    expect(reachedSpecifiers(entry).sort()).toStrictEqual(["react"]);
    expect(eagerSpecifiers(entry)).toStrictEqual(["react"]);
  });

  it("costs no validation library and reaches no file under the editor", () => {
    expect(offenders(entry, ["zod"])).toStrictEqual([]);
    expect(editorFiles(entry)).toStrictEqual([]);
  });

  it("is the shape pass, never the write-time validator", () => {
    expect(reachedFiles(entry)).toContain("blocks/shape.ts");
    expect(reachedFiles(entry)).not.toContain("blocks/validate.ts");
  });

  it("reaches that pass through a module with no third-party import at all", () => {
    expect(reachedSpecifiers(join(here, "shape.ts"))).toStrictEqual([]);
  });
});

describe("the public area renderer", () => {
  const entry = join(here, "area-renderer.tsx");

  it("reaches React and nothing else", () => {
    expect(reachedSpecifiers(entry).sort()).toStrictEqual(["react"]);
  });

  it("reaches React and nothing else eagerly either", () => {
    expect(eagerSpecifiers(entry)).toStrictEqual(["react"]);
  });

  it("reaches no editor, AdminCP or drag-and-drop code", () => {
    expect(offenders(entry, PUBLIC_RENDER_FORBIDDEN)).toStrictEqual([]);
  });

  it("reaches no file under the editor", () => {
    expect(editorFiles(entry)).toStrictEqual([]);
  });

  it("makes no request of its own and needs no router", () => {
    expect(
      offenders(entry, [
        "@tanstack/react-query",
        "@tanstack/react-router",
        "@tanstack/react-start",
      ]),
    ).toStrictEqual([]);
  });
});

describe("the public content zone", () => {
  const entry = join(here, "zone.tsx");

  it("reaches React and nothing else", () => {
    expect(reachedSpecifiers(entry).sort()).toStrictEqual(["react"]);
  });

  it("reaches React and nothing else eagerly either", () => {
    expect(eagerSpecifiers(entry)).toStrictEqual(["react"]);
  });

  it("reaches no editor, AdminCP or drag-and-drop code", () => {
    expect(offenders(entry, PUBLIC_RENDER_FORBIDDEN)).toStrictEqual([]);
  });

  it("reaches no file under the editor", () => {
    expect(editorFiles(entry)).toStrictEqual([]);
  });

  it("makes no request of its own", () => {
    expect(offenders(entry, ["@tanstack/react-query"])).toStrictEqual([]);
  });

  it("does not need a router", () => {
    expect(
      offenders(entry, ["@tanstack/react-router", "@tanstack/react-start"]),
    ).toStrictEqual([]);
  });

  it("does not reach a validation library", () => {
    expect(offenders(entry, ["zod"])).toStrictEqual([]);
  });

  it("reaches no database or server code", () => {
    expect(
      offenders(entry, ["drizzle-orm", "drizzle-kit", "hono", "postgres"]),
    ).toStrictEqual([]);
  });
});

describe("why a zone takes an allowlist and not a content type", () => {
  it("costs a validation library, which a public page must not pay", () => {
    expect(
      reachedSpecifiers(join(here, "..", "content", "define.ts")),
    ).toContain("zod");
  });

  it("is not a cost the field descriptors themselves carry", () => {
    expect(
      reachedSpecifiers(join(here, "..", "content", "fields.ts")),
    ).toStrictEqual([]);
  });

  it("is a cost the zone avoids entirely", () => {
    expect(reachedSpecifiers(join(here, "zone.tsx"))).not.toContain("zod");
  });
});

describe("zone metadata", () => {
  const entry = join(here, "zone-meta.ts");

  it("reaches no third-party module at all", () => {
    expect(reachedSpecifiers(entry)).toStrictEqual([]);
  });
});

describe("the write-time validator", () => {
  const entry = join(here, "validate.ts");

  it("is where the schema machinery lives", () => {
    expect(reachedSpecifiers(entry)).toContain("zod");
  });

  it("still reaches no React", () => {
    expect(reachedSpecifiers(entry)).not.toContain("react");
  });
});

describe("core's own blocks", () => {
  const entry = join(here, "built-in", "index.tsx");

  it("stays out of the AdminCP and the editor", () => {
    expect(offenders(entry, EDITOR_PACKAGES)).toStrictEqual([]);
  });

  it("reaches no third-party module but the icons the widgets show", () => {
    expect(reachedSpecifiers(entry)).toStrictEqual(["lucide-react"]);
  });
});
