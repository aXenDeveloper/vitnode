import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * What a generated project may not contain.
 *
 * Static and pure: the committed template tree is read off disk and the
 * package.json builders are called as the functions they are. Nothing here
 * spawns the CLI, installs anything or runs a build - the claim being pinned is
 * that the *bytes a new project starts from* describe VitNode's permanent
 * architecture, and that is a file listing and a string comparison.
 *
 * It exists because the scaffold is the one place a deleted architecture can
 * come back to life. Nothing in this repository imports the template tree, so no
 * type error and no failing build says a word about it: a `next.config.ts` or an
 * `@breadcrumb` directory sitting in `copy-of-vitnode-app/` is invisible until
 * somebody runs `create-vitnode-app` and is handed an application that cannot
 * start.
 */
const packageRoot = resolve(import.meta.dirname, "../..");
const appTemplate = join(packageRoot, "copy-of-vitnode-app");
const pluginTemplate = join(packageRoot, "copy-of-vitnode-plugin");

const SKIP = new Set([".git", "dist", "node_modules"]);

/** Every file in a template, as paths relative to the template root. */
const filesUnder = (directory: string): string[] => {
  if (!existsSync(directory)) return [];

  const walk = (current: string): string[] =>
    readdirSync(current).flatMap(name => {
      if (SKIP.has(name)) return [];

      const path = join(current, name);

      return statSync(path).isDirectory()
        ? walk(path)
        : [relative(directory, path).replaceAll("\\", "/")];
    });

  return walk(directory).sort();
};

const appFiles = filesUnder(appTemplate);
const pluginFiles = filesUnder(pluginTemplate);
const allFiles = [...appFiles, ...pluginFiles];

const read = (root: string, file: string): string =>
  readFileSync(join(root, file), "utf8");

/**
 * Source with its comments removed.
 *
 * Prose is allowed to name what was deleted - a comment saying why
 * `prepare-plugins` no longer exists is the most useful thing a reader of this
 * package can find. What must not survive is a *call*, so the check is made
 * against code alone.
 */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("the generated application", () => {
  /**
   * The four directory names the route copier claimed, and the parallel-route
   * slot it wrote into.
   *
   * Asserted against the whole template tree rather than against one expected
   * location, because the failure this guards against is a *reappearance* and a
   * reappearance picks its own path.
   */
  it("ships no Next.js App Router topology", () => {
    expect(allFiles.filter(file => file.includes("[locale]"))).toEqual([]);
    expect(allFiles.filter(file => file.includes("@breadcrumb"))).toEqual([]);
    expect(allFiles.filter(file => /(^|\/)src\/app(\/|$)/.test(file))).toEqual(
      [],
    );
  });

  it("ships no Next.js configuration", () => {
    expect(
      allFiles.filter(file => /(^|\/)next\.config\.[cm]?[jt]s$/.test(file)),
    ).toEqual([]);
    // The Proxy is Next-only middleware, and `next-env.d.ts` is written by a
    // Next build - both were committed template files.
    expect(allFiles.filter(file => file.endsWith("src/proxy.ts"))).toEqual([]);
    expect(allFiles.filter(file => file.endsWith("next-env.d.ts"))).toEqual([]);
  });

  /**
   * Not a grep for the word "next" - prose may mention the framework this
   * architecture replaced. What must not exist is an *import* or a module
   * augmentation, which is what actually makes a generated project depend on it.
   *
   * `next-intl` is the one that hides: `declare module "next-intl"` in a
   * `global.d.ts` is a type-level dependency that survives any search for
   * `import ... from`.
   */
  it("imports nothing from next or next-intl", () => {
    const offenders = [
      ...appFiles.map(file => [appTemplate, file] as const),
      ...pluginFiles.map(file => [pluginTemplate, file] as const),
    ]
      .filter(([, file]) => /\.[cm]?[jt]sx?$/.test(file))
      .filter(([root, file]) =>
        /(?:from|import)\s*\(?\s*['"]next(?:-intl)?(?:\/[^'"]*)?['"]|declare\s+module\s+['"]next(?:-intl)?['"]|reference\s+types="next/.test(
          read(root, file),
        ),
      )
      .map(([, file]) => file);

    expect(offenders).toEqual([]);
  });

  it("is a TanStack Start application", () => {
    expect(appFiles).toContain("root/vite.config.ts");
    expect(appFiles).toContain("root/tsr.config.json");
    expect(appFiles).toContain("root/src/router.tsx");
    expect(appFiles).toContain("root/src/start.ts");
    expect(appFiles).toContain("root/src/routes/__root.tsx");
  });

  /**
   * The single-app shape mounts the Hono API as a TanStack server route.
   *
   * It was a Next Route Handler at `src/app/api/[...route]/route.ts`, which the
   * first assertion in this file would already have caught - this one says what
   * has to be there *instead*, so a deletion that removed the mount entirely
   * fails too.
   */
  it("mounts the API through a server route, not a Route Handler", () => {
    expect(appFiles).toContain("api-single-app/src/routes/api/$.ts");
    expect(read(appTemplate, "api-single-app/src/routes/api/$.ts")).toContain(
      "createFileRoute('/api/$')",
    );
  });
});

describe("the generated plugin", () => {
  /**
   * A plugin declares its routes; it does not ship a directory of pages for
   * something else to copy.
   */
  it("scaffolds a route manifest rather than route directories", async () => {
    const { pluginRouteScaffold } =
      await import("../plugin/create/route-templates.js");
    const scaffold = pluginRouteScaffold("@acme/blog");

    expect(Object.keys(scaffold)).toContain("src/routes/manifest.ts");
    expect(scaffold["src/routes/manifest.ts"]).toContain(
      "PluginRouteDefinition",
    );

    for (const legacy of ["main", "admin", "blank", "breadcrumb"]) {
      expect(Object.keys(scaffold)).not.toContain(
        `src/routes/${legacy}/page.tsx`,
      );
    }
  });

  it("declares no framework dependency of its own", async () => {
    const { versionsPackageJson } = await import("./package-versions.js");

    // The version table is what a generated package.json is built from, so a
    // framework that is not in it cannot be depended on by accident.
    expect(Object.keys(versionsPackageJson)).not.toContain("nextSingle");
    expect(Object.keys(versionsPackageJson)).not.toContain("nextIntl");
    expect(versionsPackageJson.useIntl).toBeTruthy();
  });
});

describe("the generator's own wiring", () => {
  /**
   * `vitnode prepare-plugins` and `vitnode plugin --w` were the route copier's
   * two entry points, and the generator ran the first one in every app it
   * created. Both commands are gone from the CLI, so invoking one now prints
   * "Command not found" and exits 1 - a generated project that still called it
   * would fail on its first `dev`.
   */
  it("runs no route copier command after creating a project", () => {
    const offenders = filesUnder(join(packageRoot, "src"))
      .filter(file => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .filter(file => {
        const code = withoutComments(read(join(packageRoot, "src"), file));

        return (
          code.includes("prepare-plugins") || code.includes("initFilesVitnode")
        );
      });

    expect(offenders).toEqual([]);
  });
});
