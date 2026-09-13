import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { pluginScripts } from "../plugin/create/create-package-json.js";
import { rootScripts } from "./create-package-json.js";

interface TurboTask {
  cache?: boolean;
  dependsOn?: string[];
  outputs?: string[];
}

const turbo: { tasks: Record<string, TurboTask> } = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../../copy-of-vitnode-app/monorepo/turbo.json",
    ),
    "utf8",
  ),
) as { tasks: Record<string, TurboTask> };

const scripts = rootScripts(true, false, "my-app");

describe("the generated monorepo's plugin build", () => {
  it("declares the task a plugin's own package.json implements", () => {
    expect(Object.keys(pluginScripts(false))).toContain("build:plugins");
    expect(turbo.tasks["build:plugins"]).toBeDefined();
  });

  it("compiles a plugin's dependencies before the plugin itself", () => {
    expect(turbo.tasks["build:plugins"].dependsOn).toEqual(["^build:plugins"]);
  });

  it("caches the dist a plugin's package exports point at", () => {
    expect(turbo.tasks["build:plugins"].outputs).toEqual(["dist/**"]);
  });

  it("gives the root a script to run it on its own", () => {
    expect(scripts["build:plugins"]).toBe("turbo build:plugins");
  });
});

describe("what waits for the plugin build", () => {
  it("builds plugins before an app build, which imports their dist", () => {
    expect(turbo.tasks.build.dependsOn).toContain("^build:plugins");
  });

  it("builds plugins before the database bootstrap reads their config", () => {
    expect(turbo.tasks["db:prepare"].dependsOn).toContain("^build:plugins");
  });

  it("builds plugins before dev starts, which turbo cannot express", () => {
    expect(scripts.dev).toBe(
      "turbo build:plugins && turbo db:prepare && turbo dev",
    );
  });

  it("keeps the bootstrap gated behind the plugin build in that order", () => {
    const order = ["build:plugins", "db:prepare", "dev"].map(task =>
      scripts.dev.indexOf(`turbo ${task}`),
    );

    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every(index => index >= 0)).toBe(true);
  });
});

describe("the scripts a generated root still exposes", () => {
  it("leaves build to turbo, which resolves the dependency itself", () => {
    expect(scripts.build).toBe("turbo build");
  });

  it("adds nothing to a shape that has no root package.json", () => {
    const app = readFileSync(
      join(import.meta.dirname, "create-package-json.ts"),
      "utf8",
    );

    expect(app).toContain("singleAppScripts");
    expect(app.split('"build:plugins": "turbo build:plugins"')).toHaveLength(2);
  });
});
