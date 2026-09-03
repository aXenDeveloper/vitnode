import { hashKey } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  DEVICE_TYPES,
  devicesQueryKey,
  devicesQueryOptions,
  DevicesRequestError,
  isDevicesRequestError,
} from "./devices-query";
import {
  isDevicePublicId,
  isRevokableDevice,
  REVOKE_CURRENT_DEVICE_STATUS,
  revokeResultFromStatus,
  shouldRefreshAfterRevoke,
} from "./devices-revoke";

describe("one list per visitor, one cache entry each", () => {
  it("is keyed by the owner, under the devices domain", () => {
    expect(devicesQueryKey(10)).toEqual(["devices", "user", 10]);
  });

  it("is the same entry however many times it is asked for", () => {
    // The loader and the component both call the factory, and they have to land
    // in the same entry or the loader fills one while the component reads the
    // other.
    expect(hashKey(devicesQueryOptions({ userId: 10 }).queryKey)).toBe(
      hashKey(
        devicesQueryOptions({
          fetchDevices: async () => Promise.resolve({ devices: [] }),
          userId: 10,
        }).queryKey,
      ),
    );
  });

  it("gives two visitors two entries, so one can never read the other's", () => {
    expect(devicesQueryKey(10)).not.toEqual(devicesQueryKey(20));
    expect(hashKey(devicesQueryKey(10))).not.toBe(hashKey(devicesQueryKey(20)));
  });

  it("is what a revoke invalidates, so one visitor's refresh is their own", () => {
    // Query matches by prefix, and this key has no sub-keys - so it is both the
    // entry and the family, and invalidating it cannot reach visitor 20.
    expect(devicesQueryOptions({ userId: 10 }).queryKey).toEqual(
      devicesQueryKey(10),
    );
  });

  it("does not share a prefix with the session entry", () => {
    // Query matches keys by prefix, so a revoke invalidating this key must not
    // reach `['vitnode', 'session']` - the one entry a route guard reads.
    expect(devicesQueryKey(10)[0]).not.toBe("vitnode");
  });

  it("asks once, because every failure it can have is worse when repeated", () => {
    expect(devicesQueryOptions({ userId: 10 }).retry).toBe(false);
  });
});

describe("a refused read is not an empty list", () => {
  it.each([401, 403, 429, 500])(
    "turns %i into an error rather than a list nobody is signed in on",
    status => {
      const error = new DevicesRequestError(status);

      expect(error.status).toBe(status);
      expect(isDevicesRequestError(error)).toBe(true);
      // The bug this replaces: `getDevicesApi()` parsed the refusal body, which
      // has no `devices` in it, and the page said "No active devices."
      expect(error).not.toHaveProperty("devices");
    },
  );

  it("says which status refused, in the message", () => {
    expect(new DevicesRequestError(429).message).toContain("429");
  });

  it("is recognised across two copies of the class", () => {
    // `@vitnode/core` is imported from `dist` by the apps and from `src` by these
    // tests, so `instanceof` can answer `false` for a genuine one. The guard is
    // `name`-based, and this is the shape that proves it.
    const fromAnotherCopy = new Error("The devices API answered 401 ...");
    fromAnotherCopy.name = "DevicesRequestError";

    expect(isDevicesRequestError(fromAnotherCopy)).toBe(true);
  });

  it("is not fooled by an ordinary error", () => {
    expect(isDevicesRequestError(new Error("nope"))).toBe(false);
    expect(isDevicesRequestError({ status: 401 })).toBe(false);
    expect(isDevicesRequestError(undefined)).toBe(false);
  });
});

describe("the row shape the API promises", () => {
  it("has exactly the three device types the icons cover", () => {
    expect([...DEVICE_TYPES]).toEqual(["desktop", "tablet", "mobile"]);
  });
});

describe("the current device is the one that cannot be signed out", () => {
  it("offers no revoke for the session doing the asking", () => {
    // The API answers 400 for it, so a button here would only ever produce an
    // error toast.
    expect(isRevokableDevice({ isCurrent: true })).toBe(false);
  });

  it("offers a revoke for every other device", () => {
    expect(isRevokableDevice({ isCurrent: false })).toBe(true);
  });

  it("names the status the API refuses with", () => {
    expect(REVOKE_CURRENT_DEVICE_STATUS).toBe(400);
  });
});

describe("the public ids a revoke will send", () => {
  it("accepts the 32 hex characters `DeviceModel` mints", () => {
    expect(isDevicePublicId("0123456789abcdef0123456789abcdef")).toBe(true);
  });

  it("accepts a shorter url-safe token, for ids minted by an older scheme", () => {
    expect(isDevicePublicId("a1b2c3")).toBe(true);
    expect(isDevicePublicId("a_b-c")).toBe(true);
  });

  it("refuses an empty id, which would address the list route", () => {
    // `/devices/` + `""` is `DELETE /devices`, which is a different route.
    expect(isDevicePublicId("")).toBe(false);
  });

  it("refuses anything that would leave the path segment", () => {
    expect(isDevicePublicId("../session")).toBe(false);
    expect(isDevicePublicId("a/b")).toBe(false);
    expect(isDevicePublicId("a.b")).toBe(false);
    expect(isDevicePublicId("%2e%2e")).toBe(false);
    expect(isDevicePublicId("a b")).toBe(false);
  });

  it("refuses an id longer than any real one", () => {
    expect(isDevicePublicId("a".repeat(128))).toBe(true);
    expect(isDevicePublicId("a".repeat(129))).toBe(false);
  });
});

describe("what a revoke's status becomes", () => {
  it("is done only for the 200 the route declares", () => {
    expect(revokeResultFromStatus(200)).toEqual({ data: true });
  });

  it.each([400, 401, 403, 404, 429, 500])(
    "carries %i back for the dialog to phrase",
    status => {
      expect(revokeResultFromStatus(status)).toEqual({ error: { status } });
    },
  );

  it("never reports both an outcome and a refusal", () => {
    expect(revokeResultFromStatus(200).error).toBeUndefined();
    expect(revokeResultFromStatus(404).data).toBeUndefined();
  });
});

describe("whether a finished revoke makes the list stale", () => {
  it("refreshes when the device actually went", () => {
    expect(shouldRefreshAfterRevoke({ data: true })).toBe(true);
  });

  it("refreshes when the row was already wrong", () => {
    // 404: somebody revoked it first. 400: the list believed it was revokable and
    // the API considers it current. Either way the screen disagrees with the
    // server, and refetching is the repair.
    expect(shouldRefreshAfterRevoke({ error: { status: 404 } })).toBe(true);
    expect(
      shouldRefreshAfterRevoke({
        error: { status: REVOKE_CURRENT_DEVICE_STATUS },
      }),
    ).toBe(true);
  });

  it.each([401, 403, 429, 500, 503])(
    "leaves the list alone after a %i, which deleted nothing",
    status => {
      // A 429 answered by immediately re-reading is the thing the limiter is
      // asking the app to stop doing; a 401 answered by re-reading blanks the
      // list the person is looking at.
      expect(shouldRefreshAfterRevoke({ error: { status } })).toBe(false);
    },
  );

  it("does not refresh on a result that says nothing", () => {
    expect(shouldRefreshAfterRevoke({})).toBe(false);
  });
});
