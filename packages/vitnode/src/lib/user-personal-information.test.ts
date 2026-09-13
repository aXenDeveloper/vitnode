import { describe, expect, it } from "vitest";

import {
  displayNameOf,
  fullNameOf,
  normalizePersonalField,
  personalInformationChanges,
  resolvePersonalInformationFields,
  USER_PHONE_PATTERN,
} from "./user-personal-information";

describe("one personal field on its way to the column", () => {
  it.each([
    ["Emirhan", "Emirhan"],
    ["  Emirhan  ", "Emirhan"],
    ["", null],
    ["   ", null],
  ])("turns %j into %j", (input, expected) => {
    expect(normalizePersonalField(input)).toBe(expected);
  });

  it.each([undefined, null, 42, {}, ["Emirhan"]])(
    "refuses %j, because a PATCH body is network input",
    value => {
      expect(normalizePersonalField(value)).toBeNull();
    },
  );
});

describe("which columns a PATCH body actually writes", () => {
  it("writes only the fields the caller sent", () => {
    expect(personalInformationChanges({ firstName: "Emirhan" })).toEqual({
      firstName: "Emirhan",
    });
  });

  it("keeps a field the caller cleared, as null rather than an empty string", () => {
    // A column of empty strings and a column of nulls are two ways to say
    // "unset", and only one of them renders as the placeholder.
    expect(personalInformationChanges({ headline: "  " })).toEqual({
      headline: null,
    });
  });

  it("takes the switch only when it really is a boolean", () => {
    expect(personalInformationChanges({ showRealName: true })).toEqual({
      showRealName: true,
    });
    expect(personalInformationChanges({ showRealName: false })).toEqual({
      showRealName: false,
    });
    expect(personalInformationChanges({ showRealName: "yes" })).toEqual({});
  });

  it("ignores anything that is not a personal field", () => {
    expect(
      personalInformationChanges({
        firstName: "Emirhan",
        roleId: 1,
      } as Record<string, unknown>),
    ).toEqual({ firstName: "Emirhan" });
  });

  it("writes nothing for an empty body", () => {
    expect(personalInformationChanges({})).toEqual({});
  });

  it("refuses a field the install has switched off", () => {
    // The form does not offer it, but a PATCH body is network input.
    expect(
      personalInformationChanges(
        { firstName: "Emirhan", headline: "Team Manager", showRealName: true },
        resolvePersonalInformationFields({
          headline: false,
          showRealName: false,
        }),
      ),
    ).toEqual({ firstName: "Emirhan" });
  });
});

describe("what counts as a phone number", () => {
  it.each([
    "+48 600 700 800",
    "600700800",
    "(022) 123-45-67",
    "+1 (555) 010-9999",
  ])("accepts %j", value => {
    expect(USER_PHONE_PATTERN.test(value)).toBe(true);
  });

  it.each(["call me", "600-700-800 ext. 4", "<script>", "600@700"])(
    "rejects %j",
    value => {
      expect(USER_PHONE_PATTERN.test(value)).toBe(false);
    },
  );
});

describe("which personal fields an install offers", () => {
  it("offers all of them by default", () => {
    expect(resolvePersonalInformationFields()).toEqual({
      firstName: true,
      headline: true,
      lastName: true,
      phone: true,
      showRealName: true,
    });
  });

  it("turns off only what the config says `false`", () => {
    expect(resolvePersonalInformationFields({ headline: false })).toEqual({
      firstName: true,
      headline: false,
      lastName: true,
      phone: true,
      showRealName: true,
    });
  });

  it("treats an omitted field as on, so adding a field never hides it", () => {
    expect(
      resolvePersonalInformationFields({ firstName: undefined }).firstName,
    ).toBe(true);
  });
});

describe("the real name, from the two halves that may be missing", () => {
  it.each([
    [{ firstName: "Emirhan", lastName: "Boruch" }, "Emirhan Boruch"],
    [{ firstName: "Emirhan", lastName: null }, "Emirhan"],
    [{ firstName: null, lastName: "Boruch" }, "Boruch"],
    [{ firstName: null, lastName: null }, null],
    [{ firstName: "  ", lastName: "Boruch" }, "Boruch"],
  ])("reads %j as %j", (parts, expected) => {
    expect(fullNameOf(parts)).toBe(expected);
  });
});

describe("which name the public sees", () => {
  const account = {
    firstName: "Emirhan",
    lastName: "Boruch",
    name: "aXen",
  };

  it("is the nickname while the switch is off", () => {
    expect(displayNameOf({ ...account, showRealName: false })).toBe("aXen");
  });

  it("is the real name once the switch is on", () => {
    expect(displayNameOf({ ...account, showRealName: true })).toBe(
      "Emirhan Boruch",
    );
  });

  it("falls back to the nickname when the switch is on but no name is set", () => {
    // Otherwise turning the switch on before filling the fields in would leave
    // the profile with an empty heading.
    expect(
      displayNameOf({
        firstName: null,
        lastName: null,
        name: "aXen",
        showRealName: true,
      }),
    ).toBe("aXen");
  });

  it("uses whichever half is filled in", () => {
    expect(
      displayNameOf({ ...account, lastName: null, showRealName: true }),
    ).toBe("Emirhan");
  });
});
