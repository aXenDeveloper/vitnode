import { describe, expect, it } from "vitest";

import { visibleSettingsNavItems } from "./settings-nav";

describe("visibleSettingsNavItems", () => {
  it("shows Security while passkeys are on", () => {
    expect(
      visibleSettingsNavItems({ passkeys: true }).map(item => item.key),
    ).toEqual(["overview", "devices", "security"]);
  });

  it("hides Security when passkeys are switched off", () => {
    expect(
      visibleSettingsNavItems({ passkeys: false }).map(item => item.key),
    ).toEqual(["overview", "devices"]);
  });
});
