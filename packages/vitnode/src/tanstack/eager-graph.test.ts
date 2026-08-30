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
 * in `apps/web/src/tests/eager-graph.test.ts`, which asserts the host half.
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
 * Libraries that only a rendered screen needs.
 *
 * Each was measured in the client entry at the start of Stage 14 and is there
 * for a reason worth naming: `@tiptap` is the content editor, `react-hook-form`
 * and `@hookform` are the AutoForm stack, `@dnd-kit` is the dashboard's widget
 * grid and the form builder's field ordering, and `cmdk` is the AdminCP command
 * palette. None belongs on the path a visitor takes to `/`.
 */
const SCREEN_ONLY_PACKAGES = [
  "@dnd-kit",
  "@hookform",
  "@tiptap",
  "cmdk",
  "react-hook-form",
];

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

  it.each(loaderModules)("%s pulls in no screen-only library", file => {
    const { packages } = reachableFrom(file);

    expect(SCREEN_ONLY_PACKAGES.filter(name => packages.has(name))).toEqual([]);
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
