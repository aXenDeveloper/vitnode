import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  generatePluginApiRegistrySource,
  PLUGIN_API_REGISTRY_PATH,
} from "../src/framework/api-registry/generate.js";

const pluginIdFrom = (root: string): null | string => {
  const manifest = join(root, "package.json");
  if (!existsSync(manifest)) return null;

  const { name } = JSON.parse(readFileSync(manifest, "utf8")) as {
    name?: string;
  };

  return name ?? null;
};

/**
 * `types/api-registry.gen.ts` - a plugin's registration of itself.
 *
 * Written before the compilers run, from the plugin's own `package.json` name,
 * so `fetcher({ plugin: <this id> })` resolves inside the package that declares
 * those routes. A plugin without a `src/config.api.ts` serves no API and gets
 * no file.
 *
 * Synchronous because `vitnode dev` spawns its watchers without awaiting, and
 * `tsc` must not start before the file it needs exists.
 */
export const writePluginApiRegistry = (
  root: string = process.cwd(),
): boolean => {
  if (!existsSync(join(root, "src/config.api.ts"))) return false;

  const pluginId = pluginIdFrom(root);
  if (pluginId === null) return false;

  const path = join(root, PLUGIN_API_REGISTRY_PATH);
  const source = generatePluginApiRegistrySource(pluginId);
  const current = existsSync(path) ? readFileSync(path, "utf8") : null;

  if (current === source) return true;

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source, "utf8");

  return true;
};
