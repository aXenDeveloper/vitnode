import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  apiScripts,
  rootScripts,
  singleAppScripts,
  webScripts,
} from "./create-package-json.js";

/**
 * A generated project migrates its own database on `dev`, and only the package
 * that owns a schema does it.
 *
 * Static and pure: the four script builders are called as the functions they
 * are, and the committed `turbo.json` template is read off disk. Nothing here
 * spawns a package manager, starts a dev server or touches Postgres.
 *
 * ## The regression
 *
 * Before Stage 17 the shapes that own a database had a bootstrap in their `dev`
 * script:
 *
 *     api          vitnode init --api && tsx watch src/index.ts
 *     single app   vitnode init && next dev
 *     web-only     vitnode init --web && next dev      (a no-op flag)
 *
 * `vitnode init` prepared the database *and* copied every installed plugin's
 * pages into the host's `src/app/[locale]/…` for Next.js to find. Stage 17
 * deleted the copier and deleted `init` with it - and the single app lost its
 * database bootstrap in the process, because the reasoning at the time only
 * examined the plugin half. `apiScripts` kept its gate by luck: the line was
 * left alone because it did not mention `next`.
 *
 * So a developer who cloned a generated project, installed and started a fresh
 * Postgres got Vite serving pages against an empty database, and the first
 * symptom was an arbitrary SQL error from a route rather than anything about
 * migrations.
 *
 * ## What is asserted
 *
 * Not "the string contains `db:prepare`" - that would pass for
 * `vite dev & vitnode db:prepare`, which is the race this is supposed to
 * prevent. The bootstrap has to come *before* the runtime in the command, joined
 * by `&&` so a non-zero exit stops the chain. Both are checked by position.
 */

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

/**
 * Whether a `dev` script prepares the database before starting anything.
 *
 * The `&&` is load bearing and so is the order: `A && B` runs B only if A
 * exited zero, and nothing in a generated project may reach a schema that
 * failed to migrate.
 */
const gatesOnBootstrap = (dev: string): boolean => {
  const match = BOOTSTRAP.exec(dev.trim());

  if (match?.groups === undefined) return false;

  return (
    RUNTIME.test(match.groups.runtime) &&
    !RUNTIME.test(match.groups.gate) &&
    dev.indexOf("db:prepare") < (RUNTIME.exec(dev)?.index ?? -1)
  );
};

/**
 * Every shape the generator supports whose `dev` must gate on the bootstrap.
 *
 * The split-deployment web app is deliberately absent - it mounts no API and
 * owns no schema. Its own describe block below pins that it stays that way.
 */
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

  /**
   * Never concurrently. `&` in a shell backgrounds the left side, which is
   * exactly the race this exists to prevent: migrations running while the first
   * requests are already being served against the old schema.
   */
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
  /**
   * The gap this replaced: gating only at the root left `cd apps/web && pnpm dev`
   * and `turbo dev --filter=web` starting a runtime against an unmigrated
   * schema, because neither goes through the root script. An app that reads a
   * schema is responsible for having one.
   *
   * Gating twice on the common path is safe *because* of the advisory lock in
   * `withMigrationLock` - measured: without it, two concurrent gates race on
   * `CREATE SCHEMA IF NOT EXISTS drizzle` and one exits non-zero.
   */
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

  /**
   * The rule this file exists to keep on the right side of the boundary. A
   * TanStack frontend that talks to a separate API over HTTP has no schema, no
   * migrations directory and no database credentials - so it must not migrate,
   * and the way to guarantee that is for it to have no script that could.
   */
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

  /**
   * Its own generated artefacts - the plugin route manifest, the module
   * registry, the AdminCP navigation and content projections - are written by
   * the Vite plugin on every `vite dev`, so there is nothing for a pre-step to
   * prepare here either.
   */
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
