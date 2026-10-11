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

describe("the settings nav model stays data, not markup", () => {
  it("keeps the menu and the active-item rule free of React", () => {
    // `settings-nav.ts` is what every host agrees through, so it must stay free
    // of React: a model that rendered would be a third navigation nobody meant
    // to have.
    const reached = [...externalGraph(SHARED.settingsNavModel).keys()];

    expect(reached).not.toContain("react");
    expect(reached.some(one => one.includes("intl"))).toBe(false);
  });
});
