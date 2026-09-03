// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The plugin route copier is gone, and this is what keeps it gone.
 *
 * Static and pure: a file listing plus a string search over `scripts/` and
 * `src/`. Nothing here runs the CLI, starts a watcher or touches an app.
 *
 * ## What was deleted
 *
 * Until the Next.js cutover a plugin's `src/routes/` meant two different things
 * at once, because two runtimes read it:
 *
 *     src/routes/main/page.tsx       COPIED into a Next app's src/app/[locale]/(main)/
 *     src/routes/admin/…             copied into the AdminCP
 *     src/routes/blank/…             copied without the site chrome
 *     src/routes/breadcrumb/…        copied into a @breadcrumb parallel-route slot
 *
 *     src/routes.ts                  declared, never copied
 *
 * `scripts/prepare-plugins-files.ts` did the copy once per `vitnode init`,
 * `scripts/plugin.ts` watched and re-copied on every save, and
 * `scripts/shared/file-utils.ts` rewrote each import on the way through so a
 * page's `@/` still resolved after it landed in somebody else's `src/`.
 * `scripts/legacy-route-overlap.ts` warned when a route declaration pointed inside
 * one of those four directories, and
 * `src/framework/plugin-routes/legacy-routes.ts` refused a plugin route whose
 * URL a Next.js page still answered.
 *
 * ## What replaced it, and why a copy may never come back
 *
 * A plugin declares its routes in `src/routes.ts`; the app's Vite build
 * compiles that into a literal registry it imports from the plugin's own `dist`.
 * The page has exactly one home, so there is no copy to go stale, no import to
 * rewrite, and no generated directory in an application that nobody wrote.
 *
 * A test rather than a note in a changelog, because the copier's failure mode
 * was silence: it wrote files into a directory nobody reads, and the wrong copy
 * is the one that ran.
 */
const scriptsRoot = resolve(import.meta.dirname);
const packageRoot = resolve(scriptsRoot, "..");

const SKIP = new Set([".git", "dist", "node_modules"]);

const filesUnder = (directory: string): string[] => {
  if (!existsSync(directory)) return [];

  const walk = (current: string): string[] =>
    readdirSync(current).flatMap(name => {
      if (SKIP.has(name)) return [];

      const path = join(current, name);

      return statSync(path).isDirectory()
        ? walk(path)
        : [relative(packageRoot, path).replaceAll("\\", "/")];
    });

  return walk(directory).sort();
};

/**
 * Source with its comments removed.
 *
 * Every file this suite reads is allowed to *describe* the copier - the
 * explanations above are the most useful thing a reader will find, and several
 * of these modules carry their own. What must not survive is code.
 */
const codeOf = (file: string): string =>
  readFileSync(join(packageRoot, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

const scriptFiles = filesUnder(scriptsRoot).filter(
  file => file.endsWith(".ts") && !file.endsWith(".test.ts"),
);

describe("the plugin route copier", () => {
  it("has no module left in scripts/", () => {
    for (const deleted of [
      "scripts/plugin.ts",
      "scripts/prepare-plugins-files.ts",
      "scripts/legacy-route-overlap.ts",
    ]) {
      expect(existsSync(join(packageRoot, deleted))).toBe(false);
    }
  });

  /**
   * The CLI is the copier's only entry point, so the command table is the thing
   * worth asserting on: `vitnode prepare-plugins` ran it once and
   * `vitnode plugin --w` started its watcher.
   */
  it("has no CLI command", () => {
    const cli = codeOf("scripts/scripts.ts");

    expect(cli).not.toContain("prepare-plugins");
    expect(cli).not.toContain('case "plugin"');
    expect(cli).not.toContain("processPlugin");
    expect(cli).not.toContain("preparePluginsFiles");
  });

  /**
   * `vitnode dev` is the other way in - it started the watcher alongside the
   * three compilers - and `vitnode init` is where a fresh project ran the copy.
   */
  it("is not started by `vitnode dev` or `vitnode init`", () => {
    expect(codeOf("scripts/dev.ts")).not.toContain("processPlugin");
    expect(codeOf("scripts/prepare-database.ts")).not.toContain(
      "preparePluginsFiles",
    );
  });

  /**
   * The copy engine itself. `findRepoRoot` and `findPackagePath` survive in the
   * same file because the `i18n:*` commands locate packages with them, and
   * neither has anything to do with routing.
   */
  it("leaves no file-copying machinery behind", () => {
    const utils = codeOf("scripts/shared/file-utils.ts");

    for (const gone of [
      "copyDirectoryRecursive",
      "cleanupDeletedFiles",
      "transformFileImports",
      "buildInitialRouteMap",
      "findLocaleRoot",
      "SourceConfig",
    ]) {
      expect(utils).not.toContain(gone);
    }

    expect(utils).toContain("findRepoRoot");
    expect(utils).toContain("findPackagePath");
  });

  /**
   * The four directory names are the convention itself. A script that still
   * spells one is a script that still claims a plugin's directory, whatever it
   * intends to do with it.
   */
  it("recognises no legacy route directory", () => {
    const offenders = scriptFiles.filter(file => {
      const code = codeOf(file);

      return [
        '"routes", "main"',
        '"routes", "admin"',
        '"routes", "blank"',
        '"routes", "breadcrumb"',
        "LEGACY_ROUTE_DIRECTORIES",
      ].some(token => code.includes(token));
    });

    expect(offenders).toEqual([]);
  });

  it("copies nothing into an App Router directory", () => {
    const offenders = scriptFiles.filter(file => {
      const code = codeOf(file);

      return (
        code.includes("[locale]") ||
        code.includes("@breadcrumb") ||
        code.includes("(plugins)")
      );
    });

    expect(offenders).toEqual([]);
  });
});

describe("the build-time strangler", () => {
  /**
   * `assertNoLegacyRouteCollision` refused a plugin route that claimed a URL the
   * Next.js application still answered, reading those URLs off core's own
   * `src/routes/admin/**`. Both the guard and the directory it read are gone.
   *
   * Asserted over all of `src/` rather than over the compiler alone, because
   * what would regress is an *allowlist of migrated routes* reappearing
   * somewhere, and the whole point of the route tree deciding is that no such
   * list exists.
   */
  it("keeps no list of routes another application owns", () => {
    expect(
      existsSync(
        join(packageRoot, "src/framework/plugin-routes/legacy-routes.ts"),
      ),
    ).toBe(false);

    const offenders = filesUnder(join(packageRoot, "src"))
      .filter(file => /\.tsx?$/.test(file) && !/\.test(-d)?\.tsx?$/.test(file))
      .filter(file => {
        const code = codeOf(file);

        return (
          code.includes("assertNoLegacyRouteCollision") ||
          code.includes("legacyAdminRoutePathsFromFiles") ||
          code.includes("LegacyRoutePath") ||
          code.includes("legacyRoutes")
        );
      });

    expect(offenders).toEqual([]);
  });

  /**
   * The compiler keeps the check that is not migration-only:
   * `assertNoHostRouteCollision` compares a plugin's routes against the host's
   * own route files, which is a permanent question and the only one left.
   */
  it("still refuses a plugin route that shadows the host's own page", () => {
    const compiler = codeOf("src/framework/plugin-routes/compile.ts");

    expect(compiler).toContain("assertNoHostRouteCollision");
  });
});
