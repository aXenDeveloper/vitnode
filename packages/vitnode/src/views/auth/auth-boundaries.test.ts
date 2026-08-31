// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { externalGraph, runtimeImports } from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The auth screens, and the props each one takes instead of a framework.
 *
 * Every screen here is a card with a form in it, and the interesting thing about
 * all of them is what they refuse to own: no mutation, no router, no request.
 * The sign-in gets `onSignIn`, the SSO buttons get `onSelectProvider`, the
 * settings frame gets told where the visitor is. That shape is what this file
 * asserts, and it has to read the source to do it - a component can also fail by
 * taking the *wrong* thing as a prop, which no reachability walk can see.
 *
 * The walk that used to sit above this - reaches nothing from `next/*`, from
 * `next-intl`, from a server action, over all eighteen entry points - is now
 * `next-boundary.test.ts`'s, asserted over every file in the package.
 */
const SHARED = {
  breadcrumbTrail: join(here, "../breadcrumb/breadcrumb-main-content.tsx"),
  card: join(here, "sign-in/sign-in-content.tsx"),
  changePasswordForm: join(
    here,
    "password-reset/change-password-form/change-password-form-content.tsx",
  ),
  errorScreen: join(here, "../error/error-content.tsx"),
  passwordResetForm: join(
    here,
    "password-reset/form/password-reset-form-content.tsx",
  ),
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
};

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
 * rather than about the absence of a specifier, because a shared component can
 * fail by taking the wrong thing as a prop and no import scan sees that.
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
    // The one decision the frame cannot make for itself. `isSettingsRootPath`
    // and the active-item rule are shared; reading the pathname is not.
    //
    // This is also the invariant that outlived the wrappers. `usePathname` used
    // to live in the Next.js halves so the shared frame could stay ignorant of
    // it; with those gone, being handed `isRoot`/`pathname` is exactly what
    // tempts somebody to read the pathname here instead and drop a prop.
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
});
