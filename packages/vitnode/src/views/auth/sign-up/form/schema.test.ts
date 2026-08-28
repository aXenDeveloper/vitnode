import { describe, expect, it } from "vitest";

import {
  createPasswordZodSchema,
  createSignUpFormSchema,
  signUpConflictReason,
  signUpFormOutcome,
} from "./schema";

const messages = {
  fieldRequired: "required",
  invalidEmail: "not an email",
  invalidPassword: "too weak",
  nameMaxLength: "too long",
  nameMinLength: "too short",
  termsRequired: "tick the box",
};

const schema = createSignUpFormSchema(messages);

const valid = {
  email: "test@test.com",
  name: "tester",
  password: "Test123!",
  terms: true,
};

describe("the sign-up schema", () => {
  it("accepts a complete registration", () => {
    const parsed = schema.safeParse(valid);

    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({
      email: "test@test.com",
      name: "tester",
      newsletter: false,
      password: "Test123!",
      terms: true,
    });
  });

  it.each([
    ["a name shorter than three characters", { name: "ab" }, "too short"],
    ["a name longer than 32 characters", { name: "a".repeat(33) }, "too long"],
    ["a value that is not an email address", { email: "test" }, "not an email"],
    ["an unticked terms checkbox", { terms: false }, "tick the box"],
  ])("rejects %s with the message it was given", (_case, patch, message) => {
    const parsed = schema.safeParse({ ...valid, ...patch });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(message);
  });

  it("defaults the fields AutoForm builds its initial values from", () => {
    // A field without a default renders as an uncontrolled input. `email` is
    // deliberately absent from this list: it has no default today, and
    // `AutoFormInput` covers it with `value={field.value ?? ""}`.
    expect(schema.shape.name.def.defaultValue).toBe("");
    expect(schema.shape.password.def.defaultValue).toBe("");
    expect(schema.shape.terms.def.defaultValue).toBe(false);
  });

  it("carries the messages it was built with, not a fixed language", () => {
    const polish = createSignUpFormSchema({
      ...messages,
      invalidEmail: "nieprawidłowy adres e-mail",
    });
    const parsed = polish.safeParse({ ...valid, email: "test" });

    expect(parsed.error?.issues[0]?.message).toBe("nieprawidłowy adres e-mail");
  });
});

describe("the password rules", () => {
  const password = createPasswordZodSchema({
    fieldRequired: "required",
    invalidPassword: "too weak",
  });

  it.each([
    ["Test123!", true],
    ["Sufficiently1Long!", true],
    // Eight characters, an uppercase, a digit and a non-word character are all
    // required - the four `.regex()` calls, one per row below.
    ["Test12!", false],
    ["test123!", false],
    ["TestTest!", false],
    ["Test1234", false],
  ])("reads %s as acceptable: %s", (value, expected) => {
    expect(password.safeParse(value).success).toBe(expected);
  });

  it("treats an underscore as a special character", () => {
    // `\W|_` - an underscore is a word character, so it needs the second half.
    expect(password.safeParse("Test123_").success).toBe(true);
  });

  it("says the same thing whichever rule failed", () => {
    // The live checklist in `PasswordInput` is what says *which* rule; the
    // message is the same one either way, which is why it is one string.
    for (const value of ["short1A!", "nouppercase1!", "NoDigits!"]) {
      const parsed = password.safeParse(value);
      if (parsed.success) continue;

      expect(parsed.error.issues[0]?.message).toBe("too weak");
    }
  });

  it("requires the field, with the message it was given", () => {
    expect(password.safeParse(undefined).success).toBe(true); // the default
    expect(password.safeParse(42).error?.issues[0]?.message).toBe("required");
  });
});

describe("classifying a 409", () => {
  it.each([
    ["Email already exists", "email_exists"],
    ["Name already exists", "name_exists"],
    // Case and surrounding whitespace are the API's business, not a reason to
    // fall back to the generic failure.
    ["  name already exists  ", "name_exists"],
  ])("reads %s as %s", (body, expected) => {
    expect(signUpConflictReason(body)).toBe(expected);
  });

  it.each([
    ['{"error":"Email already exists"}', "email_exists"],
    ['{"message":"Name already exists"}', "name_exists"],
    ['"Email already exists"', "email_exists"],
  ])("unwraps %s", (body, expected) => {
    // Hono's bare `HTTPException` answers with the message as plain text, but
    // VitNode's other conflict routes answer with JSON - both are recognised so
    // a change on the API's side does not silently degrade to a toast.
    expect(signUpConflictReason(body)).toBe(expected);
  });

  it.each([
    "",
    "Something else went wrong",
    "Name code already exists",
    "{}",
    "[1,2,3]",
    "not json {",
  ])("reads %s as unknown rather than guessing a field", body => {
    expect(signUpConflictReason(body)).toBe("unknown");
  });
});

describe("what a submit result means for the screen", () => {
  it("says nothing on success, which is how the form knows the caller is leaving", () => {
    expect(signUpFormOutcome(undefined)).toBeNull();
  });

  it("swaps the card for the confirmation screen, carrying the address", () => {
    expect(signUpFormOutcome({ emailConfirmation: "test@test.com" })).toEqual({
      email: "test@test.com",
      kind: "confirmation",
    });
  });

  it.each([
    ["email_exists", "email"],
    ["name_exists", "name"],
  ] as const)("marks the %s field", (message, field) => {
    expect(signUpFormOutcome({ message })).toEqual({ field, kind: "field" });
  });

  it("renders anything else as the internal-error toast", () => {
    expect(signUpFormOutcome({ message: "Internal Server Error" })).toEqual({
      kind: "toast",
    });
  });
});
