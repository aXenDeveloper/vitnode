import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PresenceHeartbeatResult } from "@/views/presence/presence-heartbeat";

import { useUserPresenceHeartbeat } from "./use-user-presence-heartbeat";

const MINUTE = 60_000;

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-17T12:00:00.000Z") });
});

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("useUserPresenceHeartbeat", () => {
  it("beats for a signed-in member and stops when they sign out", async () => {
    const send = vi.fn(async (): Promise<PresenceHeartbeatResult> => "ok");
    const { rerender, unmount } = renderHook(
      ({ userId }: { userId: null | number }) => {
        useUserPresenceHeartbeat({ send, userId });
      },
      { initialProps: { userId: 7 as null | number } },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(1);

    rerender({ userId: null });
    await vi.advanceTimersByTimeAsync(5 * MINUTE);

    expect(send).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("does nothing while nobody is signed in", async () => {
    const send = vi.fn(async (): Promise<PresenceHeartbeatResult> => "ok");

    renderHook(() => {
      useUserPresenceHeartbeat({ send, userId: null });
    });
    await vi.advanceTimersByTimeAsync(5 * MINUTE);

    expect(send).not.toHaveBeenCalled();
  });
});
