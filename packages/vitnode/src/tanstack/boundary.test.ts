import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The rules that make `@vitnode/core/tanstack/*` safe to depend on.
 *
 * `src/tanstack` is the only place in this package allowed to import TanStack
 * Router or Start. Everything under it is compiled twice by two different
 * pipelines, and the two disagree - which is the whole reason these rules exist
 * rather than being left to review:
 *
 * - **Browser bundle.** The host app's Vite build inlines this package, so the
 *   TanStack Start compiler *does* transform these files. `createIsomorphicFn`
 *   is rewritten to the client branch and the `.server()` branch - and its
 *   imports with it - are dropped.
 * - **Server bundle.** The host externalises this package from Vite's SSR pass
 *   (`ssr.external`), and Nitro's own Rollup run inlines the built `dist`
 *   afterwards. Nothing in that path runs the Start compiler, so these files
 *   reach the server *uncompiled*.
 *
 * `createIsomorphicFn` survives that asymmetry because its runtime stub prefers
 * the `.server()` implementation when it was never compiled, which is exactly
 * what a server wants. `createServerFn` does not: uncompiled, its `.handler()`
 * receives one argument where the compiler passes two, and the call resolves to
 * `undefined` with no error at all. A server function declared here therefore
 * answers correctly when the browser calls it over `/_serverFn/*` and silently
 * returns nothing when the server calls it during SSR - so it is forbidden, and
 * stays in the host where the compiler can see it.
 */
const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "../..");
const tanstackRoot = here;

const SKIP_DIRECTORIES = ["dist", "node_modules"];

const filesUnder = (directory: string): string[] => {
  const entries: string[] = [];

  for (const name of readdirSync(directory)) {
    const path = join(directory, name);

    if (statSync(path).isDirectory()) {
      if (SKIP_DIRECTORIES.includes(name)) continue;
      entries.push(...filesUnder(path));
      continue;
    }

    if (/\.tsx?$/.test(name) && !name.endsWith(".d.ts")) entries.push(path);
  }

  return entries;
};

const isTest = (path: string): boolean =>
  /\.test(-d)?\.tsx?$/.test(path) || path.includes(`${sep}tests${sep}`);

const runtimeFilesUnder = (directory: string): string[] =>
  filesUnder(directory).filter(path => !isTest(path));

/** Every specifier a file imports, type-only statements dropped. */
const importsFrom = (path: string): string[] =>
  [
    ...readFileSync(path, "utf8")
      .replace(
        /(?:^|\n)\s*(?:import|export)\s+type\s[\s\S]*?\sfrom\s*["'][^"']+["']/g,
        "\n",
      )
      .matchAll(
        /(?:^|[^\w$.])from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']|(?:^|[\n;}])\s*import\s*["']([^"']+)["']/g,
      ),
  ]
    .map(match => match[1] ?? match[2] ?? match[3])
    .filter((specifier): specifier is string => Boolean(specifier));

const matches = (specifier: string, forbidden: string): boolean =>
  specifier === forbidden || specifier.startsWith(`${forbidden}/`);

const offendersIn = (files: string[], forbidden: string[]): string[] =>
  files
    .filter(path =>
      importsFrom(path).some(specifier =>
        forbidden.some(entry => matches(specifier, entry)),
      ),
    )
    .map(path => relative(packageRoot, path));

/** Anything that only resolves inside a TanStack Start app. */
const TANSTACK_RUNTIME = ["@tanstack/react-router", "@tanstack/react-start"];

/**
 * Every TanStack runtime this package expects the *host* to own, rather than
 * carrying its own copy of.
 *
 * A superset of {@link TANSTACK_RUNTIME}, and the extra entry is the reason the
 * two lists are not one. `@tanstack/react-query` is not confined to this
 * namespace and must not be: `views/layouts/provider` mounts the
 * `QueryClientProvider` that *both* frontends render under, and the AutoForm
 * fields, the AdminCP search dialog and the shared feature queries all read it
 * from a Next.js render. So it belongs on the dependency-policy list and not on
 * the import-isolation list above - adding it there would forbid the imports the
 * Next.js surface is built on.
 *
 * What it shares with the other two is the failure it prevents. This package
 * calls `useQueryClient`, `useQuery` and `useSuspenseQuery`; the application
 * mounts the provider. Resolve two copies of React Query and those are two React
 * contexts: the provider the host mounted is invisible to the hook inside a core
 * component, which throws "No QueryClient set" - or, worse, silently reads an
 * empty second cache, so a loader's `ensureQueryData` warms an entry the
 * component never sees. A peer dependency is what makes that arrangement
 * impossible rather than merely unlikely, because a peer resolves to the
 * consumer's copy by definition.
 *
 * Optional, because a consumer can legitimately have none of them: `apps/api`
 * installs this package for its Hono modules and renders nothing at all.
 * "Optional" here means "not every install needs one", never "core works
 * without it once you render" - an app that mounts VitNode's provider tree has
 * to supply React Query, which is why `apps/docs` declares it too.
 */
const TANSTACK_PEER_RUNTIME = [
  ...TANSTACK_RUNTIME,
  "@tanstack/react-query",
].sort((a, b) => a.localeCompare(b));

/**
 * The Start compiler's own entry points.
 *
 * `createServerFn` and `createMiddleware` need the module they sit in to be
 * transformed on *both* sides; `createStart` and `createFileRoute` name the
 * host's own composition (its Start instance and its route tree), which a
 * package cannot own. All four stay in `apps/web`.
 */
const HOST_ONLY_PRIMITIVES = [
  "createFileRoute",
  "createMiddleware",
  "createRootRoute",
  "createRootRouteWithContext",
  "createServerFn",
  "createStart",
];

describe("this test is looking at the right tree", () => {
  it("finds the package root", () => {
    expect(readFileSync(join(packageRoot, "package.json"), "utf8")).toContain(
      '"@vitnode/core"',
    );
  });

  it("has TanStack modules to check", () => {
    expect(runtimeFilesUnder(tanstackRoot).length).toBeGreaterThan(0);
  });
});

describe("TanStack stays behind the tanstack/ namespace", () => {
  /**
   * The rest of the package, which the Next.js apps import.
   *
   * `apps/docs` resolves `@vitnode/core/components/...` and
   * `@vitnode/core/views/...` and has no TanStack dependency at all. A single
   * import from one of those trees would make `@tanstack/react-router` a hard
   * requirement of every VitNode install, which is what the optional peer
   * dependency in `package.json` says it is not.
   */
  const outsideTanstack = () =>
    runtimeFilesUnder(join(packageRoot, "src")).filter(
      path => !path.startsWith(`${tanstackRoot}${sep}`),
    );

  it("has files to check", () => {
    expect(outsideTanstack().length).toBeGreaterThan(100);
  });

  it("never imports TanStack Router or Start", () => {
    expect(offendersIn(outsideTanstack(), TANSTACK_RUNTIME)).toEqual([]);
  });

  it("finds the TanStack imports inside the namespace, so the scan is real", () => {
    // The control. Every assertion above is a "found nothing" one, which a
    // scanner that silently matches nothing also satisfies.
    expect(
      offendersIn(runtimeFilesUnder(tanstackRoot), TANSTACK_RUNTIME),
    ).not.toEqual([]);
  });
});

describe("the namespace holds nothing the Start compiler has to see twice", () => {
  /**
   * Comments dropped before the scan, and that is not a loophole.
   *
   * The rule is about what a module *declares*. Explaining why `createServerFn`
   * has to stay in the host is exactly what the modules here should be doing -
   * `i18n/query.ts` names it twice in prose, saying who owns the server function
   * its validator is passed to - and a scan that counted those would push the
   * next author into writing a worse comment rather than moving code.
   *
   * A string literal is deliberately *not* stripped: nothing here has a reason
   * to name one of these in a string, and leaving them in keeps the scan blunt
   * where being blunt is free.
   */
  const withoutComments = (code: string): string =>
    code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  const sources = () =>
    runtimeFilesUnder(tanstackRoot).map(path => ({
      code: withoutComments(readFileSync(path, "utf8")),
      path: relative(packageRoot, path),
    }));

  it("still sees the code under the comments", () => {
    // The control for the stripping above: a scan that blanked whole files
    // would satisfy every assertion below.
    expect(
      sources().filter(({ code }) => /createIsomorphicFn\s*\(/.test(code)),
    ).not.toEqual([]);
  });

  it.each(HOST_ONLY_PRIMITIVES)("declares no %s", primitive => {
    expect(
      sources()
        .filter(({ code }) => new RegExp(`\\b${primitive}\\s*[(<]`).test(code))
        .map(({ path }) => path),
    ).toEqual([]);
  });
});

describe("the namespace never depends on an application", () => {
  /**
   * The reverse dependency, stated once for the whole package.
   *
   * `apps/web` may import `@vitnode/core`; `@vitnode/core` may never import
   * `apps/web`. The `#/` prefix is the one that would actually get written by
   * mistake - it is what the host's own modules use for their internal imports,
   * so a file moved here keeps compiling in the host's editor right up until it
   * is built.
   */
  const APP_SPECIFIERS = ["#", "apps/web", "web"];

  it("imports nothing through the host's `#/` alias", () => {
    const offenders = runtimeFilesUnder(join(packageRoot, "src"))
      .filter(path =>
        importsFrom(path).some(specifier =>
          APP_SPECIFIERS.some(entry => matches(specifier, entry)),
        ),
      )
      .map(path => relative(packageRoot, path));

    expect(offenders).toEqual([]);
  });

  it("reaches no application directory by relative path", () => {
    const offenders = runtimeFilesUnder(join(packageRoot, "src"))
      .filter(path =>
        importsFrom(path).some(
          specifier =>
            specifier.startsWith(".") &&
            resolve(dirname(path), specifier).includes(`${sep}apps${sep}`),
        ),
      )
      .map(path => relative(packageRoot, path));

    expect(offenders).toEqual([]);
  });
});

describe("the export map publishes the namespace", () => {
  const manifest = JSON.parse(
    readFileSync(join(packageRoot, "package.json"), "utf8"),
  ) as {
    dependencies?: Record<string, string>;
    exports: Record<string, Record<string, string> | string>;
    peerDependencies: Record<string, string>;
    peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  };

  const target = (subpath: string): string => {
    const entry = manifest.exports[subpath];
    expect(entry, `${subpath} is exported`).toBeDefined();

    return typeof entry === "string" ? entry : entry.import;
  };

  /**
   * Three patterns, one shape each. Node picks the *longest* matching pattern
   * and does not fall through to a shorter one, so `./tanstack/*` shadows the
   * package-wide `./*` for everything under the namespace: only these three
   * spellings resolve, and a feature's internals are unreachable from outside.
   */
  it.each([
    ["./tanstack/*", "./dist/src/tanstack/*/index.js"],
    ["./tanstack/*/client", "./dist/src/tanstack/*/client.js"],
    ["./tanstack/*/server", "./dist/src/tanstack/*/server.js"],
  ])("maps %s to %s", (subpath, expected) => {
    expect(target(subpath)).toBe(expected);
  });

  it("keeps the namespace patterns ahead of the package-wide wildcard", () => {
    const keys = Object.keys(manifest.exports);

    expect(keys.indexOf("./tanstack/*")).toBeLessThan(keys.indexOf("./*"));
  });

  it.each(TANSTACK_PEER_RUNTIME)("declares %s as an optional peer", name => {
    expect(manifest.peerDependencies[name]).toBeDefined();
    expect(manifest.peerDependenciesMeta?.[name]?.optional).toBe(true);
  });

  it.each(TANSTACK_PEER_RUNTIME)(
    "does not also carry %s as a private dependency",
    name => {
      // The half that actually prevents the second copy. A peer entry alongside
      // a `dependencies` entry is not a contract - npm and pnpm both install the
      // dependency, so the package gets its own copy regardless of what the host
      // has, and the peer declaration becomes decoration. React Query is the one
      // this test was extended for: it was a plain dependency, which in a
      // published install is two `QueryClient` contexts waiting to happen.
      expect(manifest.dependencies?.[name]).toBeUndefined();
    },
  );
});

describe("every feature in the namespace has the entry points it claims", () => {
  /**
   * The directories directly under `src/tanstack`, which are what
   * `@vitnode/core/tanstack/<feature>` resolves into. A feature that ships only
   * server code has no `index.ts`, and that is correct - the barrel exists to be
   * imported from a browser bundle, so an empty one would only invite a client
   * import of something that cannot run there.
   */
  const features = readdirSync(tanstackRoot)
    .filter(name => statSync(join(tanstackRoot, name)).isDirectory())
    .filter(name => !SKIP_DIRECTORIES.includes(name));

  it("has at least one feature", () => {
    expect(features.length).toBeGreaterThan(0);
  });

  it.each(features)("%s exposes at least one public entry", feature => {
    const entries = readdirSync(join(tanstackRoot, feature)).filter(name =>
      ["client.ts", "index.ts", "index.tsx", "server.ts"].includes(name),
    );

    expect(entries).not.toEqual([]);
  });
});
