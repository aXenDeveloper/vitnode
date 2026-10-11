import { describe, expect, it } from "vitest";

import { createPasswordResetFormSchema } from "./schema";

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
});
