// @vitest-environment node
import type { ChildProcess } from "node:child_process";

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { RunProcessOptions } from "../project/processes";

import { runDevCommand } from "../commands/dev";
import { ProcessGroup } from "../project/processes";
import { createTestContext } from "../testing";

const packageRoot = join(import.meta.dirname, "..", "..", "..");
const template = join(
  packageRoot,
  "..",
  "create-vitnode-app",
  "copy-of-vitnode-plugin",
  "root",
);

let root: string;

const write = (path: string, content: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};

const read = (path: string) =>
  existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : "";

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "vitnode-package-watch-"));
  symlinkSync(
    join(packageRoot, "node_modules"),
    join(root, "node_modules"),
    "junction",
  );
  cpSync(join(template, "tsconfig.json"), join(root, "tsconfig.json"));
  cpSync(
    join(template, "tsconfig.build.json"),
    join(root, "tsconfig.build.json"),
  );
  write(
    "package.json",
    JSON.stringify({
      exports: { "./*": "./dist/src/*.js" },
      name: "@acme/watched",
      type: "module",
    }),
  );
  write("src/index.ts", 'export const version = "one";\n');
  write("src/locales/en.json", '{ "hello": "Hi" }\n');
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

/** Resolves once `check` passes, failing the test after `timeout`. */
const until = async (check: () => boolean, timeout = 30_000) => {
  const deadline = Date.now() + timeout;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("condition never became true");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};

/** The real process group, remembering the process ids it started. */
class RecordingGroup extends ProcessGroup {
  readonly pids: (number | undefined)[] = [];

  override spawn(options: RunProcessOptions): ChildProcess {
    const child = super.spawn(options);
    this.pids.push(child.pid);

    return child;
  }
}

const isRunning = (pid: number | undefined) => {
  if (pid === undefined) return false;
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

describe("vitnode dev in a plugin package", () => {
  it("builds from an empty dist, follows every change, recovers from errors and leaves no process behind", async () => {
    const group = new RecordingGroup();
    const { context, runtime } = createTestContext({ cwd: root });

    const running = runDevCommand(context, {}, { group });

    // The first build, JavaScript and declarations, into a dist that did not exist.
    await until(() => read("dist/src/index.js").includes("one"));
    await until(() => read("dist/src/index.d.ts").includes("version"));
    expect(read("dist/src/locales/en.json")).toBe('{ "hello": "Hi" }\n');
    // Development output is readable and points back at the source.
    expect(read("dist/src/index.js")).toContain(
      "sourceMappingURL=index.js.map",
    );

    write("src/index.ts", 'export const version = "two";\n');
    await until(() => read("dist/src/index.js").includes("two"));

    write("src/added.ts", "export const added = true;\n");
    await until(() => read("dist/src/added.js").includes("added"));

    rmSync(join(root, "src/added.ts"));
    await until(() => !existsSync(join(root, "dist/src/added.js")));

    write("src/locales/en.json", '{ "hello": "Hello" }\n');
    await until(() => read("dist/src/locales/en.json").includes("Hello"));

    // A broken save is reported and leaves the last good output in place; the
    // next good one is built as usual.
    write("src/index.ts", "export const version = ;\n");
    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(read("dist/src/index.js")).toContain("two");
    write("src/index.ts", 'export const version = "three";\n');
    await until(() => read("dist/src/index.js").includes("three"));

    runtime.signals.emit("SIGINT");

    expect(await running).toBe(0);
    expect(group.pids).toHaveLength(3);
    expect(group.pids.filter(isRunning)).toEqual([]);
  }, 180_000);
});
