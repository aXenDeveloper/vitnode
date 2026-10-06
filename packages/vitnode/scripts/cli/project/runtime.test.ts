// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { detectRuntime, runtimeExecutable } from "./runtime";

const node = { ...process.versions, bun: undefined } as NodeJS.ProcessVersions;
let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "vitnode-runtime-"));
  mkdirSync(join(root, "apps", "api"), { recursive: true });
  writeFileSync(join(root, "apps", "api", "package.json"), "{}");
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

const api = () => join(root, "apps", "api");

describe("detectRuntime", () => {
  it("is Bun when Bun started the script, even though vitnode runs on Node", () => {
    expect(
      detectRuntime(
        api(),
        { npm_config_user_agent: "bun/1.3.14 npm/? node/v24" },
        node,
      ),
    ).toBe("bun");
  });

  it("is Bun when the workspace declares Bun as its package manager", () => {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ packageManager: "bun@1.3.14" }),
    );

    expect(detectRuntime(api(), {}, node)).toBe("bun");
  });

  it("is Bun when the workspace has a Bun lockfile", () => {
    writeFileSync(join(root, "bun.lock"), "");

    expect(detectRuntime(api(), {}, node)).toBe("bun");
  });

  it("is Node for a pnpm, npm or Yarn project", () => {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ packageManager: "pnpm@11.9.0" }),
    );

    expect(
      detectRuntime(api(), { npm_config_user_agent: "pnpm/11.9.0" }, node),
    ).toBe("node");
  });

  it("is Bun when the CLI itself runs under Bun", () => {
    expect(detectRuntime(api(), {}, { ...node, bun: "1.3.14" })).toBe("bun");
  });
});

describe("runtimeExecutable", () => {
  it("uses Node itself for Node, and bun from the PATH for Bun", () => {
    expect(runtimeExecutable("node", node)).toBe(process.execPath);
    expect(runtimeExecutable("bun", node)).toBe("bun");
    expect(runtimeExecutable("bun", { ...node, bun: "1.3.14" })).toBe(
      process.execPath,
    );
  });
});
