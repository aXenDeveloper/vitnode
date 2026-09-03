import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The screens `@vitnode/core` mounts under an application's main shell.
 *
 * Static and pure: this directory is read as the text it is. Whether `/login`
 * resolves is a question for a real route tree, and this suite deliberately does
 * not build one - what it pins is the shape of what an application composes.
 *
 * ## The two things that moved here
 *
 * The four public auth screens, and the 404. Both used to render with no shell
 * at all - the auth screens from `root/`, the 404 from `__root`'s
 * `notFoundComponent` - and both are pages on the public site: they want the
 * header above them, the same `<main>` landmark, and the way back to the front
 * page that the header is.
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
  it("declares the public auth screens under the shell", () => {
    for (const path of [
      "/login",
      "/login/reset-password",
      "/login/sso/$providerId",
      "/register",
    ]) {
      expect(everyRoutePath, path).toContain(path);
    }
  });

  /**
   * `/admin` is the AdminCP's own sign-in and stays in `root/`. It reads a
   * different session under a different cookie, so a site header offering the
   * public "sign in" beside it would be one page asking for two unrelated
   * logins - and it has to sit outside the AdminCP shell or that shell's guard
   * would loop.
   */
  it("does not declare the AdminCP's own sign-in", () => {
    expect(everyRoutePath).not.toContain("/admin");
  });

  /**
   * `/login/reset-password` is a **sibling** of `/login`, not a child.
   *
   * The file-based spelling needed `login_.reset-password.tsx` to say so - the
   * trailing underscore meaning "do not nest under `/login`". A code-based route
   * needs no such escape: it is a sibling because it is declared as one, and the
   * path says the rest. What matters either way is that `/login` consumes
   * exactly `/login`, so a URL below it that no route declares does not render
   * the sign-in card.
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

describe("the 404 this container owns", () => {
  const notFound = codeOf("not-found.tsx");

  /**
   * A splat, because an unmatched URL has to *match* something before the shell
   * above it is matched too. Router core hands back the root route alone when
   * nothing matches, so a `notFoundComponent` on the pathless main shell could
   * never run - the shell was never in the branch.
   */
  it("claims every path no other route does", () => {
    expect(everyRoutePath).toContain("/$");
    expect(notFound).toContain('path: "/$"');
  });

  /**
   * And it answers 404 rather than rendering the message with a `200`, which
   * would tell a crawler the page exists. `beforeLoad` throws, the screen is
   * this route's own `notFoundComponent`, and the router resolves the boundary
   * on its server pass before the stream opens.
   *
   * `beforeLoad` rather than a loader, because a failure there stops the chain
   * at this match and leaves every loader above it to run - which is exactly the
   * main shell's, and the shell's loader is what warms the entry the header
   * reads with `useSuspenseQuery`.
   */
  it("answers notFound from beforeLoad rather than rendering a 200", () => {
    expect(notFound).toMatch(/beforeLoad:[\s\S]*throw notFound\(\)/);
    expect(notFound).not.toMatch(/^\s*loader:/m);
    expect(notFound).toContain("notFoundComponent:");
  });

  /** Nothing should index a page that does not exist. */
  it("tells crawlers to index nothing", () => {
    expect(notFound).toContain('robots: "noindex, nofollow"');
  });
});

describe("how these reach an application", () => {
  const index = codeOf("index.tsx");

  /**
   * Three injected bindings now, and the third arrived with the auth screens: a
   * sign-in navigates to a path a *visitor* supplied through `?returnTo=`, the
   * route tree carries no locale, and which prefixes exist is the
   * installation's answer.
   */
  it("takes the host's locale rule as well as its page head", () => {
    expect(index).toContain("export const withCoreMainRoutes");
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
    for (const name of modules) {
      expect(codeOf(name), name).not.toContain("deLocalize");
    }
  });

  /** Idempotent, and a good neighbour - the same contract the other two have. */
  it("mounts under its own container, replacing any previous copy", () => {
    expect(index).toContain("CORE_MAIN_ROUTES_ROUTE_ID");
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
});

describe("the shell renders the landmark, not the screen", () => {
  /**
   * There is exactly one `<main>` per document, and it belongs to
   * `ThemeLayoutContent`. Each auth screen used to render its own, which was
   * correct while it had no shell above it and is two landmarks now - invalid
   * HTML, and a screen reader with two "main" regions to choose from.
   */
  const screens = [
    "login-screen.tsx",
    "recovery-screen.tsx",
    "register-screen.tsx",
    "sso-screen.tsx",
  ];

  it.each(screens)("%s renders no landmark of its own", name => {
    const screen = readFileSync(join(here, "..", "..", "auth", name), "utf8");

    expect(screen).not.toContain("<main>");
  });
});
