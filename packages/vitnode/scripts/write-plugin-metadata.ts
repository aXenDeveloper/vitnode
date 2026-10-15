import {
  existsSync,
  readFileSync,
  unwatchFile,
  watchFile,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";

import {
  generatePluginMetadataSource,
  PLUGIN_INFO_PATH,
  PLUGIN_METADATA_PATH,
  pluginMetadataFromManifest,
} from "../src/framework/plugin-metadata/generate.js";
import { CORE_PLUGIN_ID } from "../src/framework/plugin-routes/core.js";

export interface PluginMetadataWrite {
  /** Whether the generated file changed on disk. */
  changed: boolean;
  /**
   * What the output depends on: `package.json`, and whether
   * `src/plugin-metadata.ts` exists - watched even while it does not.
   */
  inputs: string[];
}

/** The modules that import the generated metadata - a plugin's definition. */
const PLUGIN_DEFINITIONS = ["src/config.tsx", "src/config.ts"];

/**
 * Whether a package defines a plugin and so needs its metadata modules: it has
 * the module that imports them, and it is not core, whose `src/config.ts` is
 * its own constants. Decided by the files alone, so a plugin builds the same
 * whether `@vitnode/core` is a dependency, a peer or hoisted from a workspace.
 */
export const definesPlugin = (root: string): boolean => {
  const manifest = join(root, "package.json");
  if (!existsSync(manifest)) return false;

  const { name } = JSON.parse(readFileSync(manifest, "utf8")) as {
    name?: unknown;
  };

  return (
    name !== CORE_PLUGIN_ID &&
    PLUGIN_DEFINITIONS.some(file => existsSync(join(root, file)))
  );
};

/**
 * `src/plugin-metadata.gen.ts`, from the plugin's own `package.json` and
 * `src/plugin-metadata.ts`.
 *
 * Synchronous and before the compilers, like the API registry: `tsc` and tsdown
 * must find the module on their first pass. The title and icon are imported
 * from `src/plugin-metadata.ts` rather than copied, so editing them rebuilds
 * like any other source; this only rewrites the file when the package fields
 * change or that module appears or disappears - an edit to an unrelated
 * `package.json` field, such as a new dependency, rebuilds nothing.
 */
export const writePluginMetadata = (
  root: string = process.cwd(),
): PluginMetadataWrite => {
  const manifestPath = join(root, "package.json");
  const infoPath = join(root, PLUGIN_INFO_PATH);
  const source = relative(process.cwd(), manifestPath) || "package.json";
  const metadata = pluginMetadataFromManifest(
    JSON.parse(readFileSync(manifestPath, "utf8")) as unknown,
    source,
  );
  const path = join(root, PLUGIN_METADATA_PATH);
  const output = generatePluginMetadataSource(metadata, {
    hasInfo: existsSync(infoPath),
  });
  const changed = !existsSync(path) || readFileSync(path, "utf8") !== output;

  if (changed) writeFileSync(path, output, "utf8");

  return { changed, inputs: [manifestPath, infoPath] };
};

const POLL_MS = 300;

/**
 * Regenerates the metadata while `vitnode dev` runs, whenever `package.json`
 * changes or `src/plugin-metadata.ts` is created or deleted.
 *
 * Polled rather than `fs.watch`ed: editors and package managers replace
 * `package.json` instead of writing into it, which ends a native watcher. Only
 * those inputs are watched, and the outputs live under `src` - which tsdown
 * watches and this does not - so a write can never trigger another one.
 */
export const watchPluginMetadata = ({
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
      const result = writePluginMetadata(root);
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
