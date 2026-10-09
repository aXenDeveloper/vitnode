// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { detectPackageManager } from "./package-manager";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "vitnode-package-manager-"));
  mkdirSync(join(root, "apps", "web"), { recursive: true });
  writeFileSync(join(root, "apps", "web", "package.json"), "{}");
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

const web = () => join(root, "apps", "web");

describe("detectPackageManager", () => {
  it("is the package manager that started the command", () => {
    writeFileSync(join(root, "yarn.lock"), "");

    expect(
      detectPackageManager(web(), {
        npm_config_user_agent: "pnpm/10.18.0 npm/? node/v24.15.0",
      }),
    ).toBe("pnpm");
  });

  it("is the one the workspace declares", () => {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ packageManager: "yarn@4.9.1" }),
    );

    expect(detectPackageManager(web(), {})).toBe("yarn");
  });

  it("is the one whose lockfile the workspace has", () => {
    writeFileSync(join(root, "bun.lock"), "");

    expect(detectPackageManager(web(), {})).toBe("bun");
  });

  it("is unknown when nothing names one", () => {
    expect(detectPackageManager(web(), {})).toBeUndefined();
  });

  it("is unknown for a package manager it cannot name a command for", () => {
    expect(
      detectPackageManager(web(), { npm_config_user_agent: "deno/2.5.0" }),
    ).toBeUndefined();
  });
});
