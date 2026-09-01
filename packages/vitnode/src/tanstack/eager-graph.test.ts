import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * What a route's *loader* is allowed to drag into the client entry.
 *
 * `routeTree.gen.ts` imports every route file statically, and TanStack Start's
 * code splitter moves only the splittable options - `component`,
 * `errorComponent`, `notFoundComponent`, `pendingComponent` - into chunks of
 * their own. Everything else a route file evaluates at module scope stays in the
 * client entry: `loader`, `beforeLoad`, `validateSearch`, `loaderDeps`, `head`
 * and `staticData`.
 *
 * So a namespace that exports `loadAdminUsersRoute` and `AdminUsersRouteContent`
 * from *one module* puts the screen in the entry chunk, because the host's route
 * file imports the loader from it. Stage 14 measured that: the public root was
 * downloading every AdminCP management screen, the Content Engine's admin form
 * layer, `react-hook-form`, `cmdk` and `@dnd-kit` before it could paint `/`.
 *
 * The rule this file enforces is therefore a *file* rule, not a naming
 * convention:
 *
 *     route.tsx / *-route.tsx    namespaces, permission tuples, the loader
 *     screen.tsx / *-screen.tsx  the component, and everything it renders
 *
 * A loader module may reach queries, contracts, permissions and intl - the
 * things it actually needs - and may not reach a rendered component or the
 * libraries only a rendered component needs. Splitting them is what lets the
 * bundler drop the screen from the eager graph, and this test is what stops the
 * two halves quietly merging again.
 *
 * ## It is a static test, deliberately
 *
 * No bundle bytes are asserted anywhere here. A byte budget breaks on a
 * dependency bump and says nothing about *why*; this walks the same import graph
 * the bundler walks and names the edge that would cost the bytes. See the note
 * in `apps/web/src/tests/asset-graph.test.ts`, which asserts the host half from
 * the other end: it reads the emitted chunks and fails on a budget.
 */
const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "..");

const SKIP = new Set(["dist", "node_modules"]);

const walk = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (SKIP.has(entry.name)) return [];
    const path = join(directory, entry.name);

    return entry.isDirectory() ? walk(path) : [path];
  });

/**
 * The static, value-level import edges of one module.
 *
 * `import type` is skipped because it is erased before a bundler ever sees it -
 * `verbatimModuleSyntax` is on, so what survives compilation is exactly what is
 * not marked `type`. A bare `import "./x"` counts: that is how the Content
 * Engine registers its editorial panels, and it is a real edge.
 */
const importsOf = (file: string): string[] => {
  const source = readFileSync(file, "utf8");
  const specifiers: string[] = [];

  for (const match of source.matchAll(
    /^import\s+([\s\S]*?)from\s+["']([^"']+)["'];?$/gm,
  )) {
    if (match[1].trimStart().startsWith("type")) continue;
    specifiers.push(match[2]);
  }

  for (const match of source.matchAll(/^import\s+["']([^"']+)["'];?$/gm)) {
    specifiers.push(match[1]);
  }

  return specifiers;
};

/** `@/x` and `./x` to a file in this package; anything else is a bare package. */
const resolveSpecifier = (from: string, specifier: string): null | string => {
  const base = specifier.startsWith("@/")
    ? join(src, specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(from), specifier)
      : null;

  if (base === null) return null;

  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }

  return null;
};

interface Reachable {
  /** Files inside this package. */
  files: Set<string>;
  /** Bare package specifiers, narrowed to the package name. */
  packages: Set<string>;
}

const reachableFrom = (entry: string): Reachable => {
  const files = new Set([entry]);
  const packages = new Set<string>();
  const queue = [entry];

  for (const file of queue) {
    for (const specifier of importsOf(file)) {
      const resolved = resolveSpecifier(file, specifier);

      if (resolved === null) {
        const segments = specifier.split("/");
        packages.add(
          specifier.startsWith("@")
            ? segments.slice(0, 2).join("/")
            : segments[0],
        );
        continue;
      }

      if (files.has(resolved)) continue;
      files.add(resolved);
      // Pushed onto the array being iterated: `for…of` picks up appended
      // entries, which is the breadth-first walk without a shift().
      queue.push(resolved);
    }
  }

  return { files, packages };
};

/**
 * Every loader module in the TanStack namespace.
 *
 * Matched by filename because that is the contract: a host's route file imports
 * `loadXRoute` from one of these, so whatever one of these can reach is what
 * every page of the application pays for.
 */
const loaderModules = walk(join(src, "tanstack")).filter(
  file =>
    /(?:^|\/)(?:route|[a-z-]+-route)\.tsx$/.test(file) &&
    !/\.test(?:-d)?\.tsx?$/.test(file),
);

/**
 * Libraries that only a rendered screen needs, as *exact package names*.
 *
 * Each was measured in the client entry at the start of Stage 14: `cmdk` is the
 * AdminCP command palette and `react-hook-form` is the AutoForm stack's core.
 * Neither belongs on the path a visitor takes to `/`.
 */
const SCREEN_ONLY_PACKAGES = new Set(["cmdk", "react-hook-form"]);

/**
 * The same rule, for whole scopes - and the reason the two lists are separate.
 *
 * `reachableFrom` narrows a bare specifier to its package name, which for a
 * scoped package is *scope and name* (`@tiptap/react`), never the scope alone.
 * These entries used to sit in the list above and be checked with `Set.has`, so
 * `has("@tiptap")` was asked of a set containing `@tiptap/react`, `@tiptap/core`
 * and `@tiptap/starter-kit` - and answered `false` every time. The rule read as
 * though it covered the content editor, the widget grid and the resolver layer,
 * and covered none of them.
 *
 * Splitting them is what makes the distinction visible rather than implied: an
 * entry here means "every package in this scope", and an entry above means "this
 * package". A scope is written without a trailing slash and matched on the
 * boundary, so `@tiptap` cannot also match a hypothetical `@tiptaphelper`.
 *
 * `@tiptap` is the content editor, `@dnd-kit` is the dashboard's widget grid and
 * the form builder's field ordering, `@hookform` is the AutoForm resolver layer.
 */
const SCREEN_ONLY_SCOPES = new Set(["@dnd-kit", "@hookform", "@tiptap"]);

/**
 * Whether one package name is a screen-only library.
 *
 * Pure, and exported to its own describe block below, because the last version
 * of this rule was wrong in a way no loader assertion could reveal: a matcher
 * that silently matches nothing passes every "found nothing" test in the file.
 */
const isScreenOnlyPackage = (name: string): boolean =>
  SCREEN_ONLY_PACKAGES.has(name) ||
  (name.startsWith("@") && SCREEN_ONLY_SCOPES.has(name.split("/")[0]));

/**
 * The matcher itself, before it is trusted with the graph.
 *
 * Every assertion in the suite below is a "found nothing" one, and a matcher
 * that matches nothing satisfies all of them - which is precisely how the scope
 * entries went unchecked. So the matcher is pinned directly, in both directions:
 * what it must catch, and what it must not.
 */
describe("the screen-only matcher", () => {
  it.each([
    ["@tiptap/react", "@tiptap"],
    ["@tiptap/core", "@tiptap"],
    ["@tiptap/starter-kit", "@tiptap"],
    ["@dnd-kit/core", "@dnd-kit"],
    ["@dnd-kit/sortable", "@dnd-kit"],
    ["@hookform/resolvers", "@hookform"],
  ])("rejects %s by its scope %s", packageName => {
    expect(isScreenOnlyPackage(packageName)).toBe(true);
  });

  it.each([["react-hook-form"], ["cmdk"]])(
    "rejects %s by exact name",
    packageName => {
      expect(isScreenOnlyPackage(packageName)).toBe(true);
    },
  );

  /** A scope root on its own, in case a specifier ever arrives narrowed to one. */
  it.each([["@tiptap"], ["@dnd-kit"], ["@hookform"]])(
    "rejects the bare scope %s",
    scope => {
      expect(isScreenOnlyPackage(scope)).toBe(true);
    },
  );

  it.each([
    ["@tanstack/react-router"],
    ["@tanstack/react-query"],
    ["use-intl"],
    ["react"],
    ["zod"],
  ])("allows %s", packageName => {
    expect(isScreenOnlyPackage(packageName)).toBe(false);
  });

  /**
   * The boundary a prefix match would get wrong.
   *
   * `@tiptapx/thing` shares five characters with a forbidden scope and is not in
   * it. Matching on the scope segment rather than on `startsWith` is what makes
   * that distinction, and it is worth an assertion because the naive spelling is
   * the one somebody reaches for when fixing this kind of bug.
   */
  it.each([["@tiptapx/thing"], ["@dnd-kitten/core"], ["react-hook-form-x"]])(
    "does not reject %s on a partial name match",
    packageName => {
      expect(isScreenOnlyPackage(packageName)).toBe(false);
    },
  );
});

describe("route loader modules", () => {
  it("exist, so a rename cannot silently empty this suite", () => {
    expect(loaderModules.length).toBeGreaterThan(15);
  });

  /**
   * The screen half is `.tsx` under `views/` - the components both AdminCPs
   * render. A loader reaching one of those is the exact regression this file
   * exists for, and it is always the same mistake: a component moved back
   * alongside its loader, or a new namespace was written without the split.
   *
   * `.ts` under `views/` is deliberately allowed. Queries, permission tuples,
   * table contracts and mutation wrappers live there, they are what a loader is
   * *for*, and they carry no component tree.
   */
  it.each(loaderModules)("%s renders nothing", file => {
    const components = [...reachableFrom(file).files]
      .filter(
        reached => reached.includes(`/views/`) && reached.endsWith(".tsx"),
      )
      .map(reached => relative(src, reached));

    expect(components).toEqual([]);
  });

  /**
   * The control for the assertion below.
   *
   * `expect(offenders).toEqual([])` is satisfied just as well by a walk that
   * reaches no packages at all as by one that reaches only permitted ones - and a
   * silently empty walk is exactly the failure this file has already had once.
   * So: the loaders do reach bare packages, and `@tanstack/react-router` is one
   * of them, because every one of these modules is a route.
   */
  it("reaches real packages, so the rule below is not vacuous", () => {
    const reached = loaderModules.flatMap(file => [
      ...reachableFrom(file).packages,
    ]);

    expect(reached).toContain("@tanstack/react-router");
    expect(reached.some(name => name.startsWith("@"))).toBe(true);
  });

  it.each(loaderModules)("%s pulls in no screen-only library", file => {
    const { packages } = reachableFrom(file);

    // Filtered from what was *reached* rather than from the forbidden list, so a
    // failure names the specifier that is actually in the graph - `@tiptap/react`
    // rather than `@tiptap` - which is the thing a reader has to go and remove.
    expect([...packages].filter(isScreenOnlyPackage)).toEqual([]);
  });
});

/**
 * The other half of the same rule.
 *
 * A `screen.tsx` that nothing imports is dead weight, and a namespace that
 * exports its screen from `route.tsx` again would pass the tests above by having
 * no screen module at all. This pins the pairing: wherever a screen module
 * exists, its barrel is what re-exports it.
 */
describe("screen modules", () => {
  const screenModules = walk(join(src, "tanstack")).filter(
    file =>
      /(?:^|\/)(?:screen|[a-z-]+-screen)\.tsx$/.test(file) &&
      !/\.test(?:-d)?\.tsx?$/.test(file),
  );

  it("exist alongside the loaders they were split from", () => {
    expect(screenModules.length).toBeGreaterThan(15);
  });

  it.each(screenModules)("%s is re-exported by its namespace barrel", file => {
    const barrel = join(dirname(file), "index.ts");

    if (!existsSync(barrel)) return;

    const name = relative(dirname(file), file).replace(/\.tsx$/, "");

    expect(readFileSync(barrel, "utf8")).toContain(`"./${name}"`);
  });
});

/**
 * Core's own programmatic routes - the other half of the same rule, and the one
 * that turned out to matter most.
 *
 * `withCoreAdminRoutes`, `withCoreMainRoutes` and `withCoreRootRoutes` are
 * called from a host's `router.tsx`, which is the module the client entry loads
 * before anything else. So *whatever a route module under `tanstack/routes`
 * statically imports is downloaded by every page of the application* - the front
 * page included, and the front page renders none of it.
 *
 * Measured on vitnode.com before this rule existed: the homepage's initial graph
 * carried 117 module preloads and 1.47 MB of JavaScript, and in it were the
 * AdminCP's users, staff, roles, cron, queue, files, debug and integrations
 * screens, the Content Engine's admin form layer, AutoForm, `react-hook-form`,
 * `cmdk` and the settings panels - because each route module imported its
 * screen and its loader from the same namespace barrel, beside the
 * `validateSearch` the router genuinely needs before it can match a path.
 *
 * The split these assertions enforce:
 *
 *     eager    path, id, validateSearch, loaderDeps, beforeLoad, loader, head,
 *              staticData - everything the router consults before it renders
 *     lazy     `component`, `pendingComponent`, `notFoundComponent` and
 *              `errorComponent`, each behind `lazyRouteComponent` over a literal
 *              `import()` the bundler can follow
 *
 * A breadcrumb is deliberately on the eager side: `staticData.breadcrumb` is an
 * *element*, built when the route tree is composed, so its component has to be
 * in hand. That is why the rule below is "reaches no screen module" rather than
 * "reaches nothing under `views/`" - a crumb is a view, and a small one.
 */
describe("core route composers", () => {
  const routeModules = walk(join(src, "tanstack", "routes")).filter(
    file => file.endsWith(".tsx") && !/\.test\.tsx?$/.test(file),
  );

  it("exist, so a rename cannot silently empty this suite", () => {
    expect(routeModules.length).toBeGreaterThan(7);
  });

  /**
   * The screen modules are the ones `../eager-graph.test.ts`'s other half
   * already names - `screen.tsx` and `*-screen.tsx` - so there is one spelling
   * of "this is a rendered page" in the package rather than two.
   */
  const isScreenModule = (file: string): boolean =>
    /(?:^|\/)(?:screen|[a-z-]+-screen)\.tsx$/.test(file);

  it.each(routeModules)("%s statically reaches no screen module", file => {
    const screens = [...reachableFrom(file).files]
      .filter(isScreenModule)
      .map(reached => relative(src, reached));

    expect(screens).toEqual([]);
  });

  it.each(routeModules)("%s pulls in no screen-only library", file => {
    const { packages } = reachableFrom(file);

    expect([...packages].filter(isScreenOnlyPackage)).toEqual([]);
  });

  /**
   * The control, for the same reason the loader suite has one: every assertion
   * above is a "found nothing" assertion, and a walk that reached nothing would
   * satisfy all of them.
   */
  it("reaches real modules, so the rules above are not vacuous", () => {
    const reached = routeModules.flatMap(file => [
      ...reachableFrom(file).files,
    ]);

    expect(reached.length).toBeGreaterThan(routeModules.length);
    expect(
      routeModules.flatMap(file => [...reachableFrom(file).packages]),
    ).toContain("@tanstack/react-router");
  });

  /**
   * And the screens are still rendered - through the one API that code-splits
   * them.
   *
   * A route module that names a `component` at all must reach it through
   * `lazyRouteComponent`, and the module it loads must be a literal `import()`
   * so that Rollup can follow it into a chunk. A computed specifier compiles and
   * then resolves to nothing in a production build.
   */
  it.each(routeModules)("%s renders every screen lazily", file => {
    const source = readFileSync(file, "utf8");
    const eager = [
      ...source.matchAll(
        /\b(component|pendingComponent|notFoundComponent|errorComponent):\s*(\S+)/g,
      ),
    ]
      .filter(([, , value]) => !value.startsWith("lazyRouteComponent("))
      .map(([, option, value]) => `${option}: ${value}`);

    expect(eager).toEqual([]);
  });

  /**
   * The control for the rule above: these routes do declare components, so
   * "none of them is eager" is a statement about something rather than about an
   * empty list.
   */
  it("declares components at all, so the rule above is not vacuous", () => {
    const declared = routeModules.flatMap(file => [
      ...readFileSync(file, "utf8").matchAll(
        /\b(component|pendingComponent|notFoundComponent|errorComponent):/g,
      ),
    ]);

    expect(declared.length).toBeGreaterThan(15);
  });

  it("imports its screens with specifiers a bundler can follow", () => {
    const dynamic = routeModules.flatMap(file =>
      [...readFileSync(file, "utf8").matchAll(/\bimport\(([^)]*)\)/g)].map(
        match => match[1].trim(),
      ),
    );

    expect(dynamic.length).toBeGreaterThan(15);
    for (const specifier of dynamic) {
      expect(specifier).toMatch(/^"[^"$`]+"$/);
    }
  });
});
