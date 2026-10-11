import { describe, expect, it } from "vitest";

import { createChangePasswordFormSchema } from "./schema";

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

  it("asks for nothing but the password", () => {
    // The token and the account id come from the URL, not from a field, which is
    // why they are not in this schema at all.
    expect(Object.keys(schema.shape)).toEqual(["password"]);
  });
});
