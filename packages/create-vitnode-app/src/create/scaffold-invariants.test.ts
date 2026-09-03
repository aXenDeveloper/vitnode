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

describe("the single-app template's two trees", () => {
  /**
   * `root` owns every generic host file; `api-single-app` is an overlay of
   * API-specific additions and nothing else.
   *
   * ## The regression
   *
   * Both trees are copied into the *same* directory, and they were copied with
   * one `Promise.all` - so any path they shared was a race, decided by whichever
   * `cp` happened to finish last. They shared two, and both of the overlay's
   * copies were the pre-TanStack ones:
   *
   *     .gitignore_template   ignored `/.next/` and `next-env.d.ts`; had no
   *                           `.output`, `.nitro`, `.vite` or `src/*.gen.ts`
   *     .env.example          no `NEXT_PUBLIC_API_URL`, no `CRON_SECRET`
   *
   * So a new project got a `.gitignore` for a framework it does not use, missing
   * every output directory it actually writes - about half the time. Nothing
   * fails; the first symptom is `.output/` showing up in `git status`.
   *
   * Both duplicates are deleted rather than corrected, because a corrected
   * duplicate is still two files that have to agree.
   */
  const overlayFiles = filesUnder(join(appTemplate, "api-single-app"));
  const rootFiles = filesUnder(join(appTemplate, "root"));

  it("share no path at all", () => {
    expect(overlayFiles.filter(file => rootFiles.includes(file))).toEqual([]);
  });

  /**
   * And the overlay is only the API. Listed as a property rather than as an
   * expected file list, so adding a genuinely API-specific file needs no edit
   * here - `drizzle.config.ts` and anything under `src/` that names the API.
   */
  it("keeps only API-specific files in the overlay", () => {
    expect(overlayFiles.length).toBeGreaterThan(0);
    for (const file of overlayFiles) {
      expect(file).toMatch(
        /^(?:drizzle\.config\.ts|src\/(?:routes\/api\/|server\/|vitnode\.api\.config\.ts))/,
      );
    }
  });

  /** No generic host file, by name - the two that were actually there. */
  it.each([".gitignore_template", ".env.example", "global.d.ts"])(
    "does not duplicate %s",
    file => {
      expect(existsSync(join(appTemplate, "api-single-app", file))).toBe(false);
      expect(existsSync(join(appTemplate, "root", file))).toBe(true);
    },
  );

  /**
   * Copied in a fixed order regardless, because "the overlay goes over the base"
   * is the contract an author adding a file to either tree relies on - and
   * `Promise.all` into one destination cannot express an order at all.
   */
  it("is copied base-then-overlay, sequentially", () => {
    const code = withoutComments(
      read(join(packageRoot, "src"), "create/create-vitnode.ts"),
    );
    const singleApp = code.slice(
      code.indexOf('if (mode === "singleApp")'),
      code.indexOf('} else if (mode === "apiMonorepo")'),
    );

    expect(singleApp).toContain('await cp(join(templatePath, "root")');
    expect(singleApp).toContain(
      'await cp(join(templatePath, "api-single-app")',
    );
    expect(singleApp.indexOf('"root"')).toBeLessThan(
      singleApp.indexOf('"api-single-app"'),
    );
    // The race itself: two trees into one directory, concurrently.
    expect(singleApp).not.toContain("Promise.all");
  });
});

describe("what a generated single app starts from", () => {
  const gitignore = read(appTemplate, "root/.gitignore_template");
  const env = read(appTemplate, "root/.env.example");

  /** The directories a TanStack Start build actually writes. */
  it.each(["/.output/", "/.nitro/", "/.vite/", "/.tanstack/", "src/*.gen.ts"])(
    "ignores %s",
    entry => {
      expect(gitignore).toContain(entry);
    },
  );

  /**
   * And nothing from the framework this replaced. A fresh scaffold has no
   * migration to explain, so these do not belong even as a comment.
   */
  it.each([".next", "next-env.d.ts", ".contentlayer", ".content-collections"])(
    "does not mention %s",
    entry => {
      expect(gitignore).not.toContain(entry);
    },
  );

  /**
   * The environment a single app is configured with. Both URLs name this app's
   * own origin, because it serves its own `/api/*` - which is exactly what the
   * overlay's copy dropped.
   */
  it("ships the single-app environment", () => {
    expect(env).toContain("POSTGRES_URL=");
    expect(env).toContain("NEXT_PUBLIC_WEB_URL=http://localhost:3000");
    expect(env).toContain("NEXT_PUBLIC_API_URL=http://localhost:3000");
    expect(env).toContain("CRON_SECRET=");
  });

  /**
   * One locale declaration, read by both configs.
   *
   * `vitnode db:prepare` seeds `core_languages` from the *API* config, and a
   * single app owns its schema - so a language added to `src/i18n.ts` has to
   * reach the seed without a second edit. It does, because there is only one
   * list.
   */
  it("declares its languages once and reads them from both configs", () => {
    expect(appFiles).toContain("root/src/i18n.ts");
    expect(appFiles).not.toContain("api-single-app/src/i18n.ts");

    for (const file of [
      "root/src/vitnode.shell.config.ts",
      "api-single-app/src/vitnode.api.config.ts",
    ]) {
      expect(withoutComments(read(appTemplate, file))).toMatch(
        /import \{ i18n \} from ['"]\.\/i18n['"]/,
      );
    }
  });

  /**
   * The split shape has the same obligation, one file each: two packages, so
   * neither can import the other's, and the API's is the one the seed reads.
   */
  it("gives a split deployment an API locale declaration of its own", () => {
    expect(appFiles).toContain("api/src/i18n.ts");
    // `.js` here: the split API compiles with `moduleResolution: nodenext`.
    expect(
      withoutComments(read(appTemplate, "api/src/vitnode.api.config.ts")),
    ).toMatch(/import \{ i18n \} from ['"]\.\/i18n\.js['"]/);
  });
});

describe("what a generated application shows during a slow navigation", () => {
  const router = withoutComments(read(appTemplate, "root/src/router.tsx"));

  it("imports the shared loader through the narrow package entry", () => {
    expect(router).toContain(
      'import { RoutePendingSpinner } from "@vitnode/core/tanstack/pending"',
    );
  });

  it("hands it to the router as the default pending component", () => {
    expect(router).toMatch(/defaultPendingComponent:\s*RoutePendingSpinner\b/);
  });

  it("declares how long a navigation may take before it appears", () => {
    expect(router).toMatch(/defaultPendingMs:\s*150\b/);
  });

  it("keeps it up for at least 300ms once it is showing", () => {
    expect(router).toMatch(/defaultPendingMinMs:\s*300\b/);
  });

  it("blocks on a stale reload, so a preloaded link still shows one", () => {
    expect(router).toMatch(/defaultStaleReloadMode:\s*["']blocking["']/);
  });

  it("reaches it through no barrel a client entry would then have to download", () => {
    const heavy = [
      "@vitnode/core/tanstack/admin",
      "@vitnode/core/tanstack/layout",
      "@vitnode/core/tanstack/settings",
      "@vitnode/core/content",
    ];

    expect(heavy.filter(entry => router.includes(`"${entry}"`))).toEqual([]);
  });
});

describe("the generated plugin", () => {
  /**
   * A plugin declares its routes; it does not ship a directory of pages for
   * something else to copy.
   */
  it("scaffolds a route tree rather than route directories", async () => {
    const { pluginRouteScaffold } =
      await import("../plugin/create/route-templates.js");
    const scaffold = pluginRouteScaffold("@acme/blog");

    expect(Object.keys(scaffold)).toContain("src/routes.ts");
    expect(scaffold["src/routes.ts"]).toContain("definePluginRoutes");

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
