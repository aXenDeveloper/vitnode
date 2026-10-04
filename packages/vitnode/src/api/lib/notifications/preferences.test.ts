import { describe, expect, it } from "vitest";
import { z } from "zod";

import { resolveNotificationChannels } from "./preferences";
import { buildNotificationType } from "./registry";

const type = buildNotificationType({
  category: "social",
  defaults: { email: "daily", inApp: true },
  email: true,
  id: "blog.comment",
  label: "x",
  present: () => ({ title: "t" }),
  schema: z.object({}),
  version: 1,
});
const mandatory = { ...type, mandatory: true };
const noEmail = {
  ...type,
  defaults: { email: "none" as const, inApp: true },
  email: false,
};

const resolve = (
  args: Partial<Parameters<typeof resolveNotificationChannels>[0]>,
) =>
  resolveNotificationChannels({
    definition: type,
    emailConfigured: true,
    muted: false,
    ...args,
  });

describe("resolveNotificationChannels", () => {
  it("falls back from the user, to the installation, to the type", () => {
    expect(resolve({})).toEqual({ email: "daily", inApp: true });
    expect(resolve({ policy: { email: "weekly", inApp: false } })).toEqual({
      email: "weekly",
      inApp: false,
    });
    expect(
      resolve({
        policy: { email: "weekly", inApp: false },
        preference: { email: "immediate", inApp: true },
      }),
    ).toEqual({ email: "immediate", inApp: true });
  });

  it("lets a mute beat the user's own preferences", () => {
    expect(
      resolve({ muted: true, preference: { email: "immediate", inApp: true } }),
    ).toEqual({ email: "none", inApp: false });
  });

  it("lets installation policy beat everything but mandatory types", () => {
    expect(
      resolve({ policy: { enabled: false }, preference: { inApp: true } }),
    ).toEqual({
      email: "none",
      inApp: false,
    });
    expect(
      resolve({
        definition: mandatory,
        muted: true,
        policy: { enabled: false },
      }),
    ).toEqual({ email: "daily", inApp: true });
  });

  it("only offers email where the type, installation and policy all allow it", () => {
    expect(
      resolve({ emailConfigured: false, preference: { email: "immediate" } })
        .email,
    ).toBe("none");
    expect(resolve({ policy: { allowEmail: false } }).email).toBe("none");
    expect(
      resolve({ definition: noEmail, preference: { email: "daily" } }).email,
    ).toBe("none");
  });

  it("keeps email independent from the in-app choice", () => {
    expect(resolve({ preference: { inApp: false } })).toEqual({
      email: "daily",
      inApp: false,
    });
  });

  it("ignores the member's own choice when the type is locked for members", () => {
    expect(
      resolve({
        policy: { email: "weekly", inApp: false, memberCanEdit: false },
        preference: { email: "immediate", inApp: true },
      }),
    ).toEqual({ email: "weekly", inApp: false });
  });

  it("keeps a type out of the notification list when in-app is disabled", () => {
    expect(
      resolve({
        policy: { allowInApp: false },
        preference: { inApp: true },
      }),
    ).toEqual({ email: "daily", inApp: false });
    expect(
      resolve({ definition: mandatory, policy: { allowInApp: false } }).inApp,
    ).toBe(true);
  });
});
