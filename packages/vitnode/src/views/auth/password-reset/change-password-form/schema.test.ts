import { describe, expect, it } from "vitest";

import {
  changePasswordFormOutcome,
  createChangePasswordFormSchema,
} from "./schema";

const schema = createChangePasswordFormSchema({
  fieldRequired: "required",
  invalidPassword: "too weak",
});

describe("the change-password schema", () => {
  it("applies the registration form's password rules", () => {
    // Imported rather than restated, so this is really a test that the two
    // screens cannot drift apart on what a strong password is.
    expect(schema.safeParse({ password: "Test123!" }).success).toBe(true);
    expect(schema.safeParse({ password: "test" }).success).toBe(false);
  });

  it("rejects a weak password with the message it was given", () => {
    const parsed = schema.safeParse({ password: "test1234" });

    expect(parsed.error?.issues[0]?.message).toBe("too weak");
  });

  it("asks for nothing but the password", () => {
    // The token and the account id come from the URL, not from a field, which is
    // why they are not in this schema at all.
    expect(Object.keys(schema.shape)).toEqual(["password"]);
  });
});

describe("what a submit result means for the screen", () => {
  it("reads success as success, and leaves the navigation to the caller", () => {
    expect(changePasswordFormOutcome(undefined)).toEqual({ kind: "success" });
  });

  it("keeps an unusable link apart from a server failure", () => {
    // The visitor can act on the first (ask for a fresh link) and not on the
    // second, which is the whole reason the distinction survives this far.
    expect(changePasswordFormOutcome({ message: "invalid_token" })).toEqual({
      kind: "toast",
      reason: "invalid_token",
    });
    expect(
      changePasswordFormOutcome({ message: "internal_server_error" }),
    ).toEqual({ kind: "toast", reason: "server" });
  });
});
