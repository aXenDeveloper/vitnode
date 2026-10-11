import { describe, expect, it } from "vitest";

import { createSignInFormSchema } from "./schema";

const schema = createSignInFormSchema({
  invalidEmail: "not an email",
  passwordRequired: "password missing",
});

describe("the sign-in schema", () => {
  it("accepts an email address and a password", () => {
    const parsed = schema.safeParse({
      email: "test@test.com",
      password: "Test123!",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({
      email: "test@test.com",
      password: "Test123!",
    });
  });

  it("rejects a value that is not an email address, with the message it was given", () => {
    const parsed = schema.safeParse({ email: "test", password: "Test123!" });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("not an email");
  });

  it("rejects an empty password, with the message it was given", () => {
    const parsed = schema.safeParse({ email: "test@test.com", password: "" });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("password missing");
  });
});
