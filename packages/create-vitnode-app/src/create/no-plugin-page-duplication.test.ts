import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  pluginRouteScaffold,
  routeSlugFor,
} from "../plugin/create/route-templates.js";

const packageRoot = resolve(import.meta.dirname, "../..");
const appTemplate = join(packageRoot, "copy-of-vitnode-app");
const appRoutesDir = join(appTemplate, "root", "src", "routes");

/** Every file under a directory, relative to it, in a deterministic order. */
const filesUnder = (directory: string): string[] => {
  if (!existsSync(directory)) return [];

  const walk = (current: string): string[] =>
    readdirSync(current)
      .sort()
      .flatMap(name => {
        const path = join(current, name);

        return statSync(path).isDirectory()
          ? walk(path)
          : [relative(directory, path).replaceAll("\\", "/")];
      });

  return walk(directory);
};

const appRouteFiles = filesUnder(appRoutesDir);

const routeTokens = new Set(
  appRouteFiles.flatMap(file =>
    file
      .replace(/\.[cm]?[jt]sx?$/, "")
      .split(/[/.]/)
      .filter(Boolean),
  ),
);

const readTemplate = (...parts: string[]): string =>
  readFileSync(join(appTemplate, ...parts), "utf8");

/** Source with its comments removed - prose may name what code may not do. */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/** The name the CLI offers by default, and the one most projects will accept. */
const DEFAULT_PLUGIN_NAME = "my-vitnode-plugin";

describe("the scaffolded plugin", () => {
  const scaffold = pluginRouteScaffold(DEFAULT_PLUGIN_NAME);
  const slug = routeSlugFor(DEFAULT_PLUGIN_NAME);
  const routes = scaffold["src/routes.ts"];

  it("declares one route, in its own route tree", () => {
    expect(routes).toBeDefined();
    expect(routes).toContain(`page("/${slug}", {`);
    expect(routes.match(/^ {2}page\("/gm)).toHaveLength(1);
    expect(routes).toContain('lazy(() => import("./pages/home-page"))');
    expect(Object.keys(scaffold)).toContain("src/pages/home-page.tsx");
  });

  it("writes only files inside the plugin package", () => {
    for (const file of Object.keys(scaffold)) {
      expect(file).toMatch(/^src\//);
      expect(file).not.toContain("..");
      expect(file).not.toMatch(/^\/|^[A-Za-z]:/);
    }
  });

  it.each(["admin", "blank", "breadcrumb", "main"])(
    "scaffolds no routes/%s directory",
    legacy => {
      expect(
        Object.keys(scaffold).filter(file =>
          file.startsWith(`src/routes/${legacy}/`),
        ),
      ).toEqual([]);
    },
  );

  /** And no flat route manifest, which is the API this replaced. */
  it("scaffolds no routes/manifest.ts", () => {
    expect(Object.keys(scaffold)).not.toContain("src/routes/manifest.ts");
    expect(routes).not.toContain("entry:");
  });

  /**
   * The page is framework-neutral, which is what lets it stay in the plugin.
   *
   * A `createFileRoute` in a scaffolded page would only work once the file were
   * inside an app's routes directory - so its absence is not a style preference,
   * it is the reason the module can live in a published package and be imported
   * by whichever app installed it.
   */
  it("scaffolds a plain component, not a framework route file", () => {
    const page = scaffold["src/pages/home-page.tsx"];

    expect(page).toContain("export default");
    expect(page).not.toContain("createFileRoute");
    expect(page).not.toMatch(/export\s+const\s+Route\b/);
    expect(page).not.toContain("@tanstack/react-router");
  });
});

describe("the plugin scaffold's writer", () => {
  const writer = withoutComments(
    readFileSync(
      join(packageRoot, "src/plugin/create/create-plugin-vitnode.ts"),
      "utf8",
    ),
  );

  /**
   * Every path this module builds is anchored on the plugin, a template, or the
   * repository root it walks up to.
   *
   * Asserted over the anchors rather than over each call, because that is the
   * whole of what decides *where* a generator can reach: a `join(appRoot, …)`
   * appearing here is how a plugin generator would come to own a host route
   * file, and it would be one line.
   *
   * The workspace root is a legitimate anchor and stays: creating a plugin adds
   * it to `pnpm-workspace.yaml` so the app can resolve it. That is a
   * registration, not a page.
   */
  it("anchors every path on the plugin, a template or the repository root", () => {
    const anchors = [
      ...new Set(
        [...writer.matchAll(/\bjoin\(\s*([A-Za-z_$][\w$]*)/g)].map(
          match => match[1],
        ),
      ),
    ].sort();

    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors).toEqual(["__dirname", "currentDir", "pluginPath"]);
  });

  /**
   * And it knows nothing about an application. A plugin generator that named an
   * app's directory, its routes or its generated files has stopped being a
   * plugin generator.
   */
  it.each([
    ["an app directory", /["'`][^"'`]*apps\//],
    ["a host routes directory", /src\/routes/],
    ["a generated registry", /\.gen\.ts/],
    ["the file route tree", /routeTree/],
  ])("names no %s", (_label, forbidden) => {
    expect(writer).not.toMatch(forbidden);
  });
});

describe("the generated application", () => {
  /**
   * Guards the guard: the assertions below are absences over this listing.
   */
  it("ships a populated routes directory", () => {
    // A floor, not a count. Twenty-nine files left `src/routes/` when core's own
    // screens became code-based routes - the AdminCP's sixteen, the public nine
    // and the four shell-less auth ones. What a new project starts with is its
    // shells, its front page, and the one file `_admin` keeps in order to exist.
    expect(appRouteFiles.length).toBeGreaterThan(3);
    expect(routeTokens.size).toBeGreaterThan(4);
  });

  it.each(["__root.tsx", "_main.tsx", "_main/index.tsx", "_admin.tsx"])(
    "owns %s itself",
    file => {
      expect(appRouteFiles).toContain(file);
    },
  );

  it.each([
    "_main/discover.tsx",
    "_main/search.tsx",
    "_main/_authenticated.tsx",
    "_main/_authenticated/files.tsx",
    "_main/_authenticated/settings.tsx",
    "login.tsx",
    "login_.reset-password.tsx",
    "login_.sso.$providerId.tsx",
    "register.tsx",
    "admin.index.tsx",
  ])("ships no route file for core's own %s", file => {
    expect(appRouteFiles).not.toContain(file);
  });

  /**
   * All three mounts, because a project that had one and not the others would be
   * missing whole sections of VitNode with nothing to say so.
   */
  it.each(["withCoreMainRoutes", "withCoreAdminRoutes", "withCoreRootRoutes"])(
    "mounts core's own screens through %s instead",
    mount => {
      expect(withoutComments(readTemplate("root/src/router.tsx"))).toContain(
        mount,
      );
    },
  );

  it("ships no route file for the default scaffolded plugin's URL", () => {
    expect(routeTokens.has(routeSlugFor(DEFAULT_PLUGIN_NAME))).toBe(false);
    expect(routeTokens.has("example")).toBe(false);
  });

  it("configures no plugin and commits no generated registry", () => {
    expect(withoutComments(readTemplate("root/src/vitnode.config.ts"))).toMatch(
      /plugins:\s*\[\s*\]/,
    );
    expect(
      filesUnder(join(appTemplate, "root", "src")).filter(file =>
        file.includes(".gen."),
      ),
    ).toEqual([]);
  });

  it("mounts plugin routes from the generated registry", () => {
    const router = withoutComments(readTemplate("root/src/router.tsx"));

    expect(router).toContain("withPluginRoutes");
    expect(router).toContain("pluginRouteSpecs");
    expect(router).toContain("./plugin-routes.gen");
    expect(router).not.toContain("./plugin-route-manifest.gen");
    // Both shells, so a plugin declaring either area is composed rather than
    // refused - and an admin plugin page needs no `_admin` file of its own.
    expect(router).toMatch(/mountUnder:\s*\{[^}]*\badmin:/);
    expect(router).toMatch(/mountUnder:\s*\{[^}]*\bmain:/);
  });

  it("ships one AdminCP route file, the shell's anchor, and no screen beside it", () => {
    expect(appRouteFiles.filter(file => file.startsWith("_admin/"))).toEqual([
      "_admin/admin.core.index.tsx",
    ]);
  });

  it("still ships the AdminCP shell and its mount", () => {
    expect(appRouteFiles).toContain("_admin.tsx");
    expect(withoutComments(readTemplate("root/src/router.tsx"))).toContain(
      "withCoreAdminRoutes",
    );
  });

  it("imports no package other than core and the router from a route file", () => {
    const offenders = appRouteFiles
      .filter(file => /\.[cm]?[jt]sx?$/.test(file))
      .flatMap(file => {
        const code = readFileSync(join(appRoutesDir, file), "utf8");

        return [...code.matchAll(/from\s+['"]([^'".#/][^'"]*)['"]/g)]
          .map(match => match[1])
          .filter(
            specifier =>
              !specifier.startsWith("@vitnode/core") &&
              !specifier.startsWith("@tanstack/") &&
              !specifier.startsWith("node:") &&
              !["react", "use-intl", "zod"].includes(specifier),
          )
          .map(specifier => `${file} imports ${specifier}`);
      });

    expect(offenders).toEqual([]);
  });

  it("holds no generated file under the routes directory", () => {
    expect(appRouteFiles.filter(file => file.includes(".gen."))).toEqual([]);
  });
});
