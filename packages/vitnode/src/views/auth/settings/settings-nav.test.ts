import { describe, expect, it } from "vitest";

import { visibleSettingsNavItems } from "./settings-nav";

describe("visibleSettingsNavItems", () => {
  it("shows Security while passkeys are on", () => {
    expect(
      visibleSettingsNavItems({ passkeys: true }).map(item => item.key),
    ).toEqual(["overview", "notifications", "devices", "security"]);
  });

  it("hides Security when passkeys are switched off", () => {
    expect(
      visibleSettingsNavItems({ passkeys: false }).map(item => item.key),
    ).toEqual(["overview", "notifications", "devices"]);
  });

  it("shows Connected accounts only while an SSO provider is configured", () => {
    expect(
      visibleSettingsNavItems({
        passkeys: false,
        sso: [{ id: "google", name: "Google" }],
      }).map(item => item.key),
    ).toEqual(["overview", "notifications", "devices", "sso"]);
    expect(
      visibleSettingsNavItems({ passkeys: false, sso: [] }).map(
        item => item.key,
      ),
    ).toEqual(["overview", "notifications", "devices"]);
  });

  it("shows AI usage only while the site has an AI model configured", () => {
    expect(
      visibleSettingsNavItems({
        ai: { models: [{ id: "fast" }] },
        passkeys: false,
      }).map(item => item.key),
    ).toEqual(["overview", "notifications", "devices", "ai"]);
    expect(
      visibleSettingsNavItems({ ai: { models: [] }, passkeys: false }).map(
        item => item.key,
      ),
    ).toEqual(["overview", "notifications", "devices"]);
  });
});
