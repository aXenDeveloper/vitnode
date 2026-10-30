import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type PresenceHeartbeatResult,
  presenceHeartbeatStorageKey,
  startPresenceHeartbeat,
} from "./presence-heartbeat";

const MINUTE = 60_000;
const STORAGE_KEY = presenceHeartbeatStorageKey(7);

let visibility: DocumentVisibilityState = "visible";

const setVisibility = (state: DocumentVisibilityState) => {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
};

const start = (
  send = vi.fn(async (): Promise<PresenceHeartbeatResult> => "ok"),
  onSignedOut = vi.fn(),
) => {
  const stop = startPresenceHeartbeat({
    onSignedOut,
    send,
    storageKey: STORAGE_KEY,
  });

  return { onSignedOut, send, stop };
};

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-17T12:00:00.000Z") });
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "visibilityState");
  localStorage.clear();
  vi.useRealTimers();
});

describe("startPresenceHeartbeat", () => {
  it("beats on start and once per interval while the tab is visible", async () => {
    const { send, stop } = start();
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2 * MINUTE);

    expect(send).toHaveBeenCalledTimes(3);
    stop();
  });

  it("pauses while hidden and beats the moment the tab is visible again", async () => {
    const { send, stop } = start();
    await vi.advanceTimersByTimeAsync(0);

    setVisibility("hidden");
    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    expect(send).toHaveBeenCalledTimes(1);

    setVisibility("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(MINUTE);
    expect(send).toHaveBeenCalledTimes(3);
    stop();
  });

  it("never overlaps two requests", async () => {
    let finish: (result: PresenceHeartbeatResult) => void = () => undefined;
    const send = vi.fn(
      async () =>
        await new Promise<PresenceHeartbeatResult>(resolve => {
          finish = resolve;
        }),
    );
    const { stop } = start(send);

    await vi.advanceTimersByTimeAsync(3 * MINUTE);
    expect(send).toHaveBeenCalledTimes(1);

    finish("ok");
    await vi.advanceTimersByTimeAsync(MINUTE);
    expect(send).toHaveBeenCalledTimes(2);
    stop();
  });

  it("does nothing once stopped", async () => {
    const { send, stop } = start();
    await vi.advanceTimersByTimeAsync(0);

    stop();
    setVisibility("hidden");
    setVisibility("visible");
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(5 * MINUTE);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("stops and reports it when the session has ended", async () => {
    const { onSignedOut, send } = start(
      vi.fn(async (): Promise<PresenceHeartbeatResult> => "signed-out"),
    );

    await vi.advanceTimersByTimeAsync(5 * MINUTE);

    expect(send).toHaveBeenCalledTimes(1);
    expect(onSignedOut).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["skips its turn when another tab beat 10 seconds ago", 10_000, 0],
    ["beats when another tab's beat is 50 seconds old", 50_000, 1],
  ])("%s", async (_, age, sends) => {
    localStorage.setItem(STORAGE_KEY, String(Date.now() - age));

    const { send, stop } = start();
    await vi.advanceTimersByTimeAsync(0);

    expect(send).toHaveBeenCalledTimes(sends);
    stop();
  });

  it("is a no-op where there is no document", () => {
    vi.stubGlobal("document", undefined);
    const send = vi.fn(async (): Promise<PresenceHeartbeatResult> => "ok");

    const stop = startPresenceHeartbeat({ send, storageKey: STORAGE_KEY });

    expect(stop).not.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});
