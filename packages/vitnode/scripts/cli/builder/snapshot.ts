import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { FileCategory, MeasuredFile } from "./output-files";

/**
 * Bumped whenever the shape - or the meaning of a key - changes, so an old
 * snapshot is discarded instead of compared against something it cannot
 * describe.
 */
export const SNAPSHOT_VERSION = 1;

export interface SnapshotEntry {
  category: FileCategory;
  file: string;
  gzip: null | number;
  size: number;
}

export interface BuildSnapshot {
  files: Record<string, SnapshotEntry>;
  version: typeof SNAPSHOT_VERSION;
}

export type SnapshotRead =
  | { snapshot: BuildSnapshot; status: "ok" }
  | { status: "corrupt" }
  | { status: "missing" };

/**
 * Where the previous build's sizes are kept: next to the other tool caches in
 * `node_modules/.cache`, which every VitNode project already ignores. Nothing
 * here is ever committed, and deleting it only loses one comparison.
 */
export const snapshotPathFor = (projectRoot: string): string =>
  join(projectRoot, "node_modules", ".cache", "vitnode", "build-snapshot.json");

/** Only what a browser downloads is compared; server bundles are not. */
const COMPARED: ReadonlySet<FileCategory> = new Set([
  "asset",
  "client-js",
  "css",
]);

export const createSnapshot = (
  files: readonly MeasuredFile[],
): BuildSnapshot => ({
  files: Object.fromEntries(
    files
      .filter(file => COMPARED.has(file.category))
      .map(file => [
        file.key,
        {
          category: file.category,
          file: file.fileName,
          gzip: file.gzip,
          size: file.size,
        },
      ]),
  ),
  version: SNAPSHOT_VERSION,
});

const isSnapshot = (value: unknown): value is BuildSnapshot => {
  if (typeof value !== "object" || value === null) return false;
  const { files, version } = value as Partial<BuildSnapshot>;
  if (version !== SNAPSHOT_VERSION) return false;
  if (typeof files !== "object" || files === null) return false;

  return Object.values(files).every(
    entry =>
      typeof entry === "object" &&
      typeof entry.size === "number" &&
      typeof entry.file === "string" &&
      typeof entry.category === "string",
  );
};

export const readSnapshot = (path: string): SnapshotRead => {
  if (!existsSync(path)) return { status: "missing" };

  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));

    return isSnapshot(parsed)
      ? { snapshot: parsed, status: "ok" }
      : { status: "corrupt" };
  } catch {
    return { status: "corrupt" };
  }
};

export const writeSnapshot = (path: string, snapshot: BuildSnapshot): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(snapshot)}\n`, "utf8");
};

export interface SizeChange {
  after: number;
  before: number;
  category: FileCategory;
  delta: number;
  file: string;
  key: string;
  ratio: number;
}

export interface SnapshotComparison {
  added: SizeChange[];
  changed: SizeChange[];
  removed: SizeChange[];
  totals: Partial<Record<FileCategory, { after: number; before: number }>>;
}

/** Below this, a size change is noise from a hash or a timestamp. */
const MIN_REPORTED_DELTA = 1000;

/**
 * Matches the current build against the previous one by logical key, so
 * `editor-F9aK2.js` and `editor-H2kq9.js` are the same file that changed.
 */
export const compareSnapshots = (
  previous: BuildSnapshot,
  current: BuildSnapshot,
): SnapshotComparison => {
  const added: SizeChange[] = [];
  const changed: SizeChange[] = [];
  const removed: SizeChange[] = [];
  const totals: SnapshotComparison["totals"] = {};

  const addTotal = (category: FileCategory, before: number, after: number) => {
    const total = totals[category] ?? { after: 0, before: 0 };
    total.before += before;
    total.after += after;
    totals[category] = total;
  };

  for (const [key, entry] of Object.entries(current.files)) {
    const old = previous.files[key];
    addTotal(entry.category, old?.size ?? 0, entry.size);

    if (old === undefined) {
      added.push({
        after: entry.size,
        before: 0,
        category: entry.category,
        delta: entry.size,
        file: entry.file,
        key,
        ratio: 1,
      });
      continue;
    }

    const delta = entry.size - old.size;
    if (Math.abs(delta) < MIN_REPORTED_DELTA) continue;

    changed.push({
      after: entry.size,
      before: old.size,
      category: entry.category,
      delta,
      file: entry.file,
      key,
      ratio: old.size === 0 ? 1 : delta / old.size,
    });
  }

  for (const [key, entry] of Object.entries(previous.files)) {
    if (key in current.files) continue;
    addTotal(entry.category, entry.size, 0);
    removed.push({
      after: 0,
      before: entry.size,
      category: entry.category,
      delta: -entry.size,
      file: entry.file,
      key,
      ratio: -1,
    });
  }

  const byImpact = (a: SizeChange, b: SizeChange) =>
    Math.abs(b.delta) - Math.abs(a.delta);

  return {
    added: added.sort(byImpact),
    changed: changed.sort(byImpact),
    removed: removed.sort(byImpact),
    totals,
  };
};

/** A change worth flagging: over 10% *and* over 10 kB bigger. */
export const isNotableGrowth = (change: SizeChange): boolean =>
  change.delta > 10_000 && change.ratio > 0.1;
