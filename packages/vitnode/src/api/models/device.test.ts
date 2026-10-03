// @vitest-environment node
import type { Context } from "hono";

import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { CacheModel } from "@/api/lib/cache";
import type { EnvVariablesVitNode } from "@/api/middlewares/global.middleware";

import { core_sessions_known_devices } from "@/database/sessions";
import { createTestCache } from "@/tests/cache";

import {
  DEVICE_TOUCH_INTERVAL_MS,
  deviceCacheKey,
  DeviceModel,
} from "./device";

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
  passkeys: { enabled: false, problems: [] },
  password: { enabled: true },
  ssoAdapters: [],
};

/**
 * A Drizzle stand-in that records how many device rows were written.
 *
 * `storedDevice` is what a `select` on the devices table finds - `null` for "no
 * such device", which is both the no-cookie case and the forged-cookie case.
 */
interface StoredDevice {
  id: number;
  ipAddress: string;
  lastSeen: Date;
  userAgent: string;
}

const REQUEST_IP = "203.0.113.7";

const knownDevice = (overrides: Partial<StoredDevice> = {}): StoredDevice => ({
  id: 42,
  ipAddress: REQUEST_IP,
  lastSeen: new Date(),
  userAgent: "node",
  ...overrides,
});

const fakeDb = (storedDevice: null | StoredDevice, selectError?: Error) => {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  let selects = 0;

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
      set: (value: unknown) => {
        if (op.kind === "update" && op.table === core_sessions_known_devices) {
          updates.push(value);
        }

        return self;
      },
      then: async (
        onFulfilled: (value: unknown[]) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => {
        if (op.kind === "select" && selectError) {
          return await Promise.resolve(onRejected?.(selectError));
        }

        return await Promise.resolve(onFulfilled(rows()));
      },
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
      select: () => {
        selects += 1;

        return chain("select", undefined);
      },
      update: (table: unknown) => chain("update", table),
    },
    inserts,
    selects: () => selects,
    updates,
  };
};

const run = async <T>({
  act,
  cache = createTestCache(),
  cookie,
  selectError,
  storedDevice = null,
}: {
  act: (c: Context) => Promise<T>;
  cache?: CacheModel;
  cookie?: string;
  selectError?: Error;
  storedDevice?: null | StoredDevice;
}): Promise<{
  inserts: number;
  result: T;
  selects: number;
  updates: number;
}> => {
  const { db, inserts, selects, updates } = fakeDb(storedDevice, selectError);
  let result: T | undefined;
  let thrownError: Error | undefined;

  const app = new Hono();
  app.onError((error, c) => {
    thrownError = error;

    return c.body(null, 500);
  });
  app.get("/", async c => {
    c.set("core", {
      authorization: AUTHORIZATION,
    } as EnvVariablesVitNode["core"]);
    c.set("db", db as unknown as EnvVariablesVitNode["db"]);
    c.set("cache", cache);
    c.set("ipAddress", REQUEST_IP);
    result = await act(c);

    return c.body(null, 200);
  });

  await app.request("/", cookie ? { headers: { cookie } } : {});
  if (thrownError) throw thrownError;

  return {
    inserts: inserts.length,
    result: result as T,
    selects: selects(),
    updates: updates.length,
  };
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
        storedDevice: knownDevice(),
      });

      expect(result).toEqual({ id: 42, publicId: "known" });
      expect(inserts).toBe(0);
    });

    it("skips the write for a device seen moments ago from the same client", async () => {
      const { result, updates } = await run({
        act: async c => await new DeviceModel(c).getExistingDeviceId(),
        cookie: "vitnode_device=known",
        storedDevice: knownDevice(),
      });

      expect(result).toEqual({ id: 42, publicId: "known" });
      expect(updates).toBe(0);
    });

    it("records the visit once the last one is older than the touch interval", async () => {
      const { updates } = await run({
        act: async c => await new DeviceModel(c).getExistingDeviceId(),
        cookie: "vitnode_device=known",
        storedDevice: knownDevice({
          lastSeen: new Date(Date.now() - DEVICE_TOUCH_INTERVAL_MS),
        }),
      });

      expect(updates).toBe(1);
    });

    it("records the visit straight away when the IP address changed", async () => {
      const { updates } = await run({
        act: async c => await new DeviceModel(c).getExistingDeviceId(),
        cookie: "vitnode_device=known",
        storedDevice: knownDevice({ ipAddress: "198.51.100.1" }),
      });

      expect(updates).toBe(1);
    });

    it("records the visit straight away when the user agent changed", async () => {
      const { updates } = await run({
        act: async c => await new DeviceModel(c).getExistingDeviceId(),
        cookie: "vitnode_device=known",
        storedDevice: knownDevice({ userAgent: "Mozilla/5.0" }),
      });

      expect(updates).toBe(1);
    });
  });

  describe("device cache", () => {
    const getExisting = async (c: Context) =>
      await new DeviceModel(c).getExistingDeviceId();

    it("serves a device seen moments ago without a database round trip", async () => {
      const cache = createTestCache();
      await run({
        act: getExisting,
        cache,
        cookie: "vitnode_device=known",
        storedDevice: knownDevice(),
      });

      const { result, selects, updates } = await run({
        act: getExisting,
        cache,
        cookie: "vitnode_device=known",
        storedDevice: knownDevice(),
      });

      expect(result).toEqual({ id: 42, publicId: "known" });
      expect(selects).toBe(0);
      expect(updates).toBe(0);
    });

    it("goes back to the database once the cached visit is due a touch", async () => {
      const cache = createTestCache();
      await cache.setSystem(deviceCacheKey("known"), {
        id: 42,
        ipAddress: REQUEST_IP,
        lastSeen: new Date(Date.now() - DEVICE_TOUCH_INTERVAL_MS).toISOString(),
        userAgent: "node",
      });

      const { selects, updates } = await run({
        act: getExisting,
        cache,
        cookie: "vitnode_device=known",
        storedDevice: knownDevice({
          lastSeen: new Date(Date.now() - DEVICE_TOUCH_INTERVAL_MS),
        }),
      });

      expect(selects).toBe(1);
      expect(updates).toBe(1);
    });

    it("goes back to the database when the cached device was seen from another IP", async () => {
      const cache = createTestCache();
      await cache.setSystem(deviceCacheKey("known"), {
        id: 42,
        ipAddress: "198.51.100.1",
        lastSeen: new Date().toISOString(),
        userAgent: "node",
      });

      const { selects, updates } = await run({
        act: getExisting,
        cache,
        cookie: "vitnode_device=known",
        storedDevice: knownDevice({ ipAddress: "198.51.100.1" }),
      });

      expect(selects).toBe(1);
      expect(updates).toBe(1);
    });

    it("never lets sign-in reuse a cached device that no longer exists", async () => {
      const cache = createTestCache();
      await cache.setSystem(deviceCacheKey("known"), {
        id: 42,
        ipAddress: REQUEST_IP,
        lastSeen: new Date().toISOString(),
        userAgent: "node",
      });

      const { inserts, result } = await run({
        act: async c => await new DeviceModel(c).getOrCreateDeviceId(),
        cache,
        cookie: "vitnode_device=known",
      });

      expect(result.id).toBe(99);
      expect(inserts).toBe(1);
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
        storedDevice: knownDevice(),
      });

      expect(result).toEqual({ id: 42, publicId: "known" });
      expect(inserts).toBe(0);
    });

    it("does not create a device when the existing-device lookup fails", async () => {
      const lookupError = new Error("database unavailable");

      await expect(
        run({
          act: async c => await new DeviceModel(c).getOrCreateDeviceId(),
          cookie: "vitnode_device=known",
          selectError: lookupError,
        }),
      ).rejects.toBe(lookupError);
    });
  });
});
