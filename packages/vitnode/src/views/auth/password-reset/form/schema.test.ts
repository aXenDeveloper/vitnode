import { describe, expect, it } from "vitest";

import {
  createPasswordResetFormSchema,
  passwordResetFormOutcome,
} from "./schema";

const schema = createPasswordResetFormSchema({ invalidEmail: "not an email" });

describe("the reset-request schema", () => {
  it("accepts an email address", () => {
    expect(schema.parse({ email: "test@test.com" })).toEqual({
      email: "test@test.com",
    });
  });

  it("rejects a value that is not an email address, with the message it was given", () => {
    const parsed = schema.safeParse({ email: "test" });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("not an email");
  });

  it("defaults the field, so AutoForm renders a controlled input", () => {
    expect(schema.shape.email.def.defaultValue).toBe("");
  });
});

describe("what a submit result means for the screen", () => {
  it("shows the confirmation screen for an accepted request", () => {
    expect(passwordResetFormOutcome(undefined)).toEqual({
      kind: "confirmation",
    });
  });

  it("has no outcome that could mean the address does not exist", () => {
    // The anti-enumeration property, stated as a test: the API answers the same
    // 201 either way, so the only two outcomes are "accepted" and "the request
    // failed". A third would be a leak.
    expect(passwordResetFormOutcome(undefined).kind).toBe("confirmation");
    expect(
      passwordResetFormOutcome({ message: "Internal Server Error" }).kind,
    ).toBe("toast");
  });
});
