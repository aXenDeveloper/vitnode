import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { packageManagerCommands } from "../helpers/package-manager-commands.js";
import { resolveLocalBin } from "../helpers/resolve-local-bin.js";
import { envExample } from "./create-env-example.js";
import { projectRootScripts } from "./create-package-json.js";
import { renderReadme } from "./create-readme.js";
import { projectLayout } from "./create-vitnode.js";

/**
 * What a generated project is *composed* of, shape by shape.
 *
 * Pure: four builders called as the functions they are, plus the committed
 * README template read off disk. Nothing here runs the generator, installs a
 * package or starts anything - the claims are about which files a shape gets,
 * what is in them, and whether the commands a project is told to run exist.
 *
 * The generator's own composition is where a whole shape can be wrong without
 * anything failing. An `apps/web` directory holding three config files and no
 * `package.json` builds nothing and errors nowhere; a `.env.example` that never
 * gets written is missing rather than broken; a README naming `npm dev` looks
 * exactly like one naming `pnpm dev`.
 */

const templateRoot = resolve(
  import.meta.dirname,
  "../..",
  "copy-of-vitnode-app",
);
const README = readFileSync(join(templateRoot, "README.md"), "utf8");

const MODES = ["singleApp", "apiMonorepo", "onlyApi"] as const;

describe("what a shape is made of", () => {
  /**
   * `apiMonorepo` is a workspace whether or not `--monorepo` was passed - two
   * apps have to live somewhere - and the other two are flat unless asked.
   */
  it.each([
    ["singleApp", false, { hasApi: false, hasWeb: true, workspace: false }],
    ["singleApp", true, { hasApi: false, hasWeb: true, workspace: true }],
    ["onlyApi", false, { hasApi: true, hasWeb: false, workspace: false }],
    ["onlyApi", true, { hasApi: true, hasWeb: false, workspace: true }],
    ["apiMonorepo", false, { hasApi: true, hasWeb: true, workspace: true }],
    ["apiMonorepo", true, { hasApi: true, hasWeb: true, workspace: true }],
  ] as const)("%s with monorepo=%s", (mode, monorepo, expected) => {
    expect(projectLayout({ mode, monorepo })).toEqual(expected);
  });

  /**
   * The regression this replaced: the copy decided what to write by asking
   * `existsSync` about `apps/web`, and an earlier copy had created that
   * directory as a side effect - so an API-only monorepo came out with an
   * `apps/web` holding an `.env.example`, an ESLint config and a Prettier
   * config, and no package. Nothing built it and nothing complained.
   */
  it("gives an API-only project no web app at all", () => {
    expect(projectLayout({ mode: "onlyApi", monorepo: true }).hasWeb).toBe(
      false,
    );
  });
});

describe("the environment each app starts from", () => {
  /**
   * One owner and one file per app. Three roles, because there are three answers
   * to "does this process talk to Postgres" - and the same file cannot serve
   * them, which is why this is composed rather than copied out of a template
   * tree where two copies landed in the same destination.
   */
  it("gives a schema-owning app its database credentials", () => {
    for (const role of ["api", "singleApp"] as const) {
      const env = envExample({ role });

      expect(env).toContain("POSTGRES_URL=");
      expect(env).toContain("REDIS_URL=");
      expect(env).toContain("CRON_SECRET=");
    }
  });

  /**
   * And the frontend of a split deployment none. It talks to the API over HTTP,
   * owns no schema and never migrates - so handing it a `POSTGRES_URL` would be
   * an invitation to make it do so.
   */
  it("gives the split frontend no database credentials", () => {
    const env = envExample({ role: "web" });

    expect(env).not.toContain("POSTGRES_URL");
    expect(env).not.toContain("POSTGRES_PASSWORD");
    expect(env).toContain("NEXT_PUBLIC_API_URL=http://localhost:8000");
  });

  /** A single app serves its own `/api/*`, so both URLs name one origin. */
  it("points a single app at itself", () => {
    const env = envExample({ role: "singleApp" });

    expect(env).toContain("NEXT_PUBLIC_WEB_URL=http://localhost:3000");
    expect(env).toContain("NEXT_PUBLIC_API_URL=http://localhost:3000");
  });

  /** A split API is on 8000, which is the port its `index.ts` listens on. */
  it("points a split deployment's two halves at each other", () => {
    expect(envExample({ role: "api" })).toContain(
      "NEXT_PUBLIC_API_URL=http://localhost:8000",
    );
    expect(envExample({ role: "web" })).toContain(
      "NEXT_PUBLIC_API_URL=http://localhost:8000",
    );
  });

  /** The bundled compose file's credentials, only when there is one. */
  it.each(["api", "singleApp"] as const)(
    "adds the Docker block to %s only when Docker was asked for",
    role => {
      expect(envExample({ docker: true, role })).toContain("POSTGRES_PASSWORD");
      expect(envExample({ docker: false, role })).not.toContain(
        "POSTGRES_PASSWORD",
      );
    },
  );

  /**
   * Nothing left of the framework this replaced. The split frontend's file used
   * to explain how to back "the Next.js caches" with Redis, for caches that no
   * longer exist and a handler nothing loads.
   */
  it.each(["api", "singleApp", "web"] as const)(
    "describes no Next.js runtime to %s",
    role => {
      const env = envExample({ docker: true, role });

      expect(env).not.toMatch(/Next\.js|next-intl|`use cache`/);
    },
  );
});

describe("the commands a project is told to run", () => {
  /**
   * `npm dev` is not a command. Every README was built by replacing the literal
   * string `pnpm` with the chosen package manager, so an npm project opened by
   * telling its reader to run something that exits 1 - and `bun build` would
   * have run bun's bundler rather than the `build` script.
   */
  it.each(["npm", "pnpm", "bun"])("%s runs a script through `run`", pm => {
    expect(packageManagerCommands(pm).run("dev")).toBe(`${pm} run dev`);
    expect(packageManagerCommands(pm).install).toBe(`${pm} i`);
  });

  const render = (
    mode: (typeof MODES)[number],
    packageManager: string,
    { docker = true, monorepo = false } = {},
  ) =>
    renderReadme({
      appName: "app",
      docker,
      mode,
      packageManager,
      scripts: projectRootScripts({
        appName: "app",
        docker,
        eslint: true,
        mode,
        monorepo,
        packageManager,
      }),
      template: README,
      workspace: monorepo || mode === "apiMonorepo",
    });

  it("leaves no placeholder unfilled", () => {
    for (const mode of MODES) {
      for (const packageManager of ["npm", "pnpm", "bun"]) {
        for (const docker of [true, false]) {
          expect(render(mode, packageManager, { docker })).not.toMatch(
            /\{\{[A-Z_]+\}\}/,
          );
        }
      }
    }
  });

  /**
   * And every command in it is one the project actually has. The table used to
   * be fixed text, so an API on bun - which compiles nothing and therefore has
   * no `build` script - was told to run one.
   */
  it("documents only scripts the project has", () => {
    for (const mode of MODES) {
      for (const packageManager of ["npm", "pnpm", "bun"]) {
        for (const monorepo of [false, true]) {
          const scripts = projectRootScripts({
            appName: "app",
            docker: false,
            eslint: true,
            mode,
            monorepo,
            packageManager,
          });
          const readme = render(mode, packageManager, {
            docker: false,
            monorepo,
          });

          for (const [, command] of readme.matchAll(
            /^\| `[a-z]+ run ([^`]+)` \|/gm,
          )) {
            expect(Object.keys(scripts), `${mode}/${packageManager}`).toContain(
              command,
            );
          }
        }
      }
    }
  });

  /** The first-start sequence: install, `.env`, database, `dev`. */
  it("tells a reader to copy the `.env.example` of every app it generated", () => {
    expect(render("singleApp", "pnpm")).toContain("cp .env.example .env");
    expect(render("apiMonorepo", "pnpm")).toContain(
      "cp apps/api/.env.example apps/api/.env",
    );
    expect(render("apiMonorepo", "pnpm")).toContain(
      "cp apps/web/.env.example apps/web/.env",
    );
    // The API-only workspace has no web app, so it is not told to copy one.
    expect(render("onlyApi", "pnpm", { monorepo: true })).not.toContain(
      "apps/web",
    );
  });

  /**
   * And it says the database is prepared for it - the one thing a first-time
   * reader most needs to be able to rely on, and the one that is invisible if
   * nobody writes it down.
   */
  it("says the first start migrates the database", () => {
    const readme = render("singleApp", "pnpm");

    expect(readme).toContain("vitnode db:prepare");
    expect(readme).toContain("pnpm run dev");
    expect(readme).toMatch(/idempotent/);
  });

  it("mentions Docker only when the project has it", () => {
    expect(render("singleApp", "pnpm", { docker: true })).toContain(
      "pnpm run docker:dev",
    );
    expect(render("singleApp", "pnpm", { docker: false })).not.toContain(
      "docker:dev",
    );
  });
});

describe("finding the command a package manager just installed", () => {
  /**
   * pnpm links a bin beside the app; npm and bun hoist it to the workspace root.
   * Both have to be found, because the alternative - asking the package manager
   * to run it - is what only two of the three can do.
   */
  it.each([
    ["beside the app", "/repo/apps/api/node_modules/.bin/vitnode"],
    ["hoisted to the root", "/repo/node_modules/.bin/vitnode"],
  ])("finds a binary %s", (_label, found) => {
    expect(
      resolveLocalBin("vitnode", "/repo/apps/api", {
        exists: candidate => candidate === found,
        win32: false,
      }),
    ).toBe(found);
  });

  it("stops at the filesystem root rather than looping", () => {
    expect(
      resolveLocalBin("vitnode", "/repo/apps/api", {
        exists: () => false,
        win32: false,
      }),
    ).toBeNull();
  });

  it("looks for the batch file on Windows", () => {
    const found = "/repo/node_modules/.bin/vitnode.cmd";

    expect(
      resolveLocalBin("vitnode", "/repo", {
        exists: candidate => candidate === found,
        win32: true,
      }),
    ).toBe(found);
  });
});
