import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The screen that renders outside every shell, and it is `@vitnode/core`'s.
 *
 * Static and pure: this directory is read as the text it is.
 *
 * ## Why `root` is a folder of its own, for one screen
 *
 * `main/` and `admin/` are named after the shell they mount under. This one has
 * none, so it is named after its mount point too: the root route, with nothing
 * between.
 *
 * One screen is in it, and that is the whole point of the folder. The AdminCP's
 * own sign-in has to sit *outside* the AdminCP shell or that shell's guard would
 * send a denied visitor into a route that sends them back, and outside the main
 * shell because it reads a different session under a different cookie - a page
 * asking for the admin login under a header offering the public one would be one
 * page asking for two unrelated logins.
 *
 * The public auth screens were here and are not any more: an auth card is a page
 * on the public site, so `main/auth.tsx` owns them. `../main/main-routes.test.ts`
 * is the half of this suite that moved with them.
 */

const here = import.meta.dirname;

/** Source with its comments removed - prose may name what code may not do. */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const modules = readdirSync(here)
  .filter(name => /\.tsx?$/.test(name) && !name.endsWith(".test.ts"))
  .sort();

const codeOf = (name: string): string =>
  withoutComments(readFileSync(join(here, name), "utf8"));

const everyRoutePath = modules
  .flatMap(name => [...codeOf(name).matchAll(/path: "([^"]+)"/g)])
  .map(match => match[1])
  .sort();

describe("what this directory declares", () => {
  it("declares the shell-less screen, and only it", () => {
    expect(everyRoutePath).toEqual(["/admin"]);
  });

  /**
   * The public auth screens moved to the main shell, and nothing of them may be
   * left behind: a second `/login` here would shadow the one under the shell
   * from a container the router ranks identically, and which of the two won
   * would depend on the order an application happens to call the mounts in.
   */
  it("declares no screen the main shell now owns", () => {
    for (const path of everyRoutePath) {
      expect(path.startsWith("/login"), path).toBe(false);
      expect(path, path).not.toBe("/register");
    }
  });
});

describe("how it reaches an application", () => {
  const index = codeOf("index.tsx");

  /**
   * Three injected bindings, and the third is what made this screen one of the
   * last to move: a sign-in navigates to a path a *visitor* supplied through
   * `?returnTo=`, the route tree carries no locale, and which prefixes exist is
   * the installation's answer.
   */
  it("takes the host's locale rule as well as its page head", () => {
    expect(index).toContain("export const withCoreRootRoutes");
    expect(index).toMatch(/localeRouting/);
    expect(index).toMatch(/pageHead/);
    expect(index).toMatch(/mountUnder/);
  });

  /**
   * And it builds the navigation from that rule rather than carrying its own
   * copy of the locale-stripping - `createAuthNavigation` is the one
   * implementation, and an application's own binding uses the same factory.
   */
  it("builds its navigation from the injected rule", () => {
    const signIn = codeOf("admin-sign-in.tsx");

    expect(signIn).toContain("createAuthNavigation({");
    expect(signIn).toContain("localeRouting");
    // No second copy of the rule: no route here strips a prefix by hand. The
    // injected shape is named once, in `../types.ts`, which is the opposite of
    // a copy.
    for (const name of modules) {
      expect(codeOf(name), name).not.toContain("deLocalize");
    }
  });

  /** Idempotent, and a good neighbour - the same contract the other two have. */
  it("mounts under its own container, replacing any previous copy", () => {
    expect(index).toContain("CORE_ROOT_ROUTES_ROUTE_ID");
    expect(index).toContain("siblings");
    expect(index).toMatch(/addChildren\(\[\.\.\.siblings, container\]\)/);
  });

  it("writes nothing and reads no filesystem", () => {
    for (const name of modules) {
      const code = codeOf(name);

      expect(code, name).not.toMatch(/node:fs|writeFile|createFileRoute/);
      expect(code, name).not.toMatch(/src\/routes/);
    }
  });
});

describe("the guard this screen carries", () => {
  /**
   * A redirect carries `to`, never `href`. A redirect with `href` is used
   * verbatim by `Router.resolveRedirect` - it never reaches `buildLocation`, so
   * it would skip the locale rewrite and drop a Polish visitor on the English
   * page.
   */
  it("never redirects by href", () => {
    for (const name of modules) {
      expect(codeOf(name), name).not.toMatch(/redirect\(\{[^}]*href:/);
    }
  });

  /**
   * The AdminCP sign-in reads its session *tolerantly*, and it is the one route
   * where that is correct: `ensureAdminAccess` rejecting would replace the
   * AdminCP's only entrance with an error page during an API outage, locking
   * every administrator out.
   */
  it("reads the admin session tolerantly on the AdminCP entrance", () => {
    const signIn = codeOf("admin-sign-in.tsx");

    expect(signIn).toContain("prefetchAdminAccess");
    expect(signIn).not.toContain("ensureAdminAccess");
    expect(signIn).toMatch(
      /if \(!access \|\| !canEnterAdmin\(access\)\) return/,
    );
  });
});
