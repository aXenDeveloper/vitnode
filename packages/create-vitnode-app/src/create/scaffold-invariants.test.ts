import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

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

const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("the generated application", () => {
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

  it("mounts the API through a server route, not a Route Handler", () => {
    expect(appFiles).toContain("api-single-app/src/routes/api/$.ts");
    expect(read(appTemplate, "api-single-app/src/routes/api/$.ts")).toContain(
      "createFileRoute('/api/$')",
    );
  });
});

describe("the single-app template's two trees", () => {
  const overlayFiles = filesUnder(join(appTemplate, "api-single-app"));
  const rootFiles = filesUnder(join(appTemplate, "root"));

  it("share no path at all", () => {
    expect(overlayFiles.filter(file => rootFiles.includes(file))).toEqual([]);
  });

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

  it("ships the single-app environment", () => {
    expect(env).toContain("POSTGRES_URL=");
    expect(env).toContain("NEXT_PUBLIC_WEB_URL=http://localhost:3000");
    expect(env).toContain("CRON_SECRET=");
  });

  it("names no API server for an app that serves its own", () => {
    expect(env).not.toMatch(/^NEXT_PUBLIC_API_URL=/m);
  });

  it("points a split web app at the API's own port", () => {
    expect(read(appTemplate, "monorepo/apps/web/.env.example")).toContain(
      "NEXT_PUBLIC_API_URL=http://localhost:8000",
    );
    expect(read(appTemplate, "api-bun/src/index.ts")).toContain("port: 8000");
  });

  it("declares its languages once and reads them from both configs", () => {
    expect(allFiles.filter(file => /(^|\/)src\/i18n\.ts$/.test(file))).toEqual(
      [],
    );
    expect(appFiles).not.toContain("root/src/vitnode.shell.config.ts");

    const shared = withoutComments(
      read(appTemplate, "root/src/vitnode.config.ts"),
    );
    expect(shared).toMatch(/defaultLocale:\s*"en"/);
    expect(shared).toMatch(/locales:\s*\[/);

    expect(
      withoutComments(
        read(appTemplate, "api-single-app/src/vitnode.api.config.ts"),
      ),
    ).toMatch(/i18n:\s*vitNodeConfig\.i18n/);
  });

  /**
   * The split shape has the same obligation, one declaration each: two packages,
   * so neither can import the other's, and the API's is the one the seed reads.
   */
  it("gives a split deployment an API locale declaration of its own", () => {
    const api = withoutComments(
      read(appTemplate, "api/src/vitnode.api.config.ts"),
    );

    expect(api).toMatch(/defaultLocale:\s*"en"/);
    expect(api).toMatch(/locales:\s*\[/);
  });

  it("registers the app's message loaders through the server config", () => {
    const shared = withoutComments(
      read(appTemplate, "root/src/vitnode.config.ts"),
    );

    expect(shared).not.toMatch(/from\s*['"]\.\/locales/);
    expect(shared).not.toMatch(/from\s*['"]#\/locales/);

    expect(appFiles).toContain("root/src/vitnode.server.config.ts");
    const server = withoutComments(
      read(appTemplate, "root/src/vitnode.server.config.ts"),
    );
    expect(server).toContain('import "@tanstack/react-start/server-only"');
    expect(server).toContain("buildServerConfig");
    expect(server).toMatch(/config:\s*vitNodeConfig/);
    expect(server).toMatch(/messages:\s*appMessages/);
    expect(server).toContain("packageMessages");
  });
});

describe("what a generated application does to every request", () => {
  const start = withoutComments(read(appTemplate, "root/src/start.ts"));

  it("builds its Start instance through the Core factory", () => {
    expect(start).toContain(
      'import { createVitNodeStart } from "@vitnode/core/tanstack/start"',
    );
    expect(start).toMatch(
      /export const startInstance = createVitNodeStart\(\{\s*config: vitNodeConfig,?\s*\}\)/,
    );
  });

  it("hand-rolls none of the pipeline the factory owns", () => {
    for (const primitive of [
      "createStart",
      "createMiddleware",
      "createCsrfMiddleware",
      "handleLocaleRequest",
      "localeRouting",
    ]) {
      expect(start).not.toContain(primitive);
    }

    // The header rule moved into Core with the middleware that applies it.
    expect(
      allFiles.filter(file => file.endsWith("lib/document-headers.ts")),
    ).toEqual([]);
  });

  /**
   * One VitNode plugin in the Vite config, for the same reason: four calls in
   * a fixed order is four things to copy wrong.
   */
  it("configures Vite through one VitNode plugin", () => {
    const vite = withoutComments(read(appTemplate, "root/vite.config.ts"));

    expect(vite).toContain(
      'import { vitnode } from "@vitnode/core/framework/vite"',
    );
    expect(vite).toMatch(/vitnode\(\{ appRoot: import\.meta\.dirname \}\)/);
    for (const removed of [
      "vitNodeEnv",
      "vitNodeOptimizeDeps",
      "vitNodePluginRoutes",
    ]) {
      expect(vite).not.toContain(removed);
    }
  });

  it("leaves the SSR externals to that plugin", () => {
    const vite = withoutComments(read(appTemplate, "root/vite.config.ts"));

    expect(vite).not.toMatch(/ssr\s*:/);
    expect(vite).not.toContain('external: ["@vitnode/core"');
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
