import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  apiScripts,
  rootScripts,
  singleAppScripts,
  webScripts,
} from "./create-package-json.js";

const templateRoot = resolve(
  import.meta.dirname,
  "../..",
  "copy-of-vitnode-app",
);

/** The bootstrap command, in the two spellings a generated script may use. */
const BOOTSTRAP =
  /^(?<gate>(?:vitnode|turbo) db:prepare)\s*&&\s*(?<runtime>.+)$/;

/** Anything that serves a request. */
const RUNTIME = /\b(?:vite dev|tsx watch|bun run --hot|turbo dev|next dev)\b/;

const gatesOnBootstrap = (dev: string): boolean => {
  const match = BOOTSTRAP.exec(dev.trim());

  if (match?.groups === undefined) return false;

  return (
    RUNTIME.test(match.groups.runtime) &&
    !RUNTIME.test(match.groups.gate) &&
    dev.indexOf("db:prepare") < (RUNTIME.exec(dev)?.index ?? -1)
  );
};

const shapes = [
  {
    dev: () => singleAppScripts(true, true, "app").dev,
    label: "singleApp, flat",
  },
  {
    dev: () => apiScripts("pnpm", true, true, true, "app").dev,
    label: "onlyApi, flat",
  },
  {
    dev: () => apiScripts("bun", true, true, true, "app").dev,
    label: "onlyApi, flat, bun",
  },
  {
    dev: () => rootScripts(true, true, "app").dev,
    label: "monorepo root",
  },
] as const;

describe("a generated project prepares its database before it starts", () => {
  it.each(shapes.map(shape => [shape.label, shape] as const))(
    "%s gates dev on the bootstrap",
    (_label, shape) => {
      const dev = shape.dev();

      expect(dev, dev).toMatch(BOOTSTRAP);
      expect(gatesOnBootstrap(dev), dev).toBe(true);
    },
  );

  /**
   * The exact strings, so a reader of this file can see what a developer runs.
   * `it.each` above says the property; this says the value.
   */
  it("spells each one out", () => {
    expect(singleAppScripts(true, true, "app").dev).toBe(
      "vitnode db:prepare && vite dev --port 3000",
    );
    expect(apiScripts("pnpm", true, true, true, "app").dev).toBe(
      "vitnode db:prepare && tsx watch src/index.ts",
    );
    expect(apiScripts("bun", true, true, true, "app").dev).toBe(
      "vitnode db:prepare && bun run --hot src/index.ts",
    );
    expect(rootScripts(true, true, "app").dev).toBe(
      "turbo db:prepare && turbo dev",
    );
  });

  it.each(shapes.map(shape => [shape.label, shape] as const))(
    "%s does not background the bootstrap",
    (_label, shape) => {
      const dev = shape.dev();

      expect(dev).not.toMatch(/(?<!&)&(?!&)/);
      expect(dev).not.toContain("concurrently");
      expect(dev).not.toContain("npm-run-all");
      expect(dev).not.toContain("&&&");
    },
  );

  /**
   * A package that owns a schema exposes the bootstrap on its own, so it can be
   * run by hand and - in a monorepo - resolved by the root's `turbo db:prepare`.
   */
  it("exposes db:prepare on every schema-owning package", () => {
    expect(singleAppScripts(true, true, "app")["db:prepare"]).toBe(
      "vitnode db:prepare",
    );
    expect(apiScripts("pnpm", true, true, false, "app")["db:prepare"]).toBe(
      "vitnode db:prepare",
    );
    expect(rootScripts(true, true, "app")["db:prepare"]).toBe(
      "turbo db:prepare",
    );
  });
});

describe("every schema-owning app gates itself, root or not", () => {
  it("gates the api inside a monorepo too", () => {
    expect(apiScripts("pnpm", true, true, false, "app").dev).toBe(
      "vitnode db:prepare && tsx watch src/index.ts",
    );
  });

  it("gates the single app inside a monorepo too", () => {
    expect(singleAppScripts(true, true, "app").dev).toBe(
      "vitnode db:prepare && vite dev --port 3000",
    );
  });

  /** And the root still gates, so the first run is one clean serial pass. */
  it("still gates the workspace at the root", () => {
    expect(gatesOnBootstrap(rootScripts(true, true, "app").dev)).toBe(true);
  });
});

describe("the web app of a split deployment owns no database", () => {
  const web = webScripts(true);

  it("has no database script at all", () => {
    for (const key of ["db:prepare", "db:migrate", "drizzle-kit", "init"]) {
      expect(Object.keys(web)).not.toContain(key);
    }
  });

  it("runs only the dev server", () => {
    expect(web.dev).toBe("vite dev --port 3000");
    expect(web.dev).not.toContain("db:");
    expect(web.dev).not.toContain("migrate");
  });

  it("needs no preparation step of its own", () => {
    expect(web.dev).not.toContain("vitnode");
  });
});

describe("no legacy lifecycle is generated", () => {
  const everyScript = [
    rootScripts(true, true, "app"),
    apiScripts("pnpm", true, true, true, "app"),
    apiScripts("bun", true, true, false, "app"),
    singleAppScripts(true, true, "app"),
    singleAppScripts(true, true, "app"),
    webScripts(true),
  ].flatMap(scripts => Object.entries(scripts));

  it.each([
    ["a Next dev server", /\bnext (?:dev|build|start)\b/],
    ["the old init command", /vitnode init/],
    ["the web no-op flag", /--web\b/],
    ["a turbo init task", /turbo init/],
    ["a plugin route copier", /prepare-plugins|vitnode plugin\b/],
  ])("generates no %s", (_label, forbidden) => {
    const offenders = everyScript
      .filter(([, value]) => forbidden.test(value))
      .map(([key, value]) => `${key}: ${value}`);

    expect(offenders).toEqual([]);
  });

  it("keeps db:migrate, which the documentation and deployments name", () => {
    // `docs/dev/database`, the Content Engine guides and the Vercel deployment
    // page all tell people to run it, so its name and behaviour are a contract.
    expect(rootScripts(true, true, "app")["db:migrate"]).toBe(
      "turbo db:migrate",
    );
    expect(apiScripts("pnpm", true, true, true, "app")["db:migrate"]).toBe(
      "vitnode migrate",
    );
    expect(singleAppScripts(true, true, "app")["db:migrate"]).toBe(
      "vitnode migrate",
    );
  });
});

describe("the generated turbo.json", () => {
  const turbo = JSON.parse(
    readFileSync(join(templateRoot, "monorepo", "turbo.json"), "utf8"),
  ) as {
    tasks: Record<string, { dependsOn?: string[]; persistent?: boolean }>;
  };

  it("declares a db:prepare task", () => {
    expect(Object.keys(turbo.tasks)).toContain("db:prepare");
  });

  /**
   * Not persistent, and that is the reason the root gates with `&&` rather than
   * with a `dependsOn`. Turbo treats a persistent task as one that never
   * finishes: it may not be depended upon, and it is started as soon as its own
   * dependencies are met - per package. A `dev` that "depends on" a bootstrap
   * would therefore still start the second package's dev server against an
   * unmigrated schema. A one-shot task run to completion before `turbo dev` is
   * invoked has no such ordering to get wrong.
   */
  it("makes both database tasks one-shot, so they can be sequenced", () => {
    expect(turbo.tasks["db:prepare"].persistent).toBeUndefined();
    expect(turbo.tasks["db:migrate"].persistent).toBeUndefined();
    expect(turbo.tasks.dev.persistent).toBe(true);
  });

  it("has no init task left", () => {
    expect(Object.keys(turbo.tasks)).not.toContain("init");
  });
});

describe("creation-time migration generation is awaited", () => {
  const codeOf = (file: string): string =>
    readFileSync(resolve(import.meta.dirname, "..", file), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  const helper = codeOf("helpers/init-vitnode.ts");
  const creator = codeOf("create/create-vitnode.ts");

  /**
   * It was a bare `spawn` with no `await`, no exit-code check and no error
   * handler, called without `await` two lines above
   * `spinner.succeed("Success! Created …")`. So the success message printed while
   * `drizzle-kit` was still running, a non-zero exit was never noticed, and the
   * CLI could exit leaving a detached child writing into a directory the user had
   * been told was finished.
   */
  it("resolves on a zero exit and rejects otherwise", () => {
    expect(helper).toMatch(/async \(\{/);
    expect(helper).toMatch(/Promise<void>/);
    expect(helper).toMatch(/code === 0/);
    expect(helper).toMatch(/reject\(/);
    expect(helper).toMatch(/on\("error"/);
    // Windows package managers are batch files, which `spawn` cannot exec.
    expect(helper).toContain("shell: true");
  });

  it("is awaited by the generator, and a failure is surfaced", () => {
    expect(creator).toMatch(/await generateMigrationsVitnode\(/);
    expect(creator).not.toMatch(/^\s*generateMigrationsVitnode\(/m);

    const call = creator.slice(creator.indexOf("generateMigrationsVitnode({"));

    expect(call).toMatch(/catch/);
    expect(call).toMatch(/process\.exit\(1\)/);
  });

  /**
   * And it is a convenience rather than the contract: it *generates* migrations
   * and never applies them, and it only ever runs on the machine that ran
   * `create-vitnode-app`. Someone who clones the project runs the `dev` script
   * instead, which is why that is where the invariant lives.
   */
  it("generates only, leaving the dev script to apply", () => {
    expect(helper).toContain('"migrate", "--generate"');
    expect(helper).not.toMatch(/"db:prepare"\]/);
  });
});
