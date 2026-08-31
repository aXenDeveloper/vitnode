import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  pluginRouteScaffold,
  routeSlugFor,
} from "../plugin/create/route-templates.js";

/**
 * A generated project demonstrates the permanent architecture, not the
 * migration-era one.
 *
 * Static and pure: the committed template tree is read off disk and the two
 * generators are called as the functions they are. Nothing here spawns the CLI,
 * installs a package or runs a build.
 *
 * ## What the two halves of the scaffold may contain
 *
 *     create-vitnode-app                 create-vitnode-app --plugin
 *     ──────────────────────             ──────────────────────────
 *     apps/web/src/routes/**             plugins/<name>/src/routes/manifest.ts
 *       the application's own pages        the routes this plugin contributes
 *     apps/web/src/router.tsx            plugins/<name>/src/routes/*.tsx
 *       withPluginRoutes(...)              the pages themselves
 *     apps/web/src/vitnode.config.ts     plugins/<name>/src/config.tsx
 *       plugins: []
 *
 * The line between them is the whole subject of this file. A plugin author writes
 * a route module and declares it in their manifest; the app's Vite build compiles
 * that into two generated registries and `withPluginRoutes` mounts them. There is
 * no third step in which the page becomes a file in the application, and a
 * scaffold that produced one would be teaching the deleted architecture to every
 * project created from it.
 *
 * ## Why the scaffold in particular
 *
 * Nothing in this repository imports the template tree, so no type error and no
 * failing build says a word about what is in it. `scaffold-invariants.test.ts`
 * beside this one pins the *framework* claims - no App Router topology, no Next
 * config, no `next` import. This one pins the *ownership* claim, which is the one
 * that survived the framework change: a host physical page for a plugin's URL is
 * the same mistake in TanStack that it was in Next.js, and a generator is where
 * it would be reintroduced at scale.
 */

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

/**
 * Every token a route file's path contributes, which is where a file-based
 * router keeps a URL.
 *
 * `_main/settings/devices.tsx` is `["_main", "settings", "devices"]`. Splitting
 * on both separators is what makes the check indifferent to which spelling a
 * route file uses - `_main/example.tsx` and `_main.example.tsx` are the same URL
 * and produce the same token.
 */
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
  const manifest = scaffold["src/routes/manifest.ts"];

  it("declares one route, in its own manifest", () => {
    expect(manifest).toBeDefined();
    expect(manifest).toContain(`path: "/${slug}"`);
    expect(manifest.match(/path: "/g)).toHaveLength(1);
    expect(manifest).toContain('entry: "routes/home-page"');
    expect(Object.keys(scaffold)).toContain("src/routes/home-page.tsx");
  });

  /**
   * And writes nothing outside itself.
   *
   * Every path the scaffold names is relative to the plugin, so there is no
   * key here that *could* land in an application even if the writer were
   * pointed at a repository root - which is the property worth having, because
   * the writer resolves them against `pluginPath` and a path escaping that is
   * how a generator quietly acquires the ability to touch `apps/`.
   */
  it("writes only files inside the plugin package", () => {
    for (const file of Object.keys(scaffold)) {
      expect(file).toMatch(/^src\//);
      expect(file).not.toContain("..");
      expect(file).not.toMatch(/^\/|^[A-Za-z]:/);
    }
  });

  /**
   * The four directory names a plugin's pages used to be copied out of. The
   * scaffold offers none of them, so a new plugin cannot start out shaped like
   * something that wants copying.
   */
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

  /**
   * The page is framework-neutral, which is what lets it stay in the plugin.
   *
   * A `createFileRoute` in a scaffolded page would only work once the file were
   * inside an app's routes directory - so its absence is not a style preference,
   * it is the reason the module can live in a published package and be imported
   * by whichever app installed it.
   */
  it("scaffolds a plain component, not a framework route file", () => {
    const page = scaffold["src/routes/home-page.tsx"];

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
    expect(appRouteFiles.length).toBeGreaterThan(20);
    expect(routeTokens.size).toBeGreaterThan(10);
  });

  /**
   * D. The starter's own pages are still there.
   *
   * Listed as files rather than as URLs because this template is read without a
   * router: what matters is that the check below cannot be satisfied by deleting
   * the routes directory, and a named-file assertion says that most directly.
   */
  it.each([
    "__root.tsx",
    "_main.tsx",
    "_main/index.tsx",
    "_main/discover.tsx",
    "_main/search.tsx",
    "_main/_authenticated/files.tsx",
    "_main/_authenticated/settings.tsx",
    "_admin.tsx",
    "admin.index.tsx",
    "login.tsx",
    "register.tsx",
  ])("owns %s itself", file => {
    expect(appRouteFiles).toContain(file);
  });

  /**
   * C. No host physical page for the plugin a new project is most likely to
   * create.
   *
   * A file-based router keeps the URL in the name, so a host route answering
   * `/my-vitnode-plugin` has to carry that token somewhere in its path - as a
   * directory, or as a dot-separated filename segment. Absence of the token is
   * therefore sufficient to say no such file exists, without this test having to
   * reimplement a route-path reader it would then have to keep in step with one.
   */
  it("ships no route file for the default scaffolded plugin's URL", () => {
    expect(routeTokens.has(routeSlugFor(DEFAULT_PLUGIN_NAME))).toBe(false);
    expect(routeTokens.has("example")).toBe(false);
  });

  /**
   * And it cannot contain a duplicate at all, because it installs no plugin.
   *
   * The strongest form of the claim about *generated output*: `plugins: []` and
   * no committed registry means a fresh project has zero plugin routes, so there
   * is nothing for a host page to be a second copy of. The wiring is present and
   * empty rather than absent - which is the difference between a project that is
   * ready for a plugin and one that would need this file rewritten to accept one.
   */
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

  /**
   * The positive half, and the reason none of the above is a limitation: the
   * starter already mounts whatever a plugin declares.
   *
   * A plugin author adds their package to `plugins` and their route to their own
   * manifest, and the page is served. No file in `src/routes` is created, edited
   * or copied - which is exactly what the authoring guide promises, said here as
   * a property of the bytes a new project starts from.
   */
  it("mounts plugin routes from the generated registries", () => {
    const router = withoutComments(readTemplate("root/src/router.tsx"));

    expect(router).toContain("withPluginRoutes");
    expect(router).toContain("pluginRouteSpecs");
    expect(router).toContain("./plugin-route-manifest.gen");
    expect(router).toContain("./plugin-routes.gen");
    // Both shells, so a plugin declaring either area is composed rather than
    // refused - and an admin plugin page needs no `_admin` file of its own.
    expect(router).toMatch(/mountUnder:\s*\{[^}]*\badmin:/);
    expect(router).toMatch(/mountUnder:\s*\{[^}]*\bmain:/);
  });

  /**
   * E. The AdminCP half, stated on its own.
   *
   * Every `_admin` route file the starter ships is one of core's own screens -
   * the staff, users, system and advanced sections, plus the Content Engine
   * splat. A plugin's AdminCP page is not among them and must not be: `area:
   * "admin"` picks the shell, and the shell is composed around a route the
   * registry provides.
   */
  it("ships no AdminCP route file beyond core's own screens", () => {
    const adminFiles = appRouteFiles.filter(file => file.startsWith("_admin/"));

    expect(adminFiles.length).toBeGreaterThan(5);
    for (const file of adminFiles) {
      expect(file).toMatch(/^_admin\/admin\.(core|content)\./);
    }
  });

  /**
   * A proxy is still a copy.
   *
   * A route file re-exporting a plugin's page would claim no duplicate URL - it
   * *is* the URL - and would still be a host file that has to be written and
   * kept in step for a plugin's page to exist. No route file in a starter has
   * any reason to import from outside the app and core.
   */
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
