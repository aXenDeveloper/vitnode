import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The screens that render outside every shell, and they are `@vitnode/core`'s.
 *
 * Static and pure: this directory is read as the text it is. Whether `/login`
 * resolves is `apps/web/src/tests/auth-routes.test.ts`, against the real tree.
 *
 * ## Why `root` is a folder of its own
 *
 * `main/` and `admin/` are named after the shell they mount under. These have
 * none - an auth card is the whole page, and the AdminCP's own sign-in has to sit
 * *outside* the AdminCP shell or the shell's guard would send a denied visitor
 * into a route that sends them back. So the third folder is named after its mount
 * point too: the root route, with nothing between.
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
  it("declares the shell-less screens", () => {
    expect(everyRoutePath).toEqual([
      "/admin",
      "/login",
      "/login/reset-password",
      "/login/sso/$providerId",
      "/register",
    ]);
  });

  /**
   * `/login/reset-password` is a **sibling** of `/login`, not a child.
   *
   * The file-based spelling needed `login_.reset-password.tsx` to say so - the
   * trailing underscore meaning "do not nest under `/login`". A code-based route
   * needs no such escape: it is a sibling because it is declared as one, and the
   * path says the rest. What matters either way is that `/login` consumes exactly
   * `/login`, so a URL below it that no route declares does not render the
   * sign-in card.
   */
  it("declares no route nested under another", () => {
    for (const path of everyRoutePath) {
      const parents = everyRoutePath.filter(
        other => other !== path && path.startsWith(`${other}/`),
      );

      // `/login/reset-password` and `/login/sso/$providerId` start with
      // `/login/`, and that is a shared *prefix*, not a parent: each is its own
      // route with its own full path.
      expect(
        parents.every(parent => parent === "/login"),
        path,
      ).toBe(true);
    }
  });
});

describe("how they reach an application", () => {
  const index = codeOf("index.tsx");

  /**
   * Three injected bindings, and the third is what made these the last screens
   * to move: a sign-in navigates to a path a *visitor* supplied through
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
    const auth = codeOf("auth.tsx");

    expect(auth).toContain("createAuthNavigation({");
    expect(auth).toContain("localeRouting");
    // No second copy of the rule: no route here strips a prefix by hand.
    // `types.ts` names `deLocalizeUrl` because that is the injected shape, which
    // is the opposite of a copy.
    for (const name of modules.filter(one => one !== "types.ts")) {
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

describe("the guards these screens carry", () => {
  const auth = codeOf("auth.tsx");

  /**
   * One predicate for "signed in", used by both guest routes.
   *
   * There must not be a second, so "signed in" cannot come to mean two different
   * things on two pages.
   */
  it("decides guest-only through one shared predicate", () => {
    expect(auth.match(/canAccessGuestRoute/g)?.length).toBe(3);
  });

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
