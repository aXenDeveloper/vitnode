import { describe, expect, it } from "vitest";

import type { AdminNotificationType } from "./notifications-query";

import {
  applyPatch,
  choicesOf,
  emailPatch,
  isSentNowhere,
  listPatch,
} from "./type-policy";

const type = (
  overrides: Partial<AdminNotificationType> = {},
  policy: Partial<AdminNotificationType["policy"]> = {},
): AdminNotificationType => ({
  category: "content",
  defaults: { email: "daily", inApp: true },
  emailAvailable: true,
  emailSupported: true,
  grouped: false,
  id: "blog.article_published",
  label: "New article",
  mandatory: false,
  pluginId: "@vitnode/blog",
  version: 1,
  ...overrides,
  policy: {
    allowEmail: true,
    allowInApp: true,
    allowPush: true,
    email: null,
    enabled: true,
    inApp: null,
    memberCanEdit: true,
    ...policy,
  },
});

describe("choicesOf", () => {
  it("reads the installation policy, falling back to the type's defaults", () => {
    expect(choicesOf(type())).toEqual({
      email: "default_on",
      list: "default_on",
      memberCanEdit: true,
      push: "available",
    });
    expect(choicesOf(type({}, { email: "none", inApp: false }))).toMatchObject({
      email: "default_off",
      list: "default_off",
    });
  });

  it("shows a type switched off by the old on/off flag as disabled everywhere", () => {
    const choices = choicesOf(type({}, { enabled: false }));

    expect(choices).toMatchObject({
      email: "disabled",
      list: "disabled",
      push: "disabled",
    });
    expect(isSentNowhere(choices)).toBe(true);
  });

  it("keeps mandatory types in the list and locked for members", () => {
    expect(
      choicesOf(type({ mandatory: true }, { allowInApp: false })),
    ).toMatchObject({
      list: "default_on",
      memberCanEdit: false,
    });
  });

  it("has no email choice for a type without an email version", () => {
    expect(choicesOf(type({ emailSupported: false })).email).toBeNull();
  });
});

describe("patches", () => {
  it("turns a list choice into the policy flags the API stores", () => {
    expect(listPatch("disabled")).toEqual({ allowInApp: false, enabled: true });
    expect(listPatch("default_off")).toEqual({
      allowInApp: true,
      enabled: true,
      inApp: false,
    });
  });

  it("keeps the email frequency when email goes back to enabled by default", () => {
    expect(
      emailPatch("default_on", type({}, { email: "weekly" })),
    ).toMatchObject({
      email: "weekly",
    });
    expect(emailPatch("default_on", type({}, { email: "none" }))).toMatchObject(
      {
        email: "daily",
      },
    );
    expect(
      emailPatch(
        "default_on",
        type({ defaults: { email: "none", inApp: true } }, { email: "none" }),
      ),
    ).toMatchObject({ email: "immediate" });
  });

  it("applies a patch without dropping the rest of the policy", () => {
    const next = applyPatch(
      type({}, { allowPush: false }),
      listPatch("default_off"),
    );

    expect(next.policy).toMatchObject({ allowPush: false, inApp: false });
  });
});
