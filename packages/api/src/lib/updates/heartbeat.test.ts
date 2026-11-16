import type { drizzle } from "drizzle-orm/postgres-js";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UpdateCheckLeaseRenewal } from "./lock";

import { startUpdateCheckHeartbeat } from "./heartbeat";
import {
  UPDATE_CHECK_LEASE_MS,
  UPDATE_CHECK_RENEW_INTERVAL_MS,
  UpdateCheckLeaseLostError,
} from "./lock";

type Db = ReturnType<typeof drizzle>;

const INTERVAL = UPDATE_CHECK_RENEW_INTERVAL_MS;
const LEASE = UPDATE_CHECK_LEASE_MS;
const RENEWED: UpdateCheckLeaseRenewal = { status: "renewed" };

const deferred = () => {
  let answer: (renewal: UpdateCheckLeaseRenewal) => void = () => undefined;
  const promise = new Promise<UpdateCheckLeaseRenewal>(resolve => {
    answer = resolve;
  });

  return { answer, promise };
};

const start = (
  renew: (...args: unknown[]) => Promise<UpdateCheckLeaseRenewal>,
) =>
  startUpdateCheckHeartbeat({
    confirmedAt: Date.now(),
    db: {} as Db,
    owner: "a",
    renew,
  });

beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("startUpdateCheckHeartbeat", () => {
  it("keeps a check alive past the first lease while renewals succeed", async () => {
    const renew = vi.fn(async () => await Promise.resolve(RENEWED));
    const heartbeat = start(renew);

    await vi.advanceTimersByTimeAsync(2 * LEASE);

    expect(renew).toHaveBeenCalledTimes((2 * LEASE) / INTERVAL);
    expect(renew).toHaveBeenCalledWith({}, "a");
    expect(heartbeat.signal.aborted).toBe(false);
    await heartbeat.stop();
  });

  it("sends the next renewal only after the previous one answered", async () => {
    const sentAt: number[] = [];
    let inFlight = 0;
    let mostInFlight = 0;
    const renew = vi.fn(async () => {
      sentAt.push(Date.now());
      inFlight += 1;
      mostInFlight = Math.max(mostInFlight, inFlight);
      await new Promise(resolve => setTimeout(resolve, 30_000));
      inFlight -= 1;

      return RENEWED;
    });
    const heartbeat = start(renew);

    await vi.advanceTimersByTimeAsync(270_000);

    expect(sentAt).toEqual([60_000, 150_000, 240_000]);
    expect(mostInFlight).toBe(1);
    await heartbeat.stop();
  });

  it.each([
    [
      "the lease was lost",
      async () => await Promise.resolve({ status: "lost" as const }),
      undefined,
    ],
    [
      "the renewal failed",
      async () => await Promise.reject(new Error("connection reset")),
      new Error("connection reset"),
    ],
  ])("stops the check when %s", async (_, answer, cause) => {
    const renew = vi.fn(answer);
    const heartbeat = start(renew);

    await vi.advanceTimersByTimeAsync(INTERVAL);

    expect(heartbeat.signal.aborted).toBe(true);
    expect(heartbeat.signal.reason).toBeInstanceOf(UpdateCheckLeaseLostError);
    expect((heartbeat.signal.reason as Error).cause).toEqual(cause);
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(2 * LEASE);
    expect(renew).toHaveBeenCalledTimes(1);
    await heartbeat.stop();
  });

  it("stops the check once a renewal hangs past the last confirmed lease", async () => {
    const hung = deferred();
    const renew = vi
      .fn<() => Promise<UpdateCheckLeaseRenewal>>()
      .mockResolvedValueOnce(RENEWED)
      .mockReturnValueOnce(hung.promise);
    const heartbeat = start(renew);

    await vi.advanceTimersByTimeAsync(INTERVAL + LEASE - 1);
    expect(heartbeat.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(heartbeat.signal.reason).toBeInstanceOf(UpdateCheckLeaseLostError);

    hung.answer(RENEWED);
    await heartbeat.stop();
    expect(vi.getTimerCount()).toBe(0);
    expect(heartbeat.signal.aborted).toBe(true);
    expect(renew).toHaveBeenCalledTimes(2);
  });

  it("waits for a renewal on its way when stopped, then leaves no timer behind", async () => {
    const inFlight = deferred();
    const renew = vi.fn(async () => await inFlight.promise);
    const heartbeat = start(renew);
    await vi.advanceTimersByTimeAsync(INTERVAL);

    let stopped = false;
    const stopping = heartbeat.stop().then(() => {
      stopped = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(stopped).toBe(false);

    inFlight.answer(RENEWED);
    await stopping;
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(2 * LEASE);
    expect(renew).toHaveBeenCalledTimes(1);
    expect(heartbeat.signal.aborted).toBe(false);
  });

  it("stops waiting for a renewal that never answers once the deadline passes", async () => {
    const renew = vi.fn(
      async () => await new Promise<UpdateCheckLeaseRenewal>(() => undefined),
    );
    const heartbeat = start(renew);
    await vi.advanceTimersByTimeAsync(INTERVAL);

    let stopped = false;
    const stopping = heartbeat.stop().then(() => {
      stopped = true;
    });
    await vi.advanceTimersByTimeAsync(LEASE - INTERVAL - 1);
    expect(stopped).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await stopping;
    expect(heartbeat.signal.reason).toBeInstanceOf(UpdateCheckLeaseLostError);
    expect(vi.getTimerCount()).toBe(0);
  });
});
