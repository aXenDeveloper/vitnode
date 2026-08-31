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

describe("the template trees", () => {
  /**
   * Six trees, and no two of them own the same path in the same destination.
   *
   * `root` is the generic host app; `api-single-app` is the API half a single
   * app adds over it; `api` is the standalone API; `api-bun` is the one entry
   * point bun replaces; `monorepo` is the workspace root; `docker` is the
   * compose file. Two of these land in the *same* directory, and a shared path
   * there is a race whose winner is whichever `cp` finished last - which is how
   * a new project came to get a `.gitignore` for a framework it does not use,
   * about half the time.
   */
  const treeFiles = (tree: string) => filesUnder(join(appTemplate, tree));

  /**
   * `root` and `api-single-app` are copied into the *same* directory, so a
   * shared path between them is a race whose winner is whichever `cp` finished
   * last. They shared `.gitignore_template` and `.env.example`, and the
   * overlay's were the pre-TanStack copies - which is how about half of all new
   * single apps got a `.gitignore` for a framework they do not use.
   */
  it("share no path between the base and the single-app overlay", () => {
    expect(
      treeFiles("api-single-app").filter(file =>
        treeFiles("root").includes(file),
      ),
    ).toEqual([]);
  });

  /**
   * `api-bun` is the one overlay that is *meant* to replace a file, and it is
   * exactly one: bun's entry point over Node's. An overlay that grew a second
   * file would be silently deciding something for a package manager.
   */
  it("lets the bun overlay replace one file and no more", () => {
    expect(treeFiles("api-bun")).toEqual(["src/index.ts"]);
    expect(treeFiles("api")).toContain("src/index.ts");
  });

  /**
   * And the overlay is only the API. Listed as a property rather than as an
   * expected file list, so adding a genuinely API-specific file needs no edit
   * here.
   */
  it("keeps only API-specific files in the single-app overlay", () => {
    const overlayFiles = filesUnder(join(appTemplate, "api-single-app"));

    expect(overlayFiles.length).toBeGreaterThan(0);
    for (const file of overlayFiles) {
      expect(file).toMatch(
        /^(?:drizzle\.config\.ts|src\/(?:routes\/api\/|server\/|vitnode\.api\.config\.ts))/,
      );
    }
  });

  /**
   * The workspace tree is the workspace's own files and nothing else.
   *
   * It shipped `apps/api/.env.example` and `apps/web/.env.example`, which is how
   * an API-only monorepo ended up with an `apps/web` directory holding one file
   * and no package. An app's files belong to an app's tree - or, for the
   * environment, to the builder that composes one per role.
   */
  it("gives the workspace root no files belonging to an app", () => {
    expect(filesUnder(join(appTemplate, "monorepo")).sort()).toEqual([
      ".gitignore_template",
      "turbo.json",
    ]);
  });

  /**
   * `.env.example` is composed rather than copied, so it has exactly one owner
   * for three genuinely different files - see `create-env-example.ts`. No
   * template tree may reintroduce a fourth.
   */
  it("commits no `.env.example` to any tree", () => {
    expect(allFiles.filter(file => file.endsWith(".env.example"))).toEqual([]);
  });

  /**
   * `.gitignore_template` is a file, and one per destination: the workspace
   * root's, the API app's and the web app's are three different lists for three
   * different build outputs.
   */
  it("gives each destination exactly one .gitignore", () => {
    expect(
      appFiles.filter(file => file.endsWith(".gitignore_template")).sort(),
    ).toEqual([
      "api/.gitignore_template",
      "monorepo/.gitignore_template",
      "root/.gitignore_template",
    ]);
  });

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

  /** The API compiles to `dist/`, which is what its `start` script runs. */
  it("ignores the API's build output", () => {
    const api = read(appTemplate, "api/.gitignore_template");

    expect(api).toContain("/dist");
    expect(api).toContain("node_modules");
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

  /**
   * A `tsconfig` that includes a file the tree does not ship is a phantom: the
   * API's named a `global.d.ts` that only the web template has.
   */
  it("includes no file the API template does not ship", () => {
    const tsconfig = JSON.parse(read(appTemplate, "api/tsconfig.json")) as {
      include: string[];
    };

    for (const entry of tsconfig.include) {
      if (entry.includes("*") || !entry.includes(".")) continue;
      expect(appFiles).toContain(`api/${entry}`);
    }
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
