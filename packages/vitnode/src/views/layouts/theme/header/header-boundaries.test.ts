// @vitest-environment node
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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

const NEXT_WRAPPERS = {
  header: join(here, "header.tsx"),
  headerLink: join(here, "header-next.tsx"),
  languageSwitcher: join(
    srcRoot,
    "components/switchers/langs/language-switcher.tsx",
  ),
};

const resolveSpecifier = (specifier: string, from: string): null | string => {
  let base: string;

  if (specifier.startsWith("@/")) base = join(srcRoot, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(from), specifier);
  else return null;

  for (const suffix of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }

  return existsSync(base) && statSync(base).isFile() ? base : null;
};

/** Every specifier a file imports at runtime; `import type` is erased first. */
const runtimeImports = (path: string): string[] => {
  const source = readFileSync(path, "utf8").replace(
    /(^|[\n;])\s*import\s+type\s[\s\S]*?from\s*["'][^"']+["']/g,
    "$1",
  );

  return [
    ...source.matchAll(
      /(?:^|[^\w$.])from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']|(?:^|[\n;}])\s*import\s*["']([^"']+)["']/g,
    ),
  ]
    .map(match => match[1] ?? match[2] ?? match[3])
    .filter((specifier): specifier is string => Boolean(specifier));
};

/** Every external specifier reachable from an entry, with the chain that got there. */
const externalGraph = (entry: string): Map<string, string[]> => {
  const found = new Map<string, string[]>();
  const parents = new Map<string, string>();
  const seen = new Set<string>();

  const chain = (file: string): string => {
    const parts: string[] = [];
    for (let at: string | undefined = file; at; at = parents.get(at)) {
      parts.unshift(relative(srcRoot, at));
    }

    return parts.join(" -> ");
  };

  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);

    for (const specifier of runtimeImports(file)) {
      const target = resolveSpecifier(specifier, file);

      if (target) {
        if (!parents.has(target)) parents.set(target, file);
        walk(target);
        continue;
      }

      found.set(specifier, [...(found.get(specifier) ?? []), chain(file)]);
    }
  };

  walk(entry);

  return found;
};

const matches = (specifier: string, forbidden: string): boolean =>
  specifier === forbidden || specifier.startsWith(`${forbidden}/`);

const offenders = (entry: string, forbidden: string[]): string[] =>
  [...externalGraph(entry)]
    .filter(([specifier]) => forbidden.some(one => matches(specifier, one)))
    .flatMap(([specifier, chains]) => chains.map(at => `${specifier} in ${at}`))
    .sort();

/** Anything that only resolves inside a Next.js app. */
const NEXT_ONLY = ["next", "server-only"];

/**
 * `next-intl`'s Next-only halves. The root entry is absent on purpose: it
 * re-exports `use-intl`, which is framework-free - and the theme switcher reads
 * its label through it, which is why it renders in `apps/web` unchanged.
 */
const NEXT_INTL_RUNTIME = [
  "next-intl/middleware",
  "next-intl/navigation",
  "next-intl/plugin",
  "next-intl/server",
];

const sharedEntries = Object.entries(SHARED).map(([name, path]) => ({
  name,
  path,
}));

/** A file's code, with the prose stripped - which talks about the very imports
 * these assertions look for. */
const withoutComments = (path: string): string =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

describe("the import scan finds what it is looking for", () => {
  // Every assertion below is a "found nothing" one, which a scanner that
  // silently matches nothing also satisfies. The Next wrappers are the control:
  // they provably import the things the shared half must not.
  it("finds `next-intl/server` in the Next header", () => {
    expect(offenders(NEXT_WRAPPERS.header, NEXT_INTL_RUNTIME)).not.toEqual([]);
  });

  it("walks past the entry file into its dependencies", () => {
    // `lib/navigation` is two hops from the header, never one - by way of
    // `header-next.tsx` for the links and `language-switcher.tsx` for the
    // switch. A scan that only read the entry file would find neither.
    const chains = offenders(NEXT_WRAPPERS.header, ["next-intl/navigation"]);

    expect(chains).not.toEqual([]);
    expect(chains.every(one => one.includes(" -> "))).toBe(true);
  });
});

describe("the shared header is framework-neutral", () => {
  it.each(sharedEntries)("$name reaches nothing from next/*", ({ path }) => {
    expect(offenders(path, NEXT_ONLY)).toEqual([]);
  });

  it.each(sharedEntries)(
    "$name reaches none of next-intl's Next-only entrypoints",
    ({ path }) => {
      expect(offenders(path, NEXT_INTL_RUNTIME)).toEqual([]);
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
    // The Next wrapper is the navigation and nothing else - if it grows a
    // `DropdownMenu` again, `apps/web` is rendering different markup.
    expect(withoutComments(NEXT_WRAPPERS.languageSwitcher)).not.toContain(
      "DropdownMenu",
    );
  });

  /**
   * The one piece of Next.js structure the shared control has to make room for.
   *
   * `useRouter()` and `usePathname()` read the current URL, and Next 16 refuses
   * to prerender a client component that reads URL data outside a `<Suspense>` -
   * so the AdminCP's prerendered routes fail `next build` outright without this
   * boundary. It was there before the control was shared, and moving the hooks
   * up out of it while extracting the markup is exactly how it got lost once.
   */
  it("keeps the URL-reading hooks inside a Suspense boundary", () => {
    const next = withoutComments(NEXT_WRAPPERS.languageSwitcher);
    const at = next.indexOf("export const LanguageSwitcher =");
    const exported = next.slice(at);
    const inner = next.slice(0, at);

    // The exported component renders the boundary and reads no URL itself.
    expect(exported).toContain("React.Suspense");
    expect(exported).not.toContain("usePathname");
    expect(exported).not.toContain("useRouter");

    // Everything that does read one is in the component below it.
    expect(inner).toContain("usePathname");
    expect(inner).toContain("useRouter");
  });
});

describe("the Next wrappers keep the Next-only pieces", () => {
  it.each(
    Object.entries(NEXT_WRAPPERS).map(([name, path]) => ({ name, path })),
  )("the $name wrapper is where Next.js enters", ({ path }) => {
    expect(offenders(path, [...NEXT_ONLY, ...NEXT_INTL_RUNTIME])).not.toEqual(
      [],
    );
  });

  it("is the only half that knows about next-intl navigation", () => {
    expect(
      offenders(NEXT_WRAPPERS.headerLink, ["next-intl/navigation"]),
    ).not.toEqual([]);
    expect(offenders(SHARED.header, ["next-intl/navigation"])).toEqual([]);
  });
});
