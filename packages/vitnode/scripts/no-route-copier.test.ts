// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

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

  it("still refuses a plugin route that shadows the host's own page", () => {
    const compiler = codeOf("src/framework/plugin-routes/compile.ts");

    expect(compiler).toContain("assertNoHostRouteCollision");
  });
});
