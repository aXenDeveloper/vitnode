// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BuildOutputFile, FileCategory } from "./output-files";

import { brotliSize, gzipSize, measureFiles } from "./measure";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "vitnode-measure-"));
});

afterEach(() => {
  rmSync(dir, { force: true, recursive: true });
});

const fileOf = (
  name: string,
  content: string,
  category: FileCategory,
): BuildOutputFile => {
  const absolutePath = join(dir, name);
  writeFileSync(absolutePath, content);

  return {
    absolutePath,
    category,
    consumer: category === "server" ? "server" : "client",
    displayPath: name,
    environment: category === "server" ? "ssr" : "client",
    fileName: name,
    isEntry: false,
    key: name,
    modules: [],
    type: "chunk",
  };
};

describe("measureFiles", () => {
  it("reads the raw size from disk and compresses client scripts", async () => {
    const script = "export const value = 'vitnode';\n".repeat(500);
    const [measured] = await measureFiles(
      [fileOf("a.js", script, "client-js")],
      {
        brotli: 0,
      },
    );

    expect(measured.size).toBe(Buffer.byteLength(script));
    expect(measured.gzip).toBeGreaterThan(0);
    expect(measured.gzip).toBeLessThan(measured.size);
    expect(measured.brotli).toBeNull();
  });

  it("does not compress server output", async () => {
    const [measured] = await measureFiles(
      [fileOf("index.mjs", "x".repeat(5000), "server")],
      {
        brotli: 25,
      },
    );

    expect(measured.size).toBe(5000);
    expect(measured.gzip).toBeNull();
    expect(measured.brotli).toBeNull();
  });

  it("measures an empty file as zero everywhere", async () => {
    const [measured] = await measureFiles(
      [fileOf("empty.js", "", "client-js")],
      {
        brotli: 1,
      },
    );

    expect(measured).toMatchObject({ brotli: 0, gzip: 0, size: 0 });
  });

  it("computes brotli only for the largest files when asked", async () => {
    const files = [
      fileOf(
        "big.js",
        "a".repeat(20_000) + Math.random().toString(),
        "client-js",
      ),
      fileOf("small.js", "b".repeat(100), "client-js"),
    ];
    const measured = await measureFiles(files, { brotli: 1 });

    expect(
      measured.find(file => file.fileName === "big.js")?.brotli,
    ).toBeGreaterThan(0);
    expect(
      measured.find(file => file.fileName === "small.js")?.brotli,
    ).toBeNull();
  });
});

describe("compression helpers", () => {
  it("compress repetitive content well", async () => {
    const content = Buffer.from("vitnode ".repeat(10_000));

    expect(await gzipSize(content)).toBeLessThan(content.length / 10);
    expect(await brotliSize(content)).toBeLessThan(content.length / 10);
  });
});
