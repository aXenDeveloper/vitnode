// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../../../..");

/**
 * The header's injection seam, asserted by source.
 *
 * The shell one level up is four slots and no imports; the header is the design
 * system - a link, a button, two dropdowns and a theme toggle - so it is the
 * part where reaching for a router or a translator is genuinely tempting. What
 * this file pins is that it does neither: the logo, the nav, the language
 * switcher and the user area all arrive as slots, the labels arrive as data, and
 * the one control it renders itself is the one that never needed a host.
 *
 * Two whole-graph claims used to sit above this - reaches nothing from `next/*`,
 * reaches no router - from these three entry points. Both are now
 * `next-boundary.test.ts`'s, over every file in the package: the router rule as
 * "imports no host router outside src/tanstack", which covers these three and
 * the twenty other components on the same seam.
 */
const SHARED = {
  header: join(here, "header-content.tsx"),
  languageSwitcher: join(
    srcRoot,
    "components/switchers/langs/language-switcher-content.tsx",
  ),
};

const withoutComments = (path: string): string =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

describe("the shared header takes its framework parts as props", () => {
  const code = withoutComments(SHARED.header);

  it("takes its links as a component rather than importing one", () => {
    expect(code).toContain("LinkComponent");
  });

  it.each(["logo", "navigation", "languageSwitcher", "user"])(
    "asks for %s rather than resolving it",
    slot => {
      expect(code).toContain(slot);
    },
  );

  it("translates nothing itself", () => {
    // The nav labels arrive as data, resolved by whoever has the messages. A
    // `useTranslations` here would force `core.search` into every host's client
    // provider for two words.
    expect(code).not.toContain("useTranslations");
    expect(code).not.toContain("getTranslations");
  });

  it("renders the theme switcher itself", () => {
    // Not a prop: it is already framework-neutral, so injecting it would be a
    // prop every caller has to pass and nobody gets to answer differently.
    expect(code).toContain("<ThemeSwitcher />");
  });
});

describe("the shared language switcher takes the navigation as a callback", () => {
  const code = withoutComments(SHARED.languageSwitcher);

  it("asks for a select handler rather than moving the URL itself", () => {
    expect(code).toContain("onSelect");
    expect(code).not.toContain("useRouter");
    expect(code).not.toContain("usePathname");
  });

  it("is the only copy of the dropdown", () => {
    // There is one copy now, and this is it. The wrapper that used to sit in
    // front of it held the navigation and nothing else, and the risk it carried
    // was growing a second `DropdownMenu` - two applications rendering
    // different markup for the same control.
    expect(code).toContain("DropdownMenu");
  });

  it("reads no URL itself, so no host has to wrap it in Suspense", () => {
    /**
     * What replaced a host-specific structural requirement.
     *
     * The wrapper had to render `<React.Suspense>` around its own URL reads:
     * Next 16 refuses to prerender a client component that reads URL data
     * outside one, so the AdminCP's prerendered routes failed to build without
     * it. The requirement came from where the hooks were, not from the control -
     * and with no router hook in this package, the shared control has no URL to
     * read and nothing to wrap.
     *
     * Asserted rather than assumed because the tempting way to "restore" the
     * language switcher's convenience is to put a router hook back into it.
     */
    expect(code).not.toContain("usePathname");
    expect(code).not.toContain("useRouter");
    expect(code).not.toContain("React.Suspense");
  });
});
