import { describe, expect, it } from "vitest";

import type { NotificationPreferenceTypeView } from "@/views/notifications/notifications-query";

import {
  emailChannelState,
  emailOffPatch,
  emailOnPatch,
  emailSnapshot,
} from "./email-channel";

const type = (
  id: string,
  overrides: Partial<NotificationPreferenceTypeView> = {},
): NotificationPreferenceTypeView => ({
  category: "content",
  categoryLabel: "Content",
  defaultEmail: "daily",
  description: null,
  emailModes: ["none", "immediate", "daily", "weekly"],
  id,
  inAppAvailable: true,
  label: id,
  locked: false,
  mandatory: false,
  pluginId: "@acme/forum",
  pushAvailable: true,
  value: { email: "daily", inApp: true, push: true },
  ...overrides,
});

const off = (
  id: string,
  overrides: Partial<NotificationPreferenceTypeView> = {},
) =>
  type(id, { value: { email: "none", inApp: true, push: true }, ...overrides });

describe("emailChannelState", () => {
  it("is on while any type the member can change still emails", () => {
    expect(emailChannelState([off("a"), type("b")])).toBe("on");
  });

  it("is off when every changeable type is set to no email", () => {
    expect(emailChannelState([off("a"), off("b")])).toBe("off");
  });

  it("ignores locked types, which keep emailing whatever the member does", () => {
    expect(emailChannelState([off("a"), type("b", { locked: true })])).toBe(
      "off",
    );
  });

  it("is unavailable when no type can email at all", () => {
    expect(emailChannelState([type("a", { emailModes: [] })])).toBe(
      "unavailable",
    );
  });
});

describe("turning email off and on again", () => {
  it("brings back exactly what the member had before switching it off", () => {
    const types = [
      type("a", { value: { email: "weekly", inApp: true, push: true } }),
      off("b"),
      type("c", { value: { email: "immediate", inApp: true, push: true } }),
    ];
    const before = emailSnapshot(types);

    expect(emailOffPatch(types)).toEqual({
      a: { email: "none" },
      b: { email: "none" },
      c: { email: "none" },
    });
    expect(
      emailOnPatch(
        types.map(item => off(item.id)),
        before,
      ),
    ).toEqual({
      a: { email: "weekly" },
      b: { email: "daily" },
      c: { email: "immediate" },
    });
  });

  it("falls back to the installation default when nothing was saved", () => {
    expect(
      emailOnPatch([off("a", { defaultEmail: "weekly" }), off("b")], null),
    ).toEqual({ a: { email: "weekly" }, b: { email: "daily" } });
  });

  it("picks the daily digest when the default sends no email, so switching on always does something", () => {
    expect(emailOnPatch([off("a", { defaultEmail: "none" })], null)).toEqual({
      a: { email: "daily" },
    });
  });

  it("leaves locked types alone", () => {
    expect(emailOnPatch([off("a"), off("b", { locked: true })], null)).toEqual({
      a: { email: "daily" },
    });
  });
});
