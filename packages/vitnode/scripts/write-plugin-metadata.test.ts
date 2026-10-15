import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  PLUGIN_ICON_PATH,
  PLUGIN_METADATA_PATH,
} from "../src/framework/plugin-metadata/generate.js";
import { writePluginMetadata } from "./write-plugin-metadata.js";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>';

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "vitnode-plugin-metadata-"));
  dirs.push(dir);

  return dir;
};

const write = (root: string, path: string, content: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};

const writeManifest = (root: string, manifest: Record<string, unknown>) => {
  write(root, "package.json", JSON.stringify(manifest, null, 2));
};

const pluginAt = (manifest: Record<string, unknown>) => {
  const root = tempDir();
  mkdirSync(join(root, "src"));
  writeManifest(root, manifest);

  return root;
};

const read = (root: string, path: string) =>
  existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : null;

const BLOG = {
  description: "Posts",
  name: "@acme/blog",
  version: "1.0.0",
  vitnode: { icon: "./assets/icon.svg", title: "Blog" },
};

describe("writePluginMetadata", () => {
  it("writes the metadata and the inlined icon from package.json", () => {
    const root = pluginAt(BLOG);
    write(root, "assets/icon.svg", SVG);

    expect(writePluginMetadata(root)).toEqual({
      changed: true,
      inputs: [join(root, "package.json"), join(root, "assets/icon.svg")],
    });
    expect(read(root, PLUGIN_METADATA_PATH)).toContain('"@acme/blog"');
    expect(read(root, PLUGIN_ICON_PATH)).toContain(
      `data:image/svg+xml;base64,${Buffer.from(SVG).toString("base64")}`,
    );
  });

  it("writes a null icon and watches only package.json without one", () => {
    const root = pluginAt({ name: "@acme/blog" });

    expect(writePluginMetadata(root).inputs).toEqual([
      join(root, "package.json"),
    ]);
    expect(read(root, PLUGIN_ICON_PATH)).toContain("= null");
  });

  it("leaves the files alone when nothing they show changed", () => {
    const root = pluginAt(BLOG);
    write(root, "assets/icon.svg", SVG);
    writePluginMetadata(root);

    writeManifest(root, { ...BLOG, dependencies: { zod: "^4.0.0" } });

    expect(writePluginMetadata(root).changed).toBe(false);
  });

  it.each([
    ["the version", { ...BLOG, version: "1.1.0" }, () => undefined],
    [
      "the icon",
      BLOG,
      (root: string) => {
        write(root, "assets/icon.svg", `${SVG}\n`);
      },
    ],
  ])("rewrites when %s changes", (_, manifest, edit) => {
    const root = pluginAt(BLOG);
    write(root, "assets/icon.svg", SVG);
    writePluginMetadata(root);

    writeManifest(root, manifest);
    edit(root);

    expect(writePluginMetadata(root).changed).toBe(true);
  });

  it.each([
    [
      "an icon path leaving the package",
      (root: string) => {
        writeManifest(root, { ...BLOG, vitnode: { icon: "../icon.svg" } });
      },
      /points outside the package/,
    ],
    ["a missing icon file", () => undefined, /there is no file there/],
    [
      "an icon linking outside the package",
      (root: string) => {
        const outside = tempDir();
        write(outside, "icon.svg", SVG);
        mkdirSync(join(root, "assets"));
        symlinkSync(join(outside, "icon.svg"), join(root, "assets/icon.svg"));
      },
      /a link to a file outside the package/,
    ],
    [
      "an icon that is not what its extension says",
      (root: string) => {
        write(root, "assets/icon.svg", "plain text");
      },
      /is not a valid SVG file/,
    ],
  ])("refuses %s and writes neither file", (_, setup, error) => {
    const root = pluginAt(BLOG);
    setup(root);

    expect(() => writePluginMetadata(root)).toThrow(error);
    expect(read(root, PLUGIN_METADATA_PATH)).toBeNull();
    expect(read(root, PLUGIN_ICON_PATH)).toBeNull();
  });
});
