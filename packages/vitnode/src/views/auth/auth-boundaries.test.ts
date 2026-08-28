// @vitest-environment node
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../..");

/**
 * The auth screens, split down the middle.
 *
 * The same boundary `feed-boundaries.test.ts` draws around the search feed, for
 * the same reason and with the same machinery: a shared component that reaches
 * `@/lib/navigation` - or anything else built on Next's request scope - cannot
 * be rendered by a TanStack Start route, and nothing about that failure is
 * visible until somebody tries.
 */
const SHARED = {
  breadcrumbTrail: join(here, "../breadcrumb/breadcrumb-main-content.tsx"),
  card: join(here, "sign-in/sign-in-content.tsx"),
  changePasswordForm: join(
    here,
    "password-reset/change-password-form/change-password-form-content.tsx",
  ),
  errorScreen: join(here, "../error/error-content.tsx"),
  passwordResetCard: join(here, "password-reset/password-reset-content.tsx"),
  passwordResetForm: join(
    here,
    "password-reset/form/password-reset-form-content.tsx",
  ),
  recoveryLink: join(here, "password-reset/recovery-link.ts"),
  settingsNav: join(here, "settings/nav-content.tsx"),
  settingsNavModel: join(here, "settings/settings-nav.ts"),
  settingsOverview: join(here, "settings/overview/overview.tsx"),
  settingsSecurity: join(here, "settings/security/security.tsx"),
  settingsShell: join(here, "settings/shell-content.tsx"),
  signInForm: join(here, "sign-in/form/sign-in-form-content.tsx"),
  signUpCard: join(here, "sign-up/sign-up-content.tsx"),
  signUpForm: join(here, "sign-up/form/sign-up-form-content.tsx"),
  ssoButtons: join(here, "sso/buttons/sso-buttons-content.tsx"),
  ssoCallback: join(here, "sso/callback/sso-callback-content.tsx"),
  ssoCallbackHook: join(here, "sso/callback/use-sso-callback.ts"),
};

/** The Next.js half: server actions, `next/cache`, locale-aware navigation. */
const NEXT_WRAPPERS = {
  breadcrumbTrail: join(here, "../breadcrumb/breadcrumb-main.tsx"),
  card: join(here, "sign-in/sign-in-card.tsx"),
  changePasswordForm: join(
    here,
    "password-reset/change-password-form/form.tsx",
  ),
  passwordResetForm: join(here, "password-reset/form/form.tsx"),
  settingsNav: join(here, "settings/nav.tsx"),
  settingsShell: join(here, "settings/shell.tsx"),
  signInForm: join(here, "sign-in/form/form.tsx"),
  signUpCard: join(here, "sign-up/sign-up-card.tsx"),
  signUpForm: join(here, "sign-up/form/form.tsx"),
  ssoButtons: join(here, "sso/buttons/client.tsx"),
  ssoCallback: join(here, "sso/callback/client/client.tsx"),
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

/**
 * Every specifier a file imports **at runtime**.
 *
 * `import type` statements are stripped first: a wrapper imports the *type* of
 * its server action's input, which is erased at compile time and never reaches
 * a bundle.
 */
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
 * `next-intl`'s Next-only halves.
 *
 * The root entry is deliberately absent: it re-exports `use-intl`, which is
 * framework-free, and `apps/web` already renders core components that import it
 * (`ClientButton`, `AutoForm`). These four reach for Next's request scope, its
 * middleware or its build plugin - and `lib/navigation` is built on two of them.
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

describe("the import scan finds what it is looking for", () => {
  // Every assertion below is a "found nothing" one, which a scanner that
  // silently matches nothing also satisfies. The Next wrappers are the control:
  // they provably import the things the shared views must not.
  it("finds the Next-only imports in the Next wrappers", () => {
    expect(offenders(NEXT_WRAPPERS.signInForm, NEXT_INTL_RUNTIME)).not.toEqual(
      [],
    );
    expect(offenders(NEXT_WRAPPERS.ssoButtons, NEXT_ONLY)).not.toEqual([]);
  });

  it("walks past the entry file into its dependencies", () => {
    // `lib/navigation` is two hops from the wrapper, not one.
    expect(
      offenders(NEXT_WRAPPERS.card, ["next-intl/navigation"]).join(),
    ).toContain("next-link");
  });
});

describe("the shared auth views are framework-neutral", () => {
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
    // it. Every mutation on these screens is a prop instead.
    const reached = [...externalGraph(path).keys()];

    expect(reached.some(one => one.endsWith(".server"))).toBe(false);
    expect(runtimeImports(path).some(one => one.includes(".server"))).toBe(
      false,
    );
  });
});

describe("the shared views take their framework parts as props", () => {
  const withoutComments = (path: string): string =>
    readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  it("asks for a sign-in callback rather than calling a mutation", () => {
    const code = withoutComments(SHARED.signInForm);

    expect(code).toContain("onSignIn");
    expect(code).not.toContain("mutationApi");
  });

  it("asks for a provider callback rather than starting the flow itself", () => {
    const code = withoutComments(SHARED.ssoButtons);

    expect(code).toContain("onSelectProvider");
    expect(code).not.toContain("mutationApi");
  });

  it("takes its links as a component in every view that renders one", () => {
    for (const path of [
      SHARED.card,
      SHARED.signInForm,
      SHARED.signUpCard,
      SHARED.signUpForm,
      SHARED.ssoCallback,
    ]) {
      expect(withoutComments(path)).toContain("LinkComponent");
    }
  });

  it("asks for a sign-up callback rather than calling a mutation", () => {
    const code = withoutComments(SHARED.signUpForm);

    expect(code).toContain("onSignUp");
    expect(code).not.toContain("mutationApi");
  });

  it("asks for the two recovery mutations as callbacks", () => {
    expect(withoutComments(SHARED.passwordResetForm)).toContain(
      "onRequestReset",
    );
    expect(withoutComments(SHARED.changePasswordForm)).toContain(
      "onChangePassword",
    );
  });

  it("takes where to go after a password change as a callback", () => {
    // The API mints no session on a password change, so the visitor goes to the
    // login page - but `useRouter().replace` is Next-only and the router
    // navigation is TanStack-only, so the trip itself is the caller's.
    const code = withoutComments(SHARED.changePasswordForm);

    expect(code).toContain("onChanged");
    expect(code).not.toContain("useRouter");
  });

  it("takes an already-parsed recovery link rather than raw search params", () => {
    const code = withoutComments(SHARED.changePasswordForm);

    expect(code).toContain("link: RecoveryLink;");
    expect(code).not.toContain("userId: string");
  });

  it("renders the callback from a state rather than owning the request", () => {
    const code = withoutComments(SHARED.ssoCallback);

    expect(code).toContain("state: SSOCallbackState;");
    expect(code).not.toContain("useQuery");
  });

  it("keeps the error screen free of both translations and navigation", () => {
    const code = withoutComments(SHARED.errorScreen);

    expect(code).not.toContain("useTranslations");
    expect(code).toContain("actions?: React.ReactNode;");
  });
});

describe("the Next wrappers keep the Next-only pieces", () => {
  it("is the only half that knows about next-intl navigation", () => {
    expect(offenders(NEXT_WRAPPERS.card, ["next-intl/navigation"])).not.toEqual(
      [],
    );
    expect(offenders(SHARED.card, ["next-intl/navigation"])).toEqual([]);
  });

  it.each(
    Object.entries(NEXT_WRAPPERS).map(([name, path]) => ({ name, path })),
  )("the $name wrapper is where Next.js enters", ({ path }) => {
    expect(offenders(path, [...NEXT_ONLY, ...NEXT_INTL_RUNTIME])).not.toEqual(
      [],
    );
  });

  it("keeps the server actions on its own side", () => {
    for (const path of [
      NEXT_WRAPPERS.changePasswordForm,
      NEXT_WRAPPERS.passwordResetForm,
      NEXT_WRAPPERS.signInForm,
      NEXT_WRAPPERS.signUpForm,
      NEXT_WRAPPERS.ssoCallback,
    ]) {
      expect(
        runtimeImports(path).some(one => one.includes("mutation-api.server")),
      ).toBe(true);
    }
  });
});

/**
 * The settings screens, split the same way.
 *
 * `SettingsShell` was visually reusable and structurally Next-only: it read
 * `usePathname` to decide the narrow-screen behaviour, it imported `next-intl`'s
 * `Link` for the back link, and it imported the navigation, which read the same
 * pathname a second time for the active item. Three separate reasons a TanStack
 * Start layout route could not render it, and none of them visible in what it
 * looks like.
 *
 * What replaced them is one rule: the frame and the menu are *told* where the
 * visitor is and how to build a link. The assertions below are about that shape
 * as well as about the absence of a specifier, because a shared component can
 * also fail by taking the wrong thing as a prop.
 */
describe("the settings frame is told its framework parts", () => {
  const withoutComments = (path: string): string =>
    readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  it("takes the navigation as a slot and the back link as a component", () => {
    const code = withoutComments(SHARED.settingsShell);

    expect(code).toContain("nav: React.ReactNode;");
    expect(code).toContain("BackLink: AuthLinkComponent;");
  });

  it("takes where it is as a prop rather than asking", () => {
    // The one decision neither half can make for itself. `isSettingsRootPath`
    // and the active-item rule are shared; reading the pathname is not.
    for (const path of [SHARED.settingsShell, SHARED.settingsNav]) {
      expect(withoutComments(path)).not.toContain("usePathname");
    }

    expect(withoutComments(SHARED.settingsShell)).toContain("isRoot: boolean;");
    expect(withoutComments(SHARED.settingsNav)).toContain("pathname: string;");
  });

  it("takes its links as a component in the menu and in the breadcrumb", () => {
    for (const path of [SHARED.settingsNav, SHARED.breadcrumbTrail]) {
      expect(withoutComments(path)).toContain("LinkComponent");
    }
  });

  it("keeps the menu and the active-item rule as data, not markup", () => {
    // `settings-nav.ts` is what both frameworks agree through, so it must stay
    // free of React as well as of Next: a model that rendered would be a third
    // navigation nobody meant to have.
    const reached = [...externalGraph(SHARED.settingsNavModel).keys()];

    expect(reached).not.toContain("react");
    expect(reached.some(one => one.includes("intl"))).toBe(false);
    expect(withoutComments(SHARED.settingsNav)).toContain("settings-nav");
  });

  it("reads its strings from use-intl rather than from a request", () => {
    // The two panels were Server Components calling `getTranslations`, which is
    // what made a heading Next-only. The scans above pin the absence of that;
    // this pins what took its place, so a panel cannot pass by translating
    // nothing at all.
    for (const path of [SHARED.settingsOverview, SHARED.settingsSecurity]) {
      expect(runtimeImports(path)).toContain("use-intl");
    }
  });

  it("is the Next wrappers that know where the visitor is", () => {
    for (const path of [
      NEXT_WRAPPERS.settingsNav,
      NEXT_WRAPPERS.settingsShell,
    ]) {
      expect(withoutComments(path)).toContain("usePathname");
    }
  });
});
