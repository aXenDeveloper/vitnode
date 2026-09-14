import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(
  import.meta.dirname,
  "../../copy-of-vitnode-app/root/src",
);

const read = (file: string): string =>
  readFileSync(join(appRoot, file), "utf8");

const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/** Every `.ts`/`.tsx` file in the template, relative to its `src/`. */
const sourceFiles = (directory: string, prefix = ""): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory())
      return sourceFiles(join(directory, entry.name), path);

    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });

const REMOVED = [
  ["auth", "lib/auth.ts"],
  ["the AdminCP session", "lib/admin-auth.ts"],
  ["the AdminCP user search", "lib/admin-search.ts"],
  ["the AdminCP navigation", "lib/admin-nav.ts"],
  ["the Content Engine registry", "lib/content-registry.ts"],
  ["the installed packages' translations", "locales/packages.ts"],
] as const;

describe("bootstrap a generated application no longer owns", () => {
  it.each(REMOVED)("scaffolds no module for %s", (_what, file) => {
    expect(existsSync(join(appRoot, file))).toBe(false);
  });

  it("leaves the router with no transport side-effect imports", () => {
    const router = withoutComments(read("router.tsx"));

    expect(router).not.toContain("./lib/auth");
    expect(router).not.toContain("./lib/admin-auth");
    expect(router).not.toMatch(/^import\s+["'][^"']+["'];?$/m);
  });

  it("renders the AdminCP shell without a user-search prop", () => {
    const shell = withoutComments(read("components/admin-shell.tsx"));

    expect(shell).not.toContain("adminUserSearchFn");
    expect(shell).not.toContain("searchUsers");
  });
});

describe("what reads the generated projections", () => {
  it("takes the AdminCP navigation straight from the generated file", () => {
    const shell = withoutComments(read("components/admin-shell.tsx"));

    expect(shell).toContain('from "@/admin-nav.gen"');
    expect(shell).not.toContain("adminNavBundle");
  });

  it("loads the same generated file in the admin route", () => {
    const route = withoutComments(read("routes/_admin.tsx"));

    expect(route).toContain('await import("@/admin-nav.gen")');
    expect(route).not.toContain("@/lib/admin-nav");
  });

  /**
   * The registry's imports pull every plugin's AdminCP content and editor code,
   * so a static import here would put all of it in the entry chunk. The dynamic
   * `import()` is what keeps it out, and is the reason this is asserted rather
   * than left to review.
   */
  it("keeps the content registry behind a dynamic import in the router", () => {
    const router = withoutComments(read("router.tsx"));

    expect(router).toContain('await import("./content-registry.gen")');
    expect(router).not.toMatch(/^import .*content-registry\.gen/m);
    expect(router).not.toContain("./lib/content-registry");
  });

  /**
   * The file `locales/packages.ts` used to be, and the reason it is gone: the
   * plugin list it repeated is the one in `vitnode.config.ts`, and a second
   * copy of it could only ever drift.
   */
  it("reads the package translations from the generated file", () => {
    const config = withoutComments(read("vitnode.server.config.ts"));

    expect(config).toContain('from "@/package-messages.gen"');
    expect(config).toContain("packageMessages,");
    expect(config).not.toContain("@/locales/packages");
  });

  it("leaves the app's own overrides where an author edits them", () => {
    expect(readdirSync(join(appRoot, "locales")).sort()).toEqual(["app.ts"]);
    expect(withoutComments(read("vitnode.server.config.ts"))).toContain(
      'from "@/locales/app"',
    );
  });

  it("never re-derives what the generated files already export", () => {
    const sources = ["router.tsx", "components/admin-shell.tsx"].map(file =>
      withoutComments(read(file)),
    );

    for (const source of sources) {
      expect(source).not.toContain("adminNavBundle");
      expect(source).not.toContain("buildContentFrontendRegistry");
      expect(source).not.toContain("setContentFrontendRegistry");
    }
  });
});

describe("the one adapter a generated application keeps", () => {
  it("still ships lib/i18n.ts", () => {
    expect(existsSync(join(appRoot, "lib/i18n.ts"))).toBe(true);
  });

  it("is what the router reads its locale routing from", () => {
    expect(withoutComments(read("router.tsx"))).toContain('from "./lib/i18n"');
  });

  it("declares the server function, because only app source is compiled", () => {
    const i18n = read("lib/i18n.ts");

    expect(withoutComments(i18n)).toContain("createServerFn");
    expect(i18n).toContain("@vitnode/core");
  });

  it("says in the file itself why it cannot move into the package", () => {
    expect(read("lib/i18n.ts")).toContain("createServerFn");
    expect(read("lib/i18n.ts").slice(0, 1200)).toMatch(/precompiled|compiler/);
  });

  it("is the only thing left under lib/ at all", () => {
    expect(readdirSync(join(appRoot, "lib")).sort()).toEqual(["i18n.ts"]);
  });

  it("is the only module in the app that declares a server function", () => {
    const declaring = sourceFiles(appRoot).filter(file =>
      withoutComments(read(file)).includes("createServerFn"),
    );

    expect(declaring).toEqual(["lib/i18n.ts"]);
  });
});
