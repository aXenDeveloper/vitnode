// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  findWorkspaceRoot,
  parsePnpmWorkspaceGlobs,
  workspacePackageDirs,
} from "./workspace";

describe("parsePnpmWorkspaceGlobs", () => {
  it("reads the packages list and nothing else", () => {
    expect(
      parsePnpmWorkspaceGlobs(`packages:
  - apps/*
  - "packages/*"
  - 'plugins/*' # plugins
allowBuilds:
  esbuild: true
catalog:
  - not-a-package
`),
    ).toEqual(["apps/*", "packages/*", "plugins/*"]);
  });
});

describe("workspace discovery", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "vitnode-workspace-"));
  });

  afterEach(() => {
    rmSync(root, { force: true, recursive: true });
  });

  it("finds package folders from package.json workspaces", () => {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ workspaces: ["apps/*", "tools"] }),
    );
    for (const dir of ["apps/web", "apps/api", "tools"]) {
      mkdirSync(join(root, dir), { recursive: true });
      writeFileSync(join(root, dir, "package.json"), "{}");
    }
    mkdirSync(join(root, "apps", "not-a-package"));
    mkdirSync(join(root, "apps", "web", "src"), { recursive: true });

    expect(findWorkspaceRoot(join(root, "apps", "web", "src"))).toBe(root);
    expect(workspacePackageDirs(root)).toEqual([
      join(root, "apps", "api"),
      join(root, "apps", "web"),
      join(root, "tools"),
    ]);
  });

  it("returns null outside a workspace", () => {
    expect(findWorkspaceRoot(root)).toBeNull();
  });
});
