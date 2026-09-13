import { describe, expect, it } from "vitest";

import { resolvePersonalInformationFields } from "@/lib/user-personal-information";

import { effectivePersonalInfoPolicy } from "./personal-info-policy";

const allFields = resolvePersonalInformationFields();
const policyOf = (
  roles: { allowEditPersonalInfo: boolean }[],
  fields = allFields,
) => effectivePersonalInfoPolicy(roles, fields).canEdit;

describe("whether a visitor may edit their own personal information", () => {
  it("says yes when their one role allows it", () => {
    expect(policyOf([{ allowEditPersonalInfo: true }])).toBe(true);
  });

  it("says no when their one role forbids it", () => {
    expect(policyOf([{ allowEditPersonalInfo: false }])).toBe(false);
  });

  it("lets one role that forbids it override the rest", () => {
    // The opposite of the image rule, and deliberately so. This column defaults
    // to `true`, so under "any role grants" an administrator who switched it off
    // on one role would find it silently re-granted by every other role the
    // member happens to hold - the setting would almost never take effect.
    expect(
      policyOf([
        { allowEditPersonalInfo: false },
        { allowEditPersonalInfo: true },
      ]),
    ).toBe(false);
  });

  it("allows it when every role the visitor holds allows it", () => {
    expect(
      policyOf([
        { allowEditPersonalInfo: true },
        { allowEditPersonalInfo: true },
      ]),
    ).toBe(true);
  });

  it("says no when the visitor holds no role at all", () => {
    expect(policyOf([])).toBe(false);
  });

  it("says no when the install has switched every field off", () => {
    // Otherwise the card would offer an Edit button that opens an empty form.
    expect(
      policyOf([{ allowEditPersonalInfo: true }], {
        firstName: false,
        headline: false,
        lastName: false,
        phone: false,
        showRealName: false,
      }),
    ).toBe(false);
  });

  it("says yes while one field is still on", () => {
    expect(
      policyOf([{ allowEditPersonalInfo: true }], {
        firstName: false,
        headline: true,
        lastName: false,
        phone: false,
        showRealName: false,
      }),
    ).toBe(true);
  });
});
