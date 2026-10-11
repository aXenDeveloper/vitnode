import { afterEach, describe, expect, it } from "vitest";

import type { AdminTransport } from "./transport";

import { defaultAdminTransport } from "./default-transport";
import {
  adminTransport,
  hasAdminTransport,
  resetAdminTransport,
  setAdminTransport,
} from "./transport";

type TaggedTransport = AdminTransport & { readonly tag: string };

const transportOf = (tag: string): TaggedTransport => ({
  readAdminSession: async () => Promise.resolve({ status: "network_error" }),
  tag,
});

const tagOf = (transport: AdminTransport): string =>
  (transport as TaggedTransport).tag;

afterEach(() => {
  resetAdminTransport();
});

describe("an application that registers nothing", () => {
  it("still reads the session through the built-in default", () => {
    expect(adminTransport()).toBe(defaultAdminTransport);
    expect(adminTransport().readAdminSession).toBeTypeOf("function");
  });

  it("reports that nothing of its own is registered", () => {
    expect(hasAdminTransport()).toBe(false);
  });
});

describe("first registration", () => {
  it("hands back exactly what was registered", () => {
    const first = transportOf("first");

    setAdminTransport(first);

    expect(hasAdminTransport()).toBe(true);
    expect(adminTransport()).toBe(first);
  });
});

describe("a new registration after a hot reload", () => {
  it("answers with the newer function, not the one it replaced", () => {
    const before = transportOf("before");
    const after = transportOf("after");

    setAdminTransport(before);
    setAdminTransport(after);

    expect(adminTransport()).toBe(after);
    expect(tagOf(adminTransport())).toBe("after");
  });
});
