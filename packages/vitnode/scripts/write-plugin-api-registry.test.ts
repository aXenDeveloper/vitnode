import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { PLUGIN_API_REGISTRY_PATH } from "../src/framework/api-registry/generate.js";
import { writePluginApiRegistry } from "./write-plugin-api-registry.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

const pluginAt = ({
  name,
  withApi = true,
}: {
  name?: string;
  withApi?: boolean;
}): string => {
  const root = mkdtempSync(join(tmpdir(), "vitnode-plugin-"));
  roots.push(root);

  if (name !== undefined) {
    writeFileSync(join(root, "package.json"), JSON.stringify({ name }));
  }

  if (withApi) {
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src/config.api.ts"), "export {};");
  }

  return root;
};

const generated = (root: string): string =>
  readFileSync(join(root, PLUGIN_API_REGISTRY_PATH), "utf8");

describe("writePluginApiRegistry", () => {
  it("registers the plugin under the name its package.json declares", () => {
    const root = pluginAt({ name: "@acme/blog" });

    expect(writePluginApiRegistry(root)).toBe(true);
    expect(generated(root)).toContain("'@acme/blog': VitNodeApiPlugin");
  });

  it("skips a package that serves no API", () => {
    const root = pluginAt({ name: "@acme/blog", withApi: false });

    expect(writePluginApiRegistry(root)).toBe(false);
  });

  it("skips a package with no name to register", () => {
    expect(writePluginApiRegistry(pluginAt({}))).toBe(false);
  });

  it("rewrites the file when the plugin is renamed", () => {
    const root = pluginAt({ name: "@acme/blog" });

    writePluginApiRegistry(root);
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ name: "@acme/shop" }),
    );
    writePluginApiRegistry(root);

    expect(generated(root)).toContain("'@acme/shop'");
    expect(generated(root)).not.toContain("'@acme/blog'");
  });
});
