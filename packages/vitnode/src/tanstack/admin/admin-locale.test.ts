import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  createLocaleRouting,
  DEFAULT_IGNORED_LOCALE_PATHS,
} from "@/lib/i18n/locale-routing";

import { ADMIN_SHELL_NAMESPACES } from "./intl";
import { ADMIN_SIGN_IN_NAMESPACES } from "./sign-in-route";
import { ADMIN_ENTRY_PATH, ADMIN_HOME_PATH } from "./state";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The AdminCP's URLs carry no language, in any language - and nothing in this
 * feature can start writing one.
 *
 * There is deliberately no admin locale implementation to test. `/admin` is in
 * `DEFAULT_IGNORED_LOCALE_PATHS`, so the existing Stage 3 routing answers every
 * question: the rewrite neither strips nor writes a prefix here,
 * `handleLocaleRequest` 308s `/pl/admin/...` to `/admin/...` while attaching the
 * locale cookie to the redirect, and `resolveLocale` on an ignored path falls
 * through to that cookie. What is pinned below is that the arrangement still
 * holds and that this feature's own constants stay outside the localized URL
 * space - because the way this breaks is somebody adding a prefix by hand, not
 * the routing changing its mind.
 */

const routing = createLocaleRouting({
  defaultLocale: "en",
  locales: ["en", "pl"],
});

describe("the AdminCP is outside the localized URL space", () => {
  it("is listed as an ignored path, with its descendants", () => {
    expect(DEFAULT_IGNORED_LOCALE_PATHS).toContain(ADMIN_ENTRY_PATH);
  });

  it.each([
    "/admin",
    "/admin/core",
    "/admin/core/users",
    "/admin/core/users/42",
    "/admin/content/blog/posts",
  ])("%s is ignored by locale routing", pathname => {
    expect(routing.shouldIgnoreLocalePath(pathname)).toBe(true);
  });

  it("does not ignore a path that merely looks like one", () => {
    // The control: an ignore rule matching too much would make every assertion
    // below pass for the wrong reason.
    expect(routing.shouldIgnoreLocalePath("/administrators")).toBe(false);
    expect(routing.shouldIgnoreLocalePath("/discover")).toBe(false);
  });
});

describe("no helper in this feature can produce a /pl/admin URL", () => {
  const adminPaths = [ADMIN_ENTRY_PATH, ADMIN_HOME_PATH];

  it.each(adminPaths)("%s is written without a prefix", path => {
    expect(path.startsWith("/admin")).toBe(true);
  });

  it.each(adminPaths)("localizing %s into Polish is a no-op", path => {
    // The rule every link goes through. If `/admin` ever left the ignored list,
    // this is the assertion that would fail rather than a page 404ing in
    // production.
    expect(
      routing.localizeUrl(new URL(path, "https://x.invalid"), "pl").pathname,
    ).toBe(path);
  });

  it.each(adminPaths)("de-localizing %s leaves it alone", path => {
    expect(
      routing.deLocalizeUrl(new URL(path, "https://x.invalid")).pathname,
    ).toBe(path);
  });

  /**
   * The other direction, and the one a stale bookmark exercises: a prefixed
   * admin URL is not a page, it is a redirect. `handleLocaleRequest` performs
   * it; what matters here is that the prefix is not part of the route.
   */
  it("strips a prefix somebody typed rather than serving it", () => {
    expect(
      routing.deLocalizeUrl(new URL("/pl/admin/core", "https://x.invalid"))
        .pathname,
    ).toBe("/admin/core");
  });

  it("never writes a prefix onto an admin path for a non-default locale", () => {
    for (const locale of ["en", "pl"]) {
      for (const path of adminPaths) {
        const localized = routing.localizeUrl(
          new URL(path, "https://x.invalid"),
          locale,
        ).pathname;

        expect(localized.startsWith("/pl/")).toBe(false);
        expect(localized).toBe(path);
      }
    }
  });

  it("does prefix a public path, so the check above is real", () => {
    // The control for the whole block. A `localizeUrl` that had stopped writing
    // prefixes at all would satisfy every assertion above.
    expect(
      routing.localizeUrl(new URL("/discover", "https://x.invalid"), "pl")
        .pathname,
    ).toBe("/pl/discover");
  });
});

describe("what the AdminCP loads strings for", () => {
  /**
   * The shell warms two namespaces, not the AdminCP's whole message tree. The
   * merged record carries every plugin's admin copy, and a sidebar does not need
   * the users table's vocabulary to render.
   */
  it("warms only the shell's own namespaces", () => {
    expect(ADMIN_SHELL_NAMESPACES).toEqual(["core.global", "admin.global"]);
  });

  it("does not warm a feature namespace at the root", () => {
    for (const namespace of ADMIN_SHELL_NAMESPACES) {
      expect(namespace).toMatch(/^(core|admin)\.global$/);
    }
  });

  /**
   * The sign-in screen renders no shell - no sidebar, no search, no user bar -
   * so warming `admin.global` there would ship an administrator's whole
   * navigation vocabulary to a page that has none.
   */
  it("does not warm the shell's namespace on the sign-in screen", () => {
    expect(ADMIN_SIGN_IN_NAMESPACES).toEqual([
      "core.global",
      "core.auth.sign_in",
    ]);
    expect(ADMIN_SIGN_IN_NAMESPACES).not.toContain("admin.global");
  });

  it("keeps the sign-in screen's strings the ones the Next.js view asks for", () => {
    // `SignInAdminView` mounts `<I18nProvider namespaces={["core.auth.sign_in"]}>`,
    // and that provider always prepends `core.global`. Same pair, so a screen's
    // strings survive the migration unchanged.
    expect([...ADMIN_SIGN_IN_NAMESPACES].sort()).toEqual(
      ["core.auth.sign_in", "core.global"].sort(),
    );
  });
});

/**
 * Warming the strings is only half of it - somebody has to *provide* them.
 *
 * This is the half that was missing, and the way it failed is why it is pinned
 * here rather than left to a rendering test. `_admin`'s loader called
 * `loadAdminMessages`, so `admin.global` sat in the query cache exactly as
 * intended; nothing mounted a provider for it, and `useTranslations` in
 * `AdminNavProvider` answered every lookup with the key. The AdminCP rendered,
 * navigated and passed every existing test with a sidebar reading
 * "admin.global.nav.core" over "admin.global.nav.dashboard" in every language.
 *
 * A page's own `RouteMessages` cannot stand in for it: the pages mount below
 * `{children}` and the chrome is above them, which is exactly why this belongs
 * to the shell.
 *
 * Read off the source rather than rendered, because what is being asserted is
 * that a provider exists at all - a question about the component tree, not about
 * markup - and `AdminShellContent` needs a router, a sidebar and a filled
 * QueryClient before it will render a single string.
 */
describe("the shell provides the strings its chrome renders", () => {
  const shell = readFileSync(join(here, "shell.tsx"), "utf8");

  it("mounts RouteMessages for the namespaces the loader warms", () => {
    expect(shell).toMatch(
      /<RouteMessages\s+namespaces=\{ADMIN_SHELL_NAMESPACES\}>/,
    );
  });

  it("mounts it above the navigation, which is what translates", () => {
    // `AdminNavProvider` calls `useTranslations()`; a provider below it would be
    // out of scope for every title in the sidebar and the palette.
    expect(shell.indexOf("<RouteMessages")).toBeGreaterThan(-1);
    expect(shell.indexOf("<RouteMessages")).toBeLessThan(
      shell.indexOf("<AdminNavProvider"),
    );
  });

  it("names the same list rather than repeating it", () => {
    // A second literal here would be a second answer to "which namespaces", and
    // the loader's is the one the query entry is keyed by.
    expect(shell).toContain('from "./intl"');
    expect(shell).not.toMatch(/namespaces=\{\[/);
  });
});
