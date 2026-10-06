import { isAbsolute, relative } from "node:path";

import { toDisplayPath } from "../ui/format";

export type FileCategory = "asset" | "client-js" | "css" | "other" | "server";

export type Consumer = "client" | "server";

export interface ChunkModule {
  id: string;
  renderedLength: number;
}

/**
 * One file a build wrote, with what the bundler knew about it.
 *
 * `key` is the file's *logical* identity - stable across builds even though
 * `fileName` carries a content hash - and is what the previous-build
 * comparison matches on.
 */
export interface BuildOutputFile {
  absolutePath: string;
  category: FileCategory;
  consumer: Consumer;
  /** Path relative to the project root, forward slashes, for display. */
  displayPath: string;
  environment: string;
  /** Path inside the environment's output directory. */
  fileName: string;
  isEntry: boolean;
  key: string;
  modules: ChunkModule[];
  type: "asset" | "chunk";
}

export interface MeasuredFile extends BuildOutputFile {
  brotli: null | number;
  gzip: null | number;
  size: number;
}

const ASSET_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".eot",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".mp3",
  ".mp4",
  ".otf",
  ".png",
  ".svg",
  ".ttf",
  ".wasm",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
]);

const extensionOf = (fileName: string): string => {
  const match = /\.[^./\\]+$/.exec(fileName);

  return match === null ? "" : match[0].toLowerCase();
};

/** Source maps are debugging aids, not output anyone downloads. */
export const isReportedFile = (fileName: string): boolean =>
  extensionOf(fileName) !== ".map";

export const categorize = (
  fileName: string,
  consumer: Consumer,
): FileCategory => {
  if (consumer === "server") return "server";

  const extension = extensionOf(fileName);
  if (extension === ".js" || extension === ".mjs") return "client-js";
  if (extension === ".css") return "css";
  if (ASSET_EXTENSIONS.has(extension)) return "asset";

  return "other";
};

/**
 * A content hash Rolldown/Rollup put into a file name: 8 URL-safe base64
 * characters before the extension. At least one digit, capital or `_` is
 * required so that an ordinary eight-letter word (`-provider.js`) is not taken
 * for one.
 */
const HASH_PATTERN = /[-.]([A-Za-z0-9_-]{8})(?=\.[A-Za-z0-9]+$)/;

export const stripHash = (fileName: string): string => {
  const match = HASH_PATTERN.exec(fileName);
  if (match === null || !/[0-9A-Z_]/.test(match[1])) return fileName;

  return fileName.slice(0, match.index) + fileName.slice(match.index + 9);
};

const isVirtual = (id: string) =>
  id.startsWith("\0") || id.startsWith("virtual:");

/** A module id as a stable, machine-independent string. */
export const relativeModuleId = (id: string, root: string): string => {
  const withoutQuery = id.split("?")[0] ?? id;
  if (isVirtual(withoutQuery) || !isAbsolute(withoutQuery)) {
    return toDisplayPath(withoutQuery.replace(/^\0/, ""));
  }

  return toDisplayPath(relative(root, withoutQuery));
};

export interface LogicalKeyInput {
  environment: string;
  facadeModuleId?: null | string;
  fileName: string;
  modules?: readonly ChunkModule[];
  name?: string;
  originalFileNames?: readonly string[];
  type: "asset" | "chunk";
}

/**
 * The identity of a file across builds.
 *
 * - An entry chunk is the module it is the facade for.
 * - A shared chunk has no facade, so it is its name plus the module that makes
 *   up most of it: the name alone repeats (`index`, `dist`), the dominant
 *   module rarely does and survives small edits.
 * - An asset is the source file it was emitted from.
 * - Anything else falls back to its file name without the hash.
 *
 * Paths are relative to the project root, so a snapshot taken on one machine
 * compares cleanly on another.
 */
export const logicalKey = (input: LogicalKeyInput, root: string): string => {
  const prefix = `${input.environment}:`;

  if (input.type === "chunk") {
    if (input.facadeModuleId != null && !isVirtual(input.facadeModuleId)) {
      return prefix + relativeModuleId(input.facadeModuleId, root);
    }

    const dominant = [...(input.modules ?? [])].sort(
      (a, b) => b.renderedLength - a.renderedLength,
    )[0];

    if (input.name !== undefined && dominant !== undefined) {
      return `${prefix}${input.name}@${relativeModuleId(dominant.id, root)}`;
    }
  }

  const original = input.originalFileNames?.[0];
  if (input.type === "asset" && original !== undefined) {
    return prefix + toDisplayPath(original);
  }

  return prefix + toDisplayPath(stripHash(input.fileName));
};

/** Makes keys unique, in output order, so two identical keys cannot merge. */
export const dedupeKeys = <T extends { key: string }>(files: T[]): T[] => {
  const seen = new Map<string, number>();

  return files.map(file => {
    const count = seen.get(file.key) ?? 0;
    seen.set(file.key, count + 1);

    return count === 0
      ? file
      : { ...file, key: `${file.key}#${String(count + 1)}` };
  });
};
