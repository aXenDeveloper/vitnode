// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { externalGraph, runtimeImports } from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

const SHARED = {
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

const sharedEntries = Object.entries(SHARED).map(([name, path]) => ({
  name,
  path,
}));

describe("the shared auth views are framework-neutral", () => {
  it.each(sharedEntries)(
    "$name never reaches a server-only module",
    ({ path }) => {
      // Importing one pulls the fetcher and the whole API module graph behind
      // it. Every mutation on these screens is a prop instead.
      const reached = [...externalGraph(path).keys()];

      expect(reached.some(one => one.endsWith(".server"))).toBe(false);
      expect(runtimeImports(path).some(one => one.includes(".server"))).toBe(
        false,
      );
    },
  );
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
    // login page - but router navigation belongs to the host, so the trip
    // itself is the caller's.
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

describe("the settings frame is told its framework parts", () => {
  const withoutComments = (path: string): string =>
    readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  it("takes the navigation as a slot", () => {
    expect(withoutComments(SHARED.settingsShell)).toContain(
      "nav: React.ReactNode;",
    );
  });

  it("takes where it is as a prop rather than asking", () => {
    // The one decision neither half can make for itself. The active-item rule
    // is shared; reading the pathname is not.
    for (const path of [SHARED.settingsShell, SHARED.settingsNav]) {
      expect(withoutComments(path)).not.toContain("usePathname");
    }

    expect(withoutComments(SHARED.settingsNav)).toContain("pathname: string;");
  });

  it("takes its links as a component in the menu", () => {
    expect(withoutComments(SHARED.settingsNav)).toContain("LinkComponent");
  });

  it("keeps the menu and the active-item rule as data, not markup", () => {
    // `settings-nav.ts` is what every host agrees through, so it must stay free
    // of React: a model that rendered would be a third navigation nobody meant
    // to have.
    const reached = [...externalGraph(SHARED.settingsNavModel).keys()];

    expect(reached).not.toContain("react");
    expect(reached.some(one => one.includes("intl"))).toBe(false);
    expect(withoutComments(SHARED.settingsNav)).toContain("settings-nav");
  });

  it("reads its strings from use-intl rather than from a request", () => {
    // A panel cannot pass the scans above by translating nothing at all.
    for (const path of [SHARED.settingsOverview, SHARED.settingsSecurity]) {
      expect(runtimeImports(path)).toContain("use-intl");
    }
  });
});
