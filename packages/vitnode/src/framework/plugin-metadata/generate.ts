import type { PluginMetadata } from "../../lib/plugin-metadata.js";

import { PLUGIN_METADATA_ERROR_PREFIX as ERROR_PREFIX } from "../../lib/plugin-metadata.js";

/** Where `vitnode build` and `vitnode dev` write a plugin's metadata, relative to its root. */
export const PLUGIN_METADATA_PATH = "src/plugin-metadata.gen.ts";

/** The browser-only twin: the icon, as a `data:` URL the AdminCP lazy-loads. */
export const PLUGIN_ICON_PATH = "src/plugin-icon.gen.ts";

/**
 * The largest icon a plugin may declare, in bytes.
 *
 * The icon is inlined into the generated module, so it travels with the
 * package wherever it is installed - no asset pipeline, no `node_modules` path
 * for a server to read. Small is the point: it is shown at 40px.
 */
export const PLUGIN_ICON_MAX_BYTES = 32 * 1024;

const ICON_TYPES: Readonly<Record<string, string>> = {
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

export const PLUGIN_ICON_EXTENSIONS = Object.keys(ICON_TYPES);

/** What a plugin's `package.json` declares, validated and with defaults applied. */
export interface PluginManifestMetadata {
  /** The declared icon path, exactly as written, or `null` for none. */
  icon: null | string;
  metadata: PluginMetadata;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const optionalText = (
  value: unknown,
  field: string,
  source: string,
): null | string => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new Error(
      `${ERROR_PREFIX} \`${field}\` in ${source} has to be a string.`,
    );
  }

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
};

/**
 * Reads the catalog's fields out of a parsed `package.json`.
 *
 * `name` is required - it is the plugin id. Everything else is optional and
 * falls back to what the AdminCP can honestly show: the id as the title, and
 * `null` for a description or version the package does not declare.
 */
export const pluginMetadataFromManifest = (
  manifest: unknown,
  source: string,
): PluginManifestMetadata => {
  if (!isRecord(manifest)) {
    throw new Error(`${ERROR_PREFIX} ${source} is not a JSON object.`);
  }

  const id = optionalText(manifest.name, "name", source);
  if (id === null) {
    throw new Error(
      `${ERROR_PREFIX} ${source} has no \`name\`. A plugin's id is its package name, so it needs one.`,
    );
  }

  const { vitnode } = manifest;
  if (vitnode !== undefined && !isRecord(vitnode)) {
    throw new Error(
      `${ERROR_PREFIX} \`vitnode\` in ${source} has to be an object - for example \`{ "title": "Blog", "icon": "./assets/icon.svg" }\`.`,
    );
  }

  const title = optionalText(vitnode?.title, "vitnode.title", source);
  if (vitnode?.title !== undefined && title === null) {
    throw new Error(
      `${ERROR_PREFIX} \`vitnode.title\` in ${source} is empty. Remove it to fall back to the package name.`,
    );
  }

  const icon = optionalText(vitnode?.icon, "vitnode.icon", source);
  if (vitnode?.icon !== undefined && icon === null) {
    throw new Error(
      `${ERROR_PREFIX} \`vitnode.icon\` in ${source} is empty. Remove it to use the default icon.`,
    );
  }
  if (icon !== null) assertIconPath(icon, source);

  return {
    icon,
    metadata: {
      description: optionalText(manifest.description, "description", source),
      id,
      title: title ?? id,
      version: optionalText(manifest.version, "version", source),
    },
  };
};

const extensionOf = (path: string): string => {
  const dot = path.lastIndexOf(".");

  return dot === -1 ? "" : path.slice(dot).toLowerCase();
};

/**
 * The checks an icon path passes before anything is read: a relative path to a
 * supported image. Whether it stays inside the package is decided against the
 * file system by the caller, which can follow symlinks.
 */
export const assertIconPath = (path: string, source: string): void => {
  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith("//")) {
    throw new Error(
      `${ERROR_PREFIX} \`vitnode.icon\` in ${source} is ${JSON.stringify(path)}, a URL. Point it at an image file inside the package, such as "./assets/icon.svg" - VitNode never fetches icons.`,
    );
  }

  if (path.startsWith("/") || path.startsWith("\\")) {
    throw new Error(
      `${ERROR_PREFIX} \`vitnode.icon\` in ${source} is the absolute path ${JSON.stringify(path)}. Use a path relative to package.json, such as "./assets/icon.svg".`,
    );
  }

  if (!(extensionOf(path) in ICON_TYPES)) {
    throw new Error(
      `${ERROR_PREFIX} \`vitnode.icon\` in ${source} is ${JSON.stringify(path)}. Supported icon formats are ${PLUGIN_ICON_EXTENSIONS.join(", ")}.`,
    );
  }
};

const startsWith = (bytes: Uint8Array, signature: readonly number[]) =>
  signature.every((byte, index) => bytes[index] === byte);

const looksLike = (extension: string, bytes: Uint8Array): boolean => {
  switch (extension) {
    case ".jpeg":
    case ".jpg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case ".png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]);
    case ".svg":
      return /<svg[\s>]/i.test(new TextDecoder().decode(bytes));
    case ".webp":
      return (
        startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP"
      );
    default:
      return false;
  }
};

/**
 * The icon's bytes as a `data:` URL, after checking they are what the
 * extension claims and small enough to inline.
 *
 * Rendered with `<img>`, never as markup, so an SVG's scripts and external
 * references cannot run in the AdminCP.
 */
export const pluginIconDataUrl = (
  path: string,
  bytes: Uint8Array,
  source: string,
): string => {
  if (bytes.byteLength > PLUGIN_ICON_MAX_BYTES) {
    throw new Error(
      `${ERROR_PREFIX} The icon ${JSON.stringify(path)} declared in ${source} is ${String(bytes.byteLength)} bytes. Icons are inlined into the build, so keep them under ${String(PLUGIN_ICON_MAX_BYTES / 1024)} KB - an SVG usually is.`,
    );
  }

  const extension = extensionOf(path);
  if (!looksLike(extension, bytes)) {
    throw new Error(
      `${ERROR_PREFIX} The icon ${JSON.stringify(path)} declared in ${source} is not a valid ${extension.slice(1).toUpperCase()} file.`,
    );
  }

  return `data:${ICON_TYPES[extension]};base64,${Buffer.from(bytes).toString("base64")}`;
};

const HEADER = `/* oxlint-disable */

// This file is generated by VitNode. Do not edit it, and do not format it.
//
// It is rewritten by \`vitnode build\` and \`vitnode dev\` from this package's
// package.json: \`name\`, \`version\`, \`description\` and the \`vitnode\` field.
`;

const literal = (value: null | string): string =>
  value === null ? "null" : JSON.stringify(value);

/**
 * `src/plugin-metadata.gen.ts` - what the AdminCP plugin catalog lists.
 *
 * Plain data, imported by both registrations - `buildPlugin({ metadata })` and
 * `buildApiPlugin({ metadata })` - so neither copies a version by hand.
 */
export const generatePluginMetadataSource = (
  metadata: PluginMetadata,
): string => `${HEADER}//
// Register \`pluginMetadata\` as \`metadata\` in both \`buildPlugin\` and
// \`buildApiPlugin\`.

export const pluginMetadata = {
  id: ${literal(metadata.id)},
  title: ${literal(metadata.title)},
  description: ${literal(metadata.description)},
  version: ${literal(metadata.version)},
} as const
`;

/**
 * `src/plugin-icon.gen.ts` - the icon, for the browser only.
 *
 * Written even when no icon is declared, as `null`, so removing the icon never
 * breaks the `import()` that loads it.
 */
export const generatePluginIconSource = (
  dataUrl: null | string,
): string => `${HEADER}//
// Loaded lazily by \`buildPlugin({ icon: () => import("./plugin-icon.gen") })\`,
// so the bytes reach a browser only on the AdminCP screen that shows them.

const icon: null | string = ${literal(dataUrl)}

export default icon
`;
