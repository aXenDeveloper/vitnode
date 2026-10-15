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
  PLUGIN_METADATA_PATH,
} from "../src/framework/plugin-metadata/generate.js";
import { definesPlugin, writePluginMetadata } from "./write-plugin-metadata.js";

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
  const module = (await import(join(root, PLUGIN_METADATA_PATH))) as {
    pluginMetadata: unknown;
  };

  return module.pluginMetadata;
};

describe("writePluginMetadata", () => {
  it("writes the metadata, and watches src/plugin-metadata.ts before it exists", () => {
    const root = pluginAt(BLOG);

    expect(writePluginMetadata(root)).toEqual({
      changed: true,
      inputs: [join(root, "package.json"), join(root, PLUGIN_INFO_PATH)],
    });
    expect(existsSync(join(root, PLUGIN_METADATA_PATH))).toBe(true);
  });

  it.each([
    ["no src/plugin-metadata.ts", undefined, "@acme/blog", null],
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

    writePluginMetadata(root);

    expect(await generated(root)).toEqual({
      description: "Posts",
      icon,
      id: "@acme/blog",
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
      "a title edited in src/plugin-metadata.ts",
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
      "src/plugin-metadata.ts disappearing",
      (root: string) => {
        rmSync(join(root, PLUGIN_INFO_PATH));
      },
      true,
    ],
  ])("after %s, reports changed: %s", (_, edit, changed) => {
    const root = pluginAt(BLOG);
    writeInfo(root, { title: "Blog" });
    writePluginMetadata(root);
    const before = readFileSync(join(root, PLUGIN_METADATA_PATH), "utf8");

    edit(root);

    expect(writePluginMetadata(root).changed).toBe(changed);
    expect(
      readFileSync(join(root, PLUGIN_METADATA_PATH), "utf8") !== before,
    ).toBe(changed);
  });

  it("reports src/plugin-metadata.ts appearing as a change", () => {
    const root = pluginAt(BLOG);
    writePluginMetadata(root);

    writeInfo(root, { icon: "newspaper" });

    expect(writePluginMetadata(root).changed).toBe(true);
  });

  it("refuses a package without a name and writes nothing", () => {
    const root = pluginAt({ version: "1.0.0" });

    expect(() => writePluginMetadata(root)).toThrow(/has no `name`/);
    expect(existsSync(join(root, PLUGIN_METADATA_PATH))).toBe(false);
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
