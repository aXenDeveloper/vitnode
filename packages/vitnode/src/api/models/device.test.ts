// @vitest-environment node
import type { Context } from "hono";

import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { EnvVariablesVitNode } from "@/api/middlewares/global.middleware";

import { core_sessions_known_devices } from "@/database/sessions";

import { DeviceModel } from "./device";

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
 * A Drizzle stand-in that records how many device rows were written.
 *
 * `storedDevice` is what a `select` on the devices table finds - `null` for "no
 * such device", which is both the no-cookie case and the forged-cookie case.
 */
const fakeDb = (storedDevice: null | { id: number }) => {
  const inserts: unknown[] = [];

  const chain = (kind: string, table: unknown) => {
    const op = { kind, table };
    const rows = (): unknown[] => {
      if (op.table !== core_sessions_known_devices) return [];
      if (op.kind === "insert") return [{ id: 99 }];
      if (op.kind === "select") return storedDevice ? [storedDevice] : [];

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
      values: (value: unknown) => {
        if (op.table === core_sessions_known_devices) inserts.push(value);

        return self;
      },
      where: () => self,
    };

    return self;
  };

  return {
    db: {
      delete: (table: unknown) => chain("delete", table),
      insert: (table: unknown) => chain("insert", table),
      select: () => chain("select", undefined),
      update: (table: unknown) => chain("update", table),
    },
    inserts,
  };
};

const run = async <T>({
  act,
  cookie,
  storedDevice = null,
}: {
  act: (c: Context) => Promise<T>;
  cookie?: string;
  storedDevice?: null | { id: number };
}): Promise<{ inserts: number; result: T }> => {
  const { db, inserts } = fakeDb(storedDevice);
  let result: T | undefined;

  const app = new Hono();
  app.get("/", async c => {
    c.set("core", {
      authorization: AUTHORIZATION,
    } as EnvVariablesVitNode["core"]);
    c.set("db", db as unknown as EnvVariablesVitNode["db"]);
    c.set("ipAddress", "203.0.113.7");
    result = await act(c);

    return c.body(null, 200);
  });

  await app.request("/", cookie ? { headers: { cookie } } : {});

  return { inserts: inserts.length, result: result as T };
};

describe("DeviceModel", () => {
  describe("getExistingDeviceId", () => {
    it("writes nothing when there is no device cookie", async () => {
      // The regression this guards: session resolution used to create a device
      // here, so any request carrying a made-up `vitnode_auth` cookie inserted a
      // `core_sessions_known_devices` row before discovering there was no
      // session. Unauthenticated, one row per request, unbounded.
      const { inserts, result } = await run({
        act: async c => await new DeviceModel(c).getExistingDeviceId(),
      });

      expect(result).toBeNull();
      expect(inserts).toBe(0);
    });

    it("writes nothing for a device cookie naming no known device", async () => {
      const { inserts, result } = await run({
        act: async c => await new DeviceModel(c).getExistingDeviceId(),
        cookie: "vitnode_device=deadbeef",
      });

      expect(result).toBeNull();
      expect(inserts).toBe(0);
    });

    it("returns the device a valid cookie names", async () => {
      const { inserts, result } = await run({
        act: async c => await new DeviceModel(c).getExistingDeviceId(),
        cookie: "vitnode_device=known",
        storedDevice: { id: 42 },
      });

      expect(result).toEqual({ id: 42, publicId: "known" });
      expect(inserts).toBe(0);
    });
  });

  describe("getOrCreateDeviceId", () => {
    it("creates one when there is no cookie", async () => {
      // Sign-in and sign-up still need this: a new device record is the point
      // there, not a side effect.
      const { inserts, result } = await run({
        act: async c => await new DeviceModel(c).getOrCreateDeviceId(),
      });

      expect(result.id).toBe(99);
      expect(inserts).toBe(1);
    });

    it("reuses a known device rather than creating a second", async () => {
      const { inserts, result } = await run({
        act: async c => await new DeviceModel(c).getOrCreateDeviceId(),
        cookie: "vitnode_device=known",
        storedDevice: { id: 42 },
      });

      expect(result).toEqual({ id: 42, publicId: "known" });
      expect(inserts).toBe(0);
    });
  });
});
