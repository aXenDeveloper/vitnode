import { describe, expect, it } from "vitest";

import type { UserPersonalInformation } from "@/lib/user-personal-information";

import { resolvePersonalInformationFields } from "@/lib/user-personal-information";

import { profileChanges } from "./profile-changes";

const user: UserPersonalInformation = {
  firstName: "Ada",
  headline: null,
  lastName: "Lovelace",
  phone: null,
  showRealName: true,
};

const allFields = resolvePersonalInformationFields();

const unchanged = {
  firstName: "Ada",
  headline: "",
  lastName: "Lovelace",
  phone: "",
  showRealName: true,
  timeZone: "Europe/Warsaw",
};

describe("profileChanges", () => {
  it("reports nothing when the form still holds the saved values", () => {
    expect(
      profileChanges({
        canEdit: true,
        fields: allFields,
        initialTimeZone: "Europe/Warsaw",
        user,
        values: unchanged,
      }),
    ).toEqual({ personal: null });
  });

  it("sends only the personal fields that changed, trimmed and emptied to null", () => {
    expect(
      profileChanges({
        canEdit: true,
        fields: allFields,
        initialTimeZone: "Europe/Warsaw",
        user,
        values: {
          ...unchanged,
          lastName: "  ",
          phone: " +48 600 700 800 ",
          showRealName: false,
        },
      }).personal,
    ).toEqual({
      lastName: null,
      phone: "+48 600 700 800",
      showRealName: false,
    });
  });

  it("sends the time zone only when it moved away from the starting value", () => {
    expect(
      profileChanges({
        canEdit: true,
        fields: allFields,
        initialTimeZone: "Europe/Warsaw",
        user,
        values: { ...unchanged, timeZone: "America/New_York" },
      }),
    ).toEqual({ personal: null, timeZone: "America/New_York" });
  });

  it("ignores personal fields the role cannot edit or the install switched off", () => {
    const values = { ...unchanged, firstName: "Augusta", phone: "123" };

    expect(
      profileChanges({
        canEdit: false,
        fields: allFields,
        initialTimeZone: "Europe/Warsaw",
        user,
        values,
      }).personal,
    ).toBeNull();
    expect(
      profileChanges({
        canEdit: true,
        fields: { ...allFields, phone: false },
        initialTimeZone: "Europe/Warsaw",
        user,
        values,
      }).personal,
    ).toEqual({ firstName: "Augusta" });
  });
});
