import { describe, expect, it } from "vitest";

import { createSignInFormSchema, signInFormOutcome } from "./schema";

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

  it("defaults both fields to empty strings", () => {
    // What `AutoForm` reads out of the JSON schema to build its default values.
    // A field without one renders as an uncontrolled input and warns the first
    // time it is typed into.
    expect(schema.parse({ email: "a@b.com", password: "x" })).toBeDefined();
    expect(schema.shape.email.def.defaultValue).toBe("");
    expect(schema.shape.password.def.defaultValue).toBe("");
  });

  it("carries the messages it was built with, not a fixed language", () => {
    const polish = createSignInFormSchema({
      invalidEmail: "nieprawidłowy adres e-mail",
      passwordRequired: "hasło jest wymagane",
    });

    expect(
      polish.safeParse({ email: "test", password: "x" }).error?.issues[0]
        ?.message,
    ).toBe("nieprawidłowy adres e-mail");
  });
});

describe("reading a sign-in result", () => {
  it("says nothing happened when the mutation returned nothing", () => {
    // The happy path in both frameworks: the caller redirected, so the promise
    // resolves to `undefined` and there is no failure to render.
    expect(signInFormOutcome(undefined)).toBeNull();
  });

  it("shows a denial in the form rather than as a toast", () => {
    expect(signInFormOutcome({ message: "access_denied" })).toEqual({
      error: "access_denied",
      kind: "field",
    });
  });

  it("shows a server error as a toast rather than in the form", () => {
    expect(signInFormOutcome({ message: "Internal Server Error" })).toEqual({
      kind: "toast",
    });
  });
});
