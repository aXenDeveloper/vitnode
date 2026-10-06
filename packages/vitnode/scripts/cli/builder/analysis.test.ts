// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ChunkModule, MeasuredFile } from "./output-files";

import { analyzeChunks, dominantPackage } from "./analysis";
import {
  APPLICATION_CODE,
  createPackageOwner,
  packageNameFromPath,
  VIRTUAL_MODULES,
} from "./package-owner";

const chunk = (
  fileName: string,
  size: number,
  modules: ChunkModule[],
): MeasuredFile => ({
  absolutePath: `/app/${fileName}`,
  brotli: null,
  category: "client-js",
  consumer: "client",
  displayPath: fileName,
  environment: "client",
  fileName,
  gzip: null,
  isEntry: false,
  key: fileName,
  modules,
  size,
  type: "chunk",
});

const ownerByPrefix = (id: string) => id.split("/")[0];

describe("analyzeChunks", () => {
  it("splits a chunk into packages by their share of the code", () => {
    const [analysis] =
      analyzeChunks(
        [
          chunk("editor.js", 400_000, [
            { id: "@tiptap/core/a", renderedLength: 300 },
            { id: "@tiptap/core/b", renderedLength: 100 },
            { id: "prosemirror-model/x", renderedLength: 100 },
          ]),
        ],
        { owner: ownerByPrefix },
      ) ?? [];

    expect(analysis.contributions).toEqual([
      { label: "@tiptap", renderedLength: 400, share: 0.8, size: 320_000 },
      {
        label: "prosemirror-model",
        renderedLength: 100,
        share: 0.2,
        size: 80_000,
      },
    ]);
    expect(analysis.other).toBeNull();
  });

  it("groups everything past the top contributors as other", () => {
    const modules = ["a", "b", "c", "d"].map((name, index) => ({
      id: `${name}/index.js`,
      renderedLength: 100 - index,
    }));
    const [analysis] =
      analyzeChunks([chunk("x.js", 1000, modules)], {
        contributors: 2,
        owner: ownerByPrefix,
      }) ?? [];

    expect(analysis.contributions.map(c => c.label)).toEqual(["a", "b"]);
    expect(analysis.other).toMatchObject({
      label: "other",
      renderedLength: 195,
    });
  });

  it("breaks down the largest chunks first", () => {
    const result = analyzeChunks(
      [
        chunk("small.js", 10, [{ id: "a/x", renderedLength: 1 }]),
        chunk("big.js", 999, [{ id: "a/x", renderedLength: 1 }]),
      ],
      { chunks: 1, owner: ownerByPrefix },
    );

    expect(result?.map(analysis => analysis.file.fileName)).toEqual(["big.js"]);
  });

  it("is unavailable when the bundler reported no modules", () => {
    expect(
      analyzeChunks([chunk("a.js", 1000, [])], { owner: ownerByPrefix }),
    ).toBeNull();
  });

  it("names the package that dominates a chunk, but never the app's own code", () => {
    const [vendor] =
      analyzeChunks(
        [
          chunk("v.js", 100, [
            { id: "react-scan/x", renderedLength: 80 },
            { id: "preact/x", renderedLength: 20 },
          ]),
        ],
        { owner: ownerByPrefix },
      ) ?? [];
    const [own] =
      analyzeChunks(
        [chunk("o.js", 100, [{ id: "src/x", renderedLength: 1 }])],
        { owner: () => APPLICATION_CODE },
      ) ?? [];

    expect(dominantPackage(vendor)?.label).toBe("react-scan");
    expect(dominantPackage(own)).toBeNull();
  });
});

describe("package ownership of modules", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "vitnode-owner-"));
  });

  afterEach(() => {
    rmSync(root, { force: true, recursive: true });
  });

  it.each([
    ["/app/node_modules/react/index.js", "react"],
    ["/app/node_modules/@tiptap/core/dist/index.js", "@tiptap/core"],
    [
      "/r/node_modules/.pnpm/react-dom@19.3.0/node_modules/react-dom/cjs/x.js",
      "react-dom",
    ],
    [String.raw`C:\app\node_modules\@scope\pkg\index.js`, "@scope/pkg"],
    ["/app/src/main.tsx", null],
  ])("reads the package of %s", (path, expected) => {
    expect(packageNameFromPath(path)).toBe(expected);
  });

  it("labels the project's own files, workspace packages and virtual modules", () => {
    const app = join(root, "apps", "web");
    const plugin = join(root, "plugins", "blog");
    mkdirSync(join(app, "src"), { recursive: true });
    mkdirSync(join(plugin, "dist"), { recursive: true });
    writeFileSync(join(app, "package.json"), JSON.stringify({ name: "web" }));
    writeFileSync(
      join(plugin, "package.json"),
      JSON.stringify({ name: "@acme/blog" }),
    );

    const owner = createPackageOwner(app);

    expect(owner(join(app, "src", "main.tsx"))).toBe(APPLICATION_CODE);
    expect(owner(join(plugin, "dist", "routes.js"))).toBe("@acme/blog");
    expect(owner("\0vite/preload-helper")).toBe(VIRTUAL_MODULES);
    expect(owner.rootOf(join(plugin, "dist", "routes.js"))).toBe(plugin);
  });
});
