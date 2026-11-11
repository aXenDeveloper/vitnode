import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyPlan, GenerationPlan } from "./plan";

let root: string;

const read = (path: string) => readFileSync(join(root, path), "utf8");

/** Every path under `root`, so a leftover temp file or folder shows up. */
const tree = (dir = root, prefix = ""): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory()
      ? [
          `${prefix}${entry.name}/`,
          ...tree(join(dir, entry.name), `${prefix}${entry.name}/`),
        ]
      : [`${prefix}${entry.name}`],
  );

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "vitnode-plan-"));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src/config.api.ts"), "export const a = 1;\n");
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

describe("applyPlan", () => {
  it("writes nothing when a planned file changed on disk after it was read", () => {
    const plan = new GenerationPlan(root);
    plan.create("src/api/modules/notes/notes.module.ts", "new\n", "module");
    plan.update("src/config.api.ts", "export const a = 2;\n", "register");
    const changes = plan.changes();
    writeFileSync(join(root, "src/config.api.ts"), "edited meanwhile\n");
    const before = tree();

    expect(() => {
      applyPlan(plan.root, changes);
    }).toThrow(
      expect.objectContaining({
        message:
          "src/config.api.ts changed while the generator was running. Nothing was written.",
        name: "RuntimeError",
      }),
    );
    expect(read("src/config.api.ts")).toBe("edited meanwhile\n");
    expect(tree()).toEqual(before);
  });

  it("rolls back every file and folder of a batch that fails half way", () => {
    const plan = new GenerationPlan(root);
    plan.update("src/config.api.ts", "export const a = 2;\n", "register");
    plan.create("src/api/modules/notes/notes.module.ts", "new\n", "module");
    const changes = plan.changes();
    const create = changes.find(change => change.kind === "create");
    if (create === undefined) throw new Error("no create planned");
    const before = tree();

    expect(() => {
      applyPlan(plan.root, [...changes, create]);
    }).toThrow(
      "Writing the generated files failed. The changes already written were rolled back.",
    );
    expect(read("src/config.api.ts")).toBe("export const a = 1;\n");
    expect(existsSync(join(root, "src/api"))).toBe(false);
    expect(tree()).toEqual(before);
  });
});
