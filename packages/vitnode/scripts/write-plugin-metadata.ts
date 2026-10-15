import {
  existsSync,
  readFileSync,
  realpathSync,
  statSync,
  unwatchFile,
  watchFile,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

import {
  generatePluginIconSource,
  generatePluginMetadataSource,
  PLUGIN_ICON_PATH,
  PLUGIN_METADATA_PATH,
  pluginIconDataUrl,
  pluginMetadataFromManifest,
} from "../src/framework/plugin-metadata/generate.js";
import { CORE_PLUGIN_ID } from "../src/framework/plugin-routes/core.js";
import { PLUGIN_METADATA_ERROR_PREFIX as ERROR_PREFIX } from "../src/lib/plugin-metadata.js";

export interface PluginMetadataWrite {
  /** Whether either generated file changed on disk. */
  changed: boolean;
  /** The files the output depends on: `package.json`, and the icon if any. */
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

const isInside = (root: string, path: string): boolean => {
  const rel = relative(root, path);

  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
};

/**
 * The declared icon, read only once it is proven to live inside the package -
 * by its path *and* by where its symlinks lead, since a published package
 * carries the file and nothing outside it.
 */
const readIcon = (root: string, declared: string, source: string) => {
  const path = resolve(root, declared);

  if (!isInside(root, path)) {
    throw new Error(
      `${ERROR_PREFIX} \`vitnode.icon\` in ${source} is ${JSON.stringify(declared)}, which points outside the package. Keep the icon inside it, such as "./assets/icon.svg".`,
    );
  }

  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(
      `${ERROR_PREFIX} \`vitnode.icon\` in ${source} is ${JSON.stringify(declared)}, and there is no file there.`,
    );
  }

  if (!isInside(realpathSync(root), realpathSync(path))) {
    throw new Error(
      `${ERROR_PREFIX} \`vitnode.icon\` in ${source} is ${JSON.stringify(declared)}, a link to a file outside the package. Copy the icon into the package instead.`,
    );
  }

  return { bytes: readFileSync(path), path };
};

const writeIfChanged = (path: string, source: string): boolean => {
  if (existsSync(path) && readFileSync(path, "utf8") === source) return false;

  writeFileSync(path, source, "utf8");

  return true;
};

/**
 * `src/plugin-metadata.gen.ts` and `src/plugin-icon.gen.ts`, from the plugin's
 * own `package.json`.
 *
 * Synchronous and before the compilers, like the API registry: `tsc` and tsdown
 * must find both modules on their first pass. A file is only rewritten when its
 * bytes change, so an edit to an unrelated `package.json` field - a new
 * dependency - rebuilds nothing.
 */
export const writePluginMetadata = (
  root: string = process.cwd(),
): PluginMetadataWrite => {
  const manifestPath = join(root, "package.json");
  const source = relative(process.cwd(), manifestPath) || "package.json";
  const { icon, metadata } = pluginMetadataFromManifest(
    JSON.parse(readFileSync(manifestPath, "utf8")) as unknown,
    source,
  );
  const iconFile = icon === null ? null : readIcon(root, icon, source);
  // Both checked before either file is written, so a broken icon never leaves
  // new metadata next to a stale icon.
  const iconSource = generatePluginIconSource(
    icon === null || iconFile === null
      ? null
      : pluginIconDataUrl(icon, iconFile.bytes, source),
  );

  const changedMetadata = writeIfChanged(
    join(root, PLUGIN_METADATA_PATH),
    generatePluginMetadataSource(metadata),
  );
  const changedIcon = writeIfChanged(join(root, PLUGIN_ICON_PATH), iconSource);

  return {
    changed: changedMetadata || changedIcon,
    inputs: [manifestPath, ...(iconFile === null ? [] : [iconFile.path])],
  };
};

const POLL_MS = 300;

/**
 * Regenerates the metadata while `vitnode dev` runs, whenever `package.json`
 * or the declared icon changes.
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
