// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { build } from "tsdown";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import config from "../../../tsdown.config";

const packageRoot = join(import.meta.dirname, "..", "..", "..");
const manifest = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8"),
) as { version: string };

let root: string;

const write = (path: string, content: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

describe("the scripts build (tsdown.config.ts)", () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "vitnode-scripts-build-"));
  });

  it("replaces dist/scripts and leaves the package build's dist/src alone", async () => {
    write("package.json", JSON.stringify({ name: "fixture", type: "module" }));
    write("scripts/scripts.ts", 'console.log("cli");\n');
    write("scripts/package-watch.ts", 'console.log("runner");\n');
    write("dist/scripts/stale-chunk.js", "// from an older build\n");
    write("dist/src/index.js", "export const kept = true;\n");
    write("dist/tsconfig.build.tsbuildinfo", "{}");

    await build({ ...config, config: false, cwd: root, logLevel: "silent" });

    expect(existsSync(join(root, "dist/scripts/scripts.js"))).toBe(true);
    expect(existsSync(join(root, "dist/scripts/package-watch.js"))).toBe(true);
    expect(existsSync(join(root, "dist/scripts/stale-chunk.js"))).toBe(false);
    expect(readFileSync(join(root, "dist/src/index.js"), "utf8")).toBe(
      "export const kept = true;\n",
    );
    expect(existsSync(join(root, "dist/tsconfig.build.tsbuildinfo"))).toBe(
      true,
    );
  }, 60_000);
});

describe("the built CLI", () => {
  beforeEach(() => {
    // Inside the package, so the bundle's external dependencies - commander,
    // dotenv, jiti - resolve from its node_modules as they do once installed.
    const cache = join(packageRoot, "node_modules", ".cache");
    mkdirSync(cache, { recursive: true });
    root = mkdtempSync(join(cache, "vitnode-built-cli-"));
  });

  const buildCli = async () => {
    const outDir = join(root, "dist", "scripts");
    await build({
      ...config,
      clean: [outDir],
      config: false,
      cwd: packageRoot,
      logLevel: "silent",
      outDir,
    });

    return outDir;
  };

  it("runs from the compiled output, not only through a TypeScript runner", async () => {
    const outDir = await buildCli();

    expect(
      execFileSync(
        process.execPath,
        [join(outDir, "scripts.js"), "--version"],
        {
          encoding: "utf8",
        },
      ).trim(),
    ).toBe(manifest.version);
    expect(
      execFileSync(process.execPath, [join(outDir, "scripts.js"), "--help"], {
        encoding: "utf8",
      }),
    ).toContain("vitnode <command> [options]");
    // Minified, ESM, and free of `require` - nothing needs a CommonJS shim.
    const entry = readFileSync(join(outDir, "scripts.js"), "utf8");
    expect(entry.startsWith("#!/usr/bin/env node\n")).toBe(true);
    expect(entry).toMatch(/^import\b/m);
    expect(entry).not.toMatch(/\brequire\(/);
  }, 60_000);

  it("ships the watch runner next to it, which reports a missing tsdown and exits", async () => {
    const outDir = await buildCli();
    const project = mkdtempSync(join(tmpdir(), "vitnode-no-tsdown-"));
    writeFileSync(join(project, "package.json"), "{}");

    try {
      const result = spawnSync(
        process.execPath,
        [join(outDir, "package-watch.js")],
        // pnpm's bin shims put the workspace's whole store on NODE_PATH,
        // where tsdown would be found; a project of its own has no such path.
        {
          cwd: project,
          encoding: "utf8",
          env: { ...process.env, NODE_PATH: "" },
        },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Could not find "tsdown"');
      expect(result.stderr).toContain("pnpm add -D tsdown");
    } finally {
      rmSync(project, { force: true, recursive: true });
    }
  }, 60_000);
});
