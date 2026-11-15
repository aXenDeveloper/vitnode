import {
  existsSync,
  readFileSync,
  unwatchFile,
  watchFile,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";

import {
  generatePluginManifestSource,
  PLUGIN_INFO_PATH,
  PLUGIN_MANIFEST_PATH,
  pluginManifestFromPackageJson,
} from "../src/framework/plugin-manifest/generate.js";
import { CORE_PLUGIN_ID } from "../src/framework/plugin-routes/core.js";

/**
 * The packages that ship VitNode itself rather than a plugin: `@vitnode/core`
 * by its logical id, and `@vitnode/api`, whose `src/config.ts` is the API
 * factory, not a plugin definition.
 */
const FRAMEWORK_PACKAGES: ReadonlySet<string> = new Set([
  "@vitnode/api",
  CORE_PLUGIN_ID,
]);

export interface PluginManifestWrite {
  changed: boolean;
  inputs: string[];
}

const PLUGIN_DEFINITIONS = ["src/config.tsx", "src/config.ts"];

export const definesPlugin = (root: string): boolean => {
  const manifest = join(root, "package.json");
  if (!existsSync(manifest)) return false;

  const { name } = JSON.parse(readFileSync(manifest, "utf8")) as {
    name?: unknown;
  };

  return (
    typeof name === "string" &&
    !FRAMEWORK_PACKAGES.has(name) &&
    PLUGIN_DEFINITIONS.some(file => existsSync(join(root, file)))
  );
};

export const writePluginManifest = (
  root: string = process.cwd(),
): PluginManifestWrite => {
  const manifestPath = join(root, "package.json");
  const infoPath = join(root, PLUGIN_INFO_PATH);
  const source = relative(process.cwd(), manifestPath) || "package.json";
  const fields = pluginManifestFromPackageJson(
    JSON.parse(readFileSync(manifestPath, "utf8")) as unknown,
    source,
  );
  const path = join(root, PLUGIN_MANIFEST_PATH);
  const output = generatePluginManifestSource(fields, {
    hasInfo: existsSync(infoPath),
  });
  const changed = !existsSync(path) || readFileSync(path, "utf8") !== output;

  if (changed) writeFileSync(path, output, "utf8");

  return { changed, inputs: [manifestPath, infoPath] };
};

const POLL_MS = 300;

export const watchPluginManifest = ({
  inputs,
  onChange,
  onError,
  root,
}: {
  inputs: readonly string[];
  onChange: () => void;
  onError: (error: unknown) => void;
  root: string;
}): { close: () => void } => {
  let watched: string[] = [];

  const listener = () => {
    try {
      const result = writePluginManifest(root);
      watch(result.inputs);
      if (result.changed) onChange();
    } catch (error) {
      onError(error);
    }
  };

  const watch = (next: readonly string[]) => {
    for (const file of watched) {
      if (!next.includes(file)) unwatchFile(file, listener);
    }
    for (const file of next) {
      if (!watched.includes(file)) {
        watchFile(file, { interval: POLL_MS }, listener);
      }
    }
    watched = [...next];
  };

  watch(inputs);

  return {
    close: () => {
      watched.forEach(file => {
        unwatchFile(file, listener);
      });
      watched = [];
    },
  };
};
