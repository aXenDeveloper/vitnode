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
  it("warms only the shell's own namespaces", () => {
    expect(ADMIN_SHELL_NAMESPACES).toEqual(["core.global", "admin.global"]);
  });

  it("does not warm a feature namespace at the root", () => {
    for (const namespace of ADMIN_SHELL_NAMESPACES) {
      expect(namespace).toMatch(/^(core|admin)\.global$/);
    }
  });

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

describe("the shell provides the strings its chrome renders", () => {
  const shell = readFileSync(join(here, "shell.tsx"), "utf8");

  it("mounts RouteMessages for the namespaces the loader warms", () => {
    // The same list, computed the same way: `adminShellNamespaces` is what the
    // loader passes through too, so the entry this provider reads back is the
    // one `loadAdminMessages` filled. It takes an argument now because the
    // navigation's namespaces are not knowable in advance - a plugin group's
    // headings live under that plugin's own id.
    expect(shell).toMatch(/<RouteMessages\s+namespaces=\{namespaces\}>/);
    expect(shell).toContain("adminShellNamespaces(nav?.namespaces)");
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
