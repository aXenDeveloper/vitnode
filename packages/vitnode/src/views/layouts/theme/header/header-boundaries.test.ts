// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  externalGraph,
  NEXT_INTL,
  NEXT_ONLY,
  offenders,
  runtimeImports,
} from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../../../..");

/**
 * The main header, split down the middle.
 *
 * The same boundary `theme-boundaries.test.ts` draws around the shell one level
 * up, and it is the header that makes it worth drawing twice: the shell is four
 * slots and no imports, while the header is the design system - a link, a
 * button, two dropdowns and a theme toggle. One import that only resolves inside
 * a Next.js app anywhere in that graph turns the whole `apps/web` shell into a
 * build error nobody sees until they try it. That is not hypothetical:
 * `HeaderContent` was Next-only for one back button, and `use-captcha` made
 * every `AutoForm` Next-only for one navigation import.
 *
 * The shared half is the bar, the logo placement, the nav and the action area.
 * The Next half is `getTranslations`, `next-intl`'s locale-aware `Link` and the
 * async user slot - and it is the control that proves this scan can see them.
 */
const SHARED = {
  header: join(here, "header-content.tsx"),
  languageSwitcher: join(
    srcRoot,
    "components/switchers/langs/language-switcher-content.tsx",
  ),
  /** The theme toggle, reused unchanged rather than extracted - see below. */
  themeSwitcher: join(
    srcRoot,
    "components/switchers/themes/theme-switcher.tsx",
  ),
};

/**
 * The Next.js half, by path, so its absence can be asserted.
 *
 * Named rather than deleted along with the assertions: each of these was the
 * only place a Next.js API was allowed to appear, and a test that stops naming
 * them cannot notice one coming back.
 */
const DELETED_NEXT_HALF = {
  header: join(here, "header.tsx"),
  headerLink: join(here, "header-next.tsx"),
  languageSwitcher: join(
    srcRoot,
    "components/switchers/langs/language-switcher.tsx",
  ),
};

const sharedEntries = Object.entries(SHARED).map(([name, path]) => ({
  name,
  path,
}));
const withoutComments = (path: string): string =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

describe("the shared header is framework-neutral", () => {
  it.each(sharedEntries)("$name reaches nothing from next/*", ({ path }) => {
    expect(offenders(path, NEXT_ONLY)).toEqual([]);
  });

  it.each(sharedEntries)(
    "$name reaches none of next-intl's Next-only entrypoints",
    ({ path }) => {
      expect(offenders(path, NEXT_INTL)).toEqual([]);
    },
  );

  it.each(sharedEntries)(
    "$name never reaches the locale-aware navigation module",
    ({ path }) => {
      const reached = [...externalGraph(path).keys()];

      expect(reached.some(one => one.includes("navigation"))).toBe(false);
    },
  );

  it.each(sharedEntries)("$name never reaches a server action", ({ path }) => {
    // A `"use server"` module is the other way Next.js gets in: importing one
    // pulls the fetcher, `next/headers` and the whole API module graph behind
    // it. The header's one mutation - sign-out - lives in the user slot, which
    // is a prop.
    const reached = [...externalGraph(path).keys()];

    expect(reached.some(one => one.endsWith(".server"))).toBe(false);
    expect(runtimeImports(path).some(one => one.includes(".server"))).toBe(
      false,
    );
  });

  it("never reaches a router", () => {
    // The mirror of the Next assertions: the shared header must not import
    // TanStack Router either, or the Next.js app stops being able to render it.
    const reached = [...externalGraph(SHARED.header).keys()];

    expect(reached.some(one => one.startsWith("@tanstack/"))).toBe(false);
  });
});

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
    // The nav labels arrive as data. Next.js resolves them on the server, where
    // they cost the client bundle nothing; `apps/web` resolves them from the
    // message cache. A `useTranslations` here would force `core.search` into
    // every Next.js page's client provider for two words.
    expect(code).not.toContain("useTranslations");
    expect(code).not.toContain("getTranslations");
  });

  it("renders the theme switcher itself", () => {
    // Not a prop: it was already framework-neutral - the assertions above are
    // over its real import graph - so injecting it would be a prop every caller
    // has to pass and nobody gets to answer differently.
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
    // There is one copy now, and this is it. The Next.js wrapper used to hold
    // the navigation and nothing else, and the risk it carried was growing a
    // second `DropdownMenu` - which would have meant two applications rendering
    // different markup for the same control.
    expect(code).toContain("DropdownMenu");
  });

  it("reads no URL itself, so no host has to wrap it in Suspense", () => {
    /**
     * What replaced a Next-specific structural requirement.
     *
     * The wrapper had to render `<React.Suspense>` around its own URL reads:
     * Next 16 refuses to prerender a client component that reads URL data
     * outside one, so the AdminCP's prerendered routes failed `next build`
     * without it. The requirement came from where the hooks were, not from the
     * control - and with the hooks gone from this package entirely, the shared
     * control has no URL to read and nothing to wrap.
     *
     * Asserted rather than assumed because the tempting way to "restore" the
     * language switcher's convenience is to put a router hook back into it.
     */
    expect(code).not.toContain("usePathname");
    expect(code).not.toContain("useRouter");
    expect(code).not.toContain("React.Suspense");
  });
});

describe("the Next.js half of the header is gone", () => {
  it.each(Object.entries(DELETED_NEXT_HALF))(
    "%s no longer exists",
    (_name, path) => {
      expect(existsSync(path)).toBe(false);
    },
  );
});
