// @vitest-environment node
import type { Context } from "hono";

import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import type { EnvVariablesVitNode } from "@/api/middlewares/global.middleware";

import { core_admin_permissions } from "@/database/admins";
import { core_sessions_known_devices } from "@/database/sessions";
import { parseSetCookies } from "@/lib/fetcher/set-cookie";

// `checkIfUserIsAdmin` resolves the user before it looks at permissions, and
// that path is a module of its own with no bearing on cookie attributes.
vi.mock("./user", () => ({
  UserModel: class {
    getUserById = async () =>
      await Promise.resolve({ id: 7, roleId: 1, name: "Test" });
  },
}));

const { DeviceModel } = await import("./device");
const { SessionModel } = await import("./session");
const { SessionAdminModel } = await import("./session-admin");

type Authorization = EnvVariablesVitNode["core"]["authorization"];

const AUTHORIZATION: Authorization = {
  adminCookieExpires: 1000 * 60 * 60 * 24,
  adminCookieName: "vitnode_auth_admin",
  cookieDomain: undefined,
  cookie_expires: 1000 * 60 * 60 * 24 * 90,
  cookieName: "vitnode_auth",
  cookieSecure: true,
  deviceCookieExpires: 1000 * 60 * 60 * 24 * 365,
  deviceCookieName: "vitnode_device",
  ssoAdapters: [],
};

/**
 * A Drizzle stand-in: every builder method returns the same chainable object,
 * and awaiting it hands back rows chosen by the operation and table.
 *
 * These tests are about the `Set-Cookie` a model emits, so the queries only have
 * to resolve - not to be right.
 */
const fakeDb = () => {
  const chain = (kind: string, table: unknown) => {
    const op = { kind, table };
    const rows = (): unknown[] => {
      if (op.kind === "insert" && op.table === core_sessions_known_devices) {
        return [{ id: 1 }];
      }
      if (op.kind === "select" && op.table === core_sessions_known_devices) {
        // No stored device: the model mints one, which is the case that writes
        // the device cookie.
        return [];
      }
      if (op.kind === "select" && op.table === core_admin_permissions) {
        return [{ id: 1 }];
      }

      return [];
    };

    const self = {
      from: (table: unknown) => {
        op.table = table;

        return self;
      },
      limit: () => self,
      returning: () => self,
      set: () => self,
      then: async (onFulfilled: (value: unknown[]) => unknown) =>
        await Promise.resolve(onFulfilled(rows())),
      values: () => self,
      where: () => self,
    };

    return self;
  };

  return {
    delete: (table: unknown) => chain("delete", table),
    insert: (table: unknown) => chain("insert", table),
    select: () => chain("select", undefined),
    update: (table: unknown) => chain("update", table),
  };
};

const fakeCache = () => ({
  deleteSystem: async () => await Promise.resolve(),
  getSystem: async () => await Promise.resolve(null),
  setSystem: async () => await Promise.resolve(),
});

/**
 * Runs `act` inside a real request, and hands back every `Set-Cookie` the
 * response carries - what the browser is actually told to do.
 */
const setCookiesFrom = async ({
  authorization = {},
  cookie,
  url = "https://web-git-feat-abc123.vercel.app/api/@vitnode/core/users/sign_in",
  act,
}: {
  act: (c: Context) => Promise<unknown>;
  authorization?: Partial<Authorization>;
  cookie?: string;
  url?: string;
}): Promise<string[]> => {
  const app = new Hono();

  app.all("*", async c => {
    c.set("core", {
      authorization: { ...AUTHORIZATION, ...authorization },
    } as EnvVariablesVitNode["core"]);
    c.set("db", fakeDb() as unknown as EnvVariablesVitNode["db"]);
    c.set("cache", fakeCache() as unknown as EnvVariablesVitNode["cache"]);
    c.set("ipAddress", "203.0.113.7");

    await act(c);

    return c.body(null, 204);
  });

  const response = await app.request(url, {
    headers: cookie === undefined ? {} : { cookie },
  });

  return response.headers.getSetCookie();
};

/** The cookie named `name`, parsed, out of everything the response set. */
const named = (headers: string[], name: string) => {
  const found = parseSetCookies(headers).find(entry => entry.name === name);
  if (!found) throw new Error(`no ${name} cookie in ${headers.join(" | ")}`);

  return found;
};

const HOSTS = [
  ["localhost", "http://localhost:3001/api/x"],
  ["a production hostname", "https://vitnode.com/api/x"],
  [
    "a generated preview hostname",
    "https://web-git-feat-abc123.vercel.app/api/x",
  ],
] as const;

describe("session cookie", () => {
  const create = async (c: Context) =>
    await new SessionModel(c).createSessionByUserId(7);
  const remove = async (c: Context) =>
    await new SessionModel(c).deleteSession();

  it.each(HOSTS)("is host-only on %s", async (_label, url) => {
    const cookie = named(
      await setCookiesFrom({ act: create, url }),
      AUTHORIZATION.cookieName,
    );

    expect(cookie.options.domain).toBe(undefined);
    expect(cookie.options.path).toBe("/");
  });

  it("is deleted with the attributes it was created with", async () => {
    const created = named(
      await setCookiesFrom({ act: create }),
      AUTHORIZATION.cookieName,
    );
    const deleted = named(
      await setCookiesFrom({ act: remove, cookie: "vitnode_auth=token" }),
      AUTHORIZATION.cookieName,
    );

    expect(deleted.options.domain).toBe(created.options.domain);
    expect(deleted.options.path).toBe(created.options.path);
    // And it is a deletion, not a blanking: `Max-Age=0` is what makes the
    // browser drop it rather than hold an empty value for the session.
    expect(deleted.options.maxAge).toBe(0);
    expect(deleted.value).toBe("");
  });

  it("carries an explicit cookieDomain on both sides", async () => {
    const authorization = { cookieDomain: ".example.com" };
    const created = named(
      await setCookiesFrom({ act: create, authorization }),
      AUTHORIZATION.cookieName,
    );
    const deleted = named(
      await setCookiesFrom({
        act: remove,
        authorization,
        cookie: "vitnode_auth=token",
      }),
      AUTHORIZATION.cookieName,
    );

    expect(created.options.domain).toBe(".example.com");
    expect(deleted.options.domain).toBe(".example.com");
  });
});

describe("admin session cookie", () => {
  const create = async (c: Context) =>
    await new SessionAdminModel(c).createSessionByUserId(7);
  const remove = async (c: Context) =>
    await new SessionAdminModel(c).deleteSession();

  it.each(HOSTS)("is host-only on %s", async (_label, url) => {
    const cookie = named(
      await setCookiesFrom({ act: create, url }),
      AUTHORIZATION.adminCookieName,
    );

    expect(cookie.options.domain).toBe(undefined);
    expect(cookie.options.path).toBe("/");
  });

  it("is deleted with the attributes it was created with", async () => {
    const created = named(
      await setCookiesFrom({ act: create }),
      AUTHORIZATION.adminCookieName,
    );
    const deleted = named(
      await setCookiesFrom({
        act: remove,
        cookie: "vitnode_auth_admin=token",
      }),
      AUTHORIZATION.adminCookieName,
    );

    expect(deleted.options.domain).toBe(created.options.domain);
    expect(deleted.options.path).toBe(created.options.path);
    expect(deleted.options.maxAge).toBe(0);
    expect(deleted.value).toBe("");
  });

  it("carries an explicit cookieDomain on both sides", async () => {
    const authorization = { cookieDomain: ".example.com" };
    const created = named(
      await setCookiesFrom({ act: create, authorization }),
      AUTHORIZATION.adminCookieName,
    );
    const deleted = named(
      await setCookiesFrom({
        act: remove,
        authorization,
        cookie: "vitnode_auth_admin=token",
      }),
      AUTHORIZATION.adminCookieName,
    );

    expect(created.options.domain).toBe(".example.com");
    expect(deleted.options.domain).toBe(".example.com");
  });
});

describe("device cookie", () => {
  const create = async (c: Context) => await new DeviceModel(c).getDeviceId();

  it.each(HOSTS)("is host-only on %s", async (_label, url) => {
    const cookie = named(
      await setCookiesFrom({ act: create, url }),
      AUTHORIZATION.deviceCookieName,
    );

    expect(cookie.options.domain).toBe(undefined);
    expect(cookie.options.path).toBe("/");
  });

  it("carries an explicit cookieDomain", async () => {
    const cookie = named(
      await setCookiesFrom({
        act: create,
        authorization: { cookieDomain: ".example.com" },
      }),
      AUTHORIZATION.deviceCookieName,
    );

    expect(cookie.options.domain).toBe(".example.com");
  });
});

describe("every auth cookie goes through the shared helper", () => {
  // The invariant the rest of this file rests on. A raw `setCookie` reintroduces
  // the `domain` argument these tests exist to keep out, and a raw
  // `deleteCookie` reintroduces the create/delete mismatch that leaves a cookie
  // in the browser - neither of which changes a response's shape enough to fail
  // an assertion elsewhere.
  const here = dirname(fileURLToPath(import.meta.url));

  it.each(["session.ts", "session-admin.ts", "device.ts", "sso.ts"])(
    "%s writes no cookie of its own",
    file => {
      const source = readFileSync(resolve(here, file), "utf8");

      expect(source).not.toMatch(/\bsetCookie\(/);
      expect(source).not.toMatch(/\bdeleteCookie\(/);
    },
  );
});
