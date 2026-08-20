// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(here, "../..");

const filesUnder = (directory: string): string[] => {
  const entries: string[] = [];

  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      entries.push(...filesUnder(path));
      continue;
    }
    // Tests are excluded on purpose: a test names a framework module in order to
    // stub it, and that is the opposite of depending on one.
    if (/\.test(-d)?\.tsx?$/.test(name)) continue;
    if (/\.tsx?$/.test(name)) entries.push(path);
  }

  return entries;
};

const importsFrom = (path: string): string[] =>
  [
    ...readFileSync(path, "utf8").matchAll(
      /from\s+"([^"]+)"|import\s+"([^"]+)"/g,
    ),
  ]
    .map(match => match[1] ?? match[2])
    .filter(Boolean);

/** The names a file pulls out of one specifier, across both import forms. */
const namedImportsFrom = (path: string, specifier: string): string[] => {
  const source = readFileSync(path, "utf8");
  const pattern = new RegExp(
    `import\\s+(?:type\\s+)?\\{([^}]*)\\}\\s+from\\s+"${specifier}"`,
    "g",
  );

  return [...source.matchAll(pattern)]
    .flatMap(match => match[1].split(","))
    .map(
      name =>
        name
          .trim()
          .replace(/^type\s+/, "")
          .split(/\s+as\s+/)[0],
    )
    .filter(Boolean)
    .toSorted();
};

/**
 * The rule the `framework/navigation` layer is for, asserted rather than
 * remembered.
 *
 * A link, a router, a redirect and a 404 are needed by roughly sixty modules in
 * here, which is exactly why they are the easiest way to weld the UI to one
 * framework a line at a time. This suite pins the two places where naming the
 * framework is still correct, so that the list can only grow deliberately.
 */
describe("navigation layer boundaries", () => {
  const sourceFiles = filesUnder(sourceRoot);
  const adapter = relative(sourceRoot, join(here, "next.ts"));
  const themeProvider = join("components", "theme-provider.tsx");

  const importersOf = (specifier: string): string[] =>
    sourceFiles
      .filter(path => importsFrom(path).includes(specifier))
      .map(path => relative(sourceRoot, path))
      .toSorted();

  it("has files to check", () => {
    // A move that relocated the package should fail loudly here rather than
    // making the suite vacuously pass.
    expect(sourceFiles.length).toBeGreaterThan(100);
  });

  it("imports next/link from the Next adapter and nowhere else", () => {
    expect(importersOf("next/link")).toEqual([adapter]);
  });

  it("imports next-intl's navigation from the Next adapter and nowhere else", () => {
    // The locale-aware half is next-intl's, and next-intl is a Next library:
    // reaching for it directly binds a call site just as tightly as `next/*`.
    expect(importersOf("next-intl/navigation")).toEqual([adapter]);
  });

  it("leaves next/navigation to the adapter, the route files and one SSR hook", () => {
    const offenders = importersOf("next/navigation").filter(
      path =>
        path !== adapter &&
        path !== themeProvider &&
        !path.startsWith(`routes${sep}`),
    );

    expect(offenders).toEqual([]);
  });

  it("lets the theme provider take the SSR hook and nothing that navigates", () => {
    // `useServerInsertedHTML` ships from `next/navigation` but has nothing to do
    // with navigating - it injects the no-flash theme script into the streamed
    // HTML. It is the one symbol this exemption covers.
    const names = namedImportsFrom(
      join(sourceRoot, themeProvider),
      "next/navigation",
    );

    expect(names).toEqual(["useServerInsertedHTML"]);
  });

  it("lets a route file take notFound and nothing else", () => {
    // `src/routes/**` is App Router `page.tsx`/`layout.tsx` copied verbatim into
    // the apps - framework files by definition, so `notFound()` there is honest.
    // Anything else a page wants to do (redirect, read the router) has a
    // framework-independent form, and should use it.
    const routeFiles = sourceFiles.filter(path =>
      relative(sourceRoot, path).startsWith(`routes${sep}`),
    );

    const offenders = routeFiles
      .flatMap(path =>
        namedImportsFrom(path, "next/navigation").map(name => ({ name, path })),
      )
      .filter(({ name }) => name !== "notFound")
      .map(({ name, path }) => `${relative(sourceRoot, path)}: ${name}`);

    expect(offenders).toEqual([]);
  });

  it("keeps the framework-agnostic half free of any framework import", () => {
    // An adapter for another framework imports this, and nothing else in the
    // layer describes the contract. One `next/*` import here would make the
    // contract itself Next-shaped.
    const offenders = importsFrom(join(here, "types.ts")).filter(specifier =>
      /^next(-intl)?(\/|$)/.test(specifier),
    );

    expect(offenders).toEqual([]);
  });

  it("routes the whole layer through the barrel, not the adapter", () => {
    // Importing `./next` directly would bind a call site to Next again even
    // though it went through this folder to do it.
    const offenders = sourceFiles
      .filter(path => dirname(path) !== here)
      .filter(path =>
        importsFrom(path).some(specifier =>
          specifier.endsWith("framework/navigation/next"),
        ),
      )
      .map(path => relative(sourceRoot, path));

    expect(offenders).toEqual([]);
  });

  it("keeps the `@/lib/navigation` shim a re-export of the barrel", () => {
    // Fifty modules and every app import navigation by that name. The shim may
    // forward to this layer; it may not grow a second implementation.
    const shim = join(sourceRoot, "lib", "navigation.ts");

    expect(importsFrom(shim)).toEqual(["@/framework/navigation"]);
  });
});
