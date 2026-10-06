// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { FileCategory, MeasuredFile } from "./output-files";

import {
  compareSnapshots,
  createSnapshot,
  isNotableGrowth,
  readSnapshot,
  snapshotPathFor,
  writeSnapshot,
} from "./snapshot";

const file = (
  key: string,
  fileName: string,
  size: number,
  category: FileCategory = "client-js",
): MeasuredFile => ({
  absolutePath: `/app/.output/public/${fileName}`,
  brotli: null,
  category,
  consumer: category === "server" ? "server" : "client",
  displayPath: `.output/public/${fileName}`,
  environment: "client",
  fileName,
  gzip: Math.round(size / 3),
  isEntry: false,
  key,
  modules: [],
  size,
  type: "chunk",
});

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "vitnode-snapshot-"));
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

describe("reading a snapshot", () => {
  it("reports a first build as missing", () => {
    expect(readSnapshot(snapshotPathFor(root))).toEqual({ status: "missing" });
  });

  it("round-trips through the cache folder", () => {
    const path = snapshotPathFor(root);
    const snapshot = createSnapshot([
      file("client:src/main.tsx", "assets/main-AAAAAAA1.js", 1000),
    ]);
    writeSnapshot(path, snapshot);

    expect(path).toContain(join("node_modules", ".cache", "vitnode"));
    expect(readSnapshot(path)).toEqual({ snapshot, status: "ok" });
  });

  it.each([
    ["is not JSON", "{ not json"],
    ["is from another version", JSON.stringify({ files: {}, version: 0 })],
    [
      "has malformed entries",
      JSON.stringify({ files: { a: { size: "big" } }, version: 1 }),
    ],
  ])("treats a snapshot that %s as corrupt", (_, content) => {
    const path = snapshotPathFor(root);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);

    expect(readSnapshot(path)).toEqual({ status: "corrupt" });
  });

  it("does not record server output", () => {
    const snapshot = createSnapshot([
      file("client:a", "a.js", 1),
      file("nitro:index", "index.mjs", 1, "server"),
    ]);

    expect(Object.keys(snapshot.files)).toEqual(["client:a"]);
  });
});

describe("compareSnapshots", () => {
  it("matches files by logical key even though their hashes changed", () => {
    const before = createSnapshot([
      file("client:src/editor.tsx", "assets/editor-F9aK2bQ3.js", 342_500),
    ]);
    const after = createSnapshot([
      file("client:src/editor.tsx", "assets/editor-H2kq9ZZ1.js", 428_600),
    ]);

    const { added, changed, removed } = compareSnapshots(before, after);

    expect(added).toEqual([]);
    expect(removed).toEqual([]);
    expect(changed).toEqual([
      expect.objectContaining({
        after: 428_600,
        before: 342_500,
        delta: 86_100,
        file: "assets/editor-H2kq9ZZ1.js",
      }),
    ]);
    expect(changed[0].ratio).toBeCloseTo(0.2514, 3);
    expect(isNotableGrowth(changed[0])).toBe(true);
  });

  it("ignores changes under 1 kB", () => {
    const before = createSnapshot([file("k", "a.js", 10_000)]);
    const after = createSnapshot([file("k", "a.js", 10_400)]);

    expect(compareSnapshots(before, after).changed).toEqual([]);
  });

  it("reports added and removed files and totals per category", () => {
    const before = createSnapshot([
      file("old", "old.js", 5000),
      file("kept", "kept.js", 1000),
    ]);
    const after = createSnapshot([
      file("new", "new.js", 7000),
      file("kept", "kept.js", 1000),
    ]);

    const comparison = compareSnapshots(before, after);

    expect(comparison.added.map(change => change.key)).toEqual(["new"]);
    expect(comparison.removed.map(change => change.key)).toEqual(["old"]);
    expect(comparison.totals["client-js"]).toEqual({
      after: 8000,
      before: 6000,
    });
  });

  it("orders changes by impact", () => {
    const before = createSnapshot([
      file("a", "a.js", 10_000),
      file("b", "b.js", 10_000),
    ]);
    const after = createSnapshot([
      file("a", "a.js", 12_000),
      file("b", "b.js", 50_000),
    ]);

    expect(
      compareSnapshots(before, after).changed.map(change => change.key),
    ).toEqual(["b", "a"]);
  });

  it("does not flag a shrinking file", () => {
    const before = createSnapshot([file("a", "a.js", 625_200)]);
    const after = createSnapshot([file("a", "a.js", 612_400)]);

    expect(isNotableGrowth(compareSnapshots(before, after).changed[0])).toBe(
      false,
    );
  });
});
