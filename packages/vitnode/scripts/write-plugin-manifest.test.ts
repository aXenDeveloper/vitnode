import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  PLUGIN_INFO_PATH,
  PLUGIN_MANIFEST_PATH,
} from "../src/framework/plugin-manifest/generate.js";
import { definesPlugin, writePluginManifest } from "./write-plugin-manifest.js";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "vitnode-plugin-manifest-"));
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

const writeInfo = (root: string, info: Record<string, string>) => {
  write(
    root,
    PLUGIN_INFO_PATH,
    `export const pluginInfo = ${JSON.stringify(info)};\n`,
  );
};

const pluginAt = (manifest: Record<string, unknown>) => {
  const root = tempDir();
  mkdirSync(join(root, "src"));
  writeManifest(root, manifest);

  return root;
};

const BLOG = { description: "Posts", name: "@acme/blog", version: "1.0.0" };

/** What the generated module exports, evaluated for real. */
const generated = async (root: string): Promise<unknown> => {
  const module = (await import(join(root, PLUGIN_MANIFEST_PATH))) as {
    manifest: unknown;
  };

  return module.manifest;
};

describe("writePluginManifest", () => {
  it("writes the manifest, and watches src/plugin-info.ts before it exists", () => {
    const root = pluginAt(BLOG);

    expect(writePluginManifest(root)).toEqual({
      changed: true,
      inputs: [join(root, "package.json"), join(root, PLUGIN_INFO_PATH)],
    });
    expect(existsSync(join(root, PLUGIN_MANIFEST_PATH))).toBe(true);
  });

  it.each([
    ["no src/plugin-info.ts", undefined, "@acme/blog", null],
    ["an empty plugin info", {}, "@acme/blog", null],
    [
      "a title and an icon",
      { icon: "newspaper", title: "Blog" },
      "Blog",
      "newspaper",
    ],
  ])("takes the title and icon from %s", async (_, info, title, icon) => {
    const root = pluginAt(BLOG);
    if (info) writeInfo(root, info);

    writePluginManifest(root);

    expect(await generated(root)).toEqual({
      author: null,
      description: "Posts",
      icon,
      id: "@acme/blog",
      license: null,
      title,
      version: "1.0.0",
    });
  });

  it.each([
    [
      "a new dependency",
      (root: string) => {
        writeManifest(root, { ...BLOG, dependencies: { zod: "^4.0.0" } });
      },
      false,
    ],
    [
      "a title edited in src/plugin-info.ts",
      (root: string) => {
        writeInfo(root, { title: "Journal" });
      },
      false,
    ],
    [
      "a new version",
      (root: string) => {
        writeManifest(root, { ...BLOG, version: "1.1.0" });
      },
      true,
    ],
    [
      "src/plugin-info.ts disappearing",
      (root: string) => {
        rmSync(join(root, PLUGIN_INFO_PATH));
      },
      true,
    ],
  ])("after %s, reports changed: %s", (_, edit, changed) => {
    const root = pluginAt(BLOG);
    writeInfo(root, { title: "Blog" });
    writePluginManifest(root);
    const before = readFileSync(join(root, PLUGIN_MANIFEST_PATH), "utf8");

    edit(root);

    expect(writePluginManifest(root).changed).toBe(changed);
    expect(
      readFileSync(join(root, PLUGIN_MANIFEST_PATH), "utf8") !== before,
    ).toBe(changed);
  });

  it("reports src/plugin-info.ts appearing as a change", () => {
    const root = pluginAt(BLOG);
    writePluginManifest(root);

    writeInfo(root, { icon: "newspaper" });

    expect(writePluginManifest(root).changed).toBe(true);
  });

  it("refuses a package without a name and writes nothing", () => {
    const root = pluginAt({ version: "1.0.0" });

    expect(() => writePluginManifest(root)).toThrow(/has no `name`/);
    expect(existsSync(join(root, PLUGIN_MANIFEST_PATH))).toBe(false);
  });
});

describe("definesPlugin", () => {
  it.each([
    [true, "a plugin with src/config.tsx", "@acme/blog", "src/config.tsx"],
    [true, "a plugin with src/config.ts", "@acme/blog", "src/config.ts"],
    [
      false,
      "core, despite its src/config.ts",
      "@vitnode/core",
      "src/config.ts",
    ],
    [false, "a package without a config", "@acme/utils", "src/index.ts"],
  ])("is %s for %s", (expected, _, name, file) => {
    const root = pluginAt({ name });
    write(root, file, "export {};\n");

    expect(definesPlugin(root)).toBe(expected);
  });

  it("is false for a folder without package.json", () => {
    expect(definesPlugin(tempDir())).toBe(false);
  });
});
