import { describe, expect, it } from "vitest";

import type {
  SsoConnectionProvider,
  SsoProfileSources,
} from "./sso-connections-query";

import {
  previewFieldState,
  sourcedFieldsOf,
  sourceOptionsFor,
} from "./profile-field-state";

const provider = (
  id: string,
  profileFields: SsoConnectionProvider["profileFields"],
  { available = true, connected = true } = {},
): SsoConnectionProvider => ({
  available,
  connection: connected
    ? {
        accountLabel: null,
        connectedAt: "2026-09-01T10:00:00.000Z",
        email: null,
        syncOnSignIn: false,
      }
    : null,
  icon: null,
  id,
  name: id,
  profileFields,
});

const GOOGLE = provider("google", ["avatar", "firstName", "lastName"]);
const DISCORD = provider("discord", ["avatar"]);
const SOURCES: SsoProfileSources = {
  avatar: "discord",
  firstName: "google",
  lastName: null,
};

describe("which accounts can supply a field", () => {
  const providers = [
    GOOGLE,
    DISCORD,
    provider("facebook", ["avatar", "firstName"], { connected: false }),
    provider("gone", ["firstName"], { available: false }),
  ];

  it("offers only connected, available accounts that support the field", () => {
    expect(sourceOptionsFor("avatar", providers).map(one => one.id)).toEqual([
      "google",
      "discord",
    ]);
    expect(sourceOptionsFor("firstName", providers).map(one => one.id)).toEqual(
      ["google"],
    );
  });
});

describe("what Sync now would update", () => {
  it("lists the fields that follow the account", () => {
    expect(sourcedFieldsOf(GOOGLE, SOURCES)).toEqual(["firstName"]);
    expect(sourcedFieldsOf(DISCORD, SOURCES)).toEqual(["avatar"]);
  });
});

describe("what an import preview lets the member do with a field", () => {
  const field = {
    allowed: true,
    current: "Alicja",
    field: "firstName" as const,
    incoming: "Alice",
    source: null,
  };

  it("offers a value that arrived and may be changed", () => {
    expect(previewFieldState(field)).toBe("selectable");
  });

  it("says when the provider sent nothing, before any permission question", () => {
    expect(
      previewFieldState({ ...field, allowed: false, incoming: null }),
    ).toBe("missing");
  });

  it("says when the member's role may not change it", () => {
    expect(previewFieldState({ ...field, allowed: false })).toBe("not_allowed");
  });
});
