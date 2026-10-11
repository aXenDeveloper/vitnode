import { describe, expect, it } from "vitest";

import {
  createLocaleRouting,
  DEFAULT_IGNORED_LOCALE_PATHS,
} from "@/lib/i18n/locale-routing";

import { ADMIN_ENTRY_PATH, ADMIN_HOME_PATH } from "./state";

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
