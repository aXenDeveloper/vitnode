import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_TAB_HEARTBEAT_FRESH_MS,
  ADMIN_TAB_HEARTBEAT_KEY,
  answerAdminTabPings,
  askOtherAdminTabs,
  isAdminSessionStillInUse,
  isAdminTabHeartbeatFresh,
  keepAdminTabAlive,
  markAdminTabAlive,
} from "./tab-presence";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("isAdminTabHeartbeatFresh", () => {
  const now = 1_000_000;

  it("accepts a heartbeat from a tab that was open a moment ago", () => {
    expect(isAdminTabHeartbeatFresh(String(now - 1_000), now)).toBe(true);
  });

  it("rejects a heartbeat older than the grace window", () => {
    expect(
      isAdminTabHeartbeatFresh(String(now - ADMIN_TAB_HEARTBEAT_FRESH_MS), now),
    ).toBe(false);
  });

  it("rejects a missing, garbled or future heartbeat", () => {
    expect(isAdminTabHeartbeatFresh(null, now)).toBe(false);
    expect(isAdminTabHeartbeatFresh("nope", now)).toBe(false);
    expect(isAdminTabHeartbeatFresh(String(now + 60_000), now)).toBe(false);
  });
});

describe("askOtherAdminTabs", () => {
  it("hears back from an open AdminCP tab", async () => {
    const stop = answerAdminTabPings();

    await expect(askOtherAdminTabs(500)).resolves.toBe(true);
    stop();
  });

  it("gives up when no AdminCP tab answers", async () => {
    await expect(askOtherAdminTabs(50)).resolves.toBe(false);
  });

  it("reports no tab when the browser cannot broadcast", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);

    await expect(askOtherAdminTabs(50)).resolves.toBe(false);
  });
});

describe("isAdminSessionStillInUse", () => {
  it("is in use right after another tab's heartbeat", async () => {
    markAdminTabAlive();

    await expect(isAdminSessionStillInUse()).resolves.toBe(true);
  });

  it("is in use while a quiet background tab still answers", async () => {
    localStorage.setItem(
      ADMIN_TAB_HEARTBEAT_KEY,
      String(Date.now() - 10 * 60_000),
    );
    const stop = answerAdminTabPings();

    await expect(isAdminSessionStillInUse()).resolves.toBe(true);
    stop();
  });

  it("is abandoned once every AdminCP tab was closed", async () => {
    localStorage.setItem(
      ADMIN_TAB_HEARTBEAT_KEY,
      String(Date.now() - 10 * 60_000),
    );

    await expect(isAdminSessionStillInUse()).resolves.toBe(false);
  });

  it("does not sign anyone out when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    await expect(isAdminSessionStillInUse()).resolves.toBe(true);
    vi.restoreAllMocks();
  });
});

describe("keepAdminTabAlive", () => {
  it("beats while mounted, answers pings, and beats once more on leave", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "Date"] });
    vi.setSystemTime(1_000_000);

    const stop = keepAdminTabAlive();
    expect(localStorage.getItem(ADMIN_TAB_HEARTBEAT_KEY)).toBe("1000000");

    vi.setSystemTime(1_005_000);
    vi.advanceTimersByTime(5_000);
    expect(localStorage.getItem(ADMIN_TAB_HEARTBEAT_KEY)).toBe("1010000");

    vi.useRealTimers();
    await expect(askOtherAdminTabs(500)).resolves.toBe(true);

    stop();
    await expect(askOtherAdminTabs(50)).resolves.toBe(false);
  });
});
