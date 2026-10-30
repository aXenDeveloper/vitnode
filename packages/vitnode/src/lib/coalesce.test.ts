import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCoalescer } from "./coalesce";

const DEBOUNCE_MS = 400;
const MAX_WAIT_MS = 2_000;

const setup = () => {
  const finish: (() => void)[] = [];
  const run = vi.fn(
    async () =>
      await new Promise<void>(resolve => {
        finish.push(resolve);
      }),
  );
  const coalescer = createCoalescer({
    debounceMs: DEBOUNCE_MS,
    maxWaitMs: MAX_WAIT_MS,
    run,
  });
  const settle = async () => {
    finish.splice(0).forEach(resolve => resolve());
    await vi.advanceTimersByTimeAsync(0);
  };

  return { coalescer, run, settle };
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createCoalescer", () => {
  it("runs once, after a burst went quiet for debounceMs", async () => {
    const { coalescer, run } = setup();

    coalescer.schedule();
    await vi.advanceTimersByTimeAsync(300);
    coalescer.schedule();
    await vi.advanceTimersByTimeAsync(300);
    coalescer.schedule();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);

    expect(run).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(run).toHaveBeenCalledOnce();
  });

  it("runs by maxWaitMs while calls keep coming", async () => {
    const { coalescer, run } = setup();

    for (let elapsed = 0; elapsed < 1_800; elapsed += 300) {
      coalescer.schedule();
      await vi.advanceTimersByTimeAsync(300);
    }
    coalescer.schedule();
    await vi.advanceTimersByTimeAsync(MAX_WAIT_MS - 1_800 - 1);

    expect(run).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(run).toHaveBeenCalledOnce();
  });

  it("runs one at a time, and once more after a run that got new calls", async () => {
    const { coalescer, run, settle } = setup();

    coalescer.flush();
    expect(run).toHaveBeenCalledOnce();

    coalescer.schedule();
    coalescer.schedule();
    coalescer.flush();
    await vi.advanceTimersByTimeAsync(MAX_WAIT_MS);

    expect(run).toHaveBeenCalledOnce();

    await settle();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(run).toHaveBeenCalledTimes(2);

    await settle();
    await vi.advanceTimersByTimeAsync(MAX_WAIT_MS);

    expect(run).toHaveBeenCalledTimes(2);
  });

  it("drops a scheduled run on cancel", async () => {
    const { coalescer, run } = setup();

    coalescer.schedule();
    coalescer.cancel();
    await vi.advanceTimersByTimeAsync(MAX_WAIT_MS);

    expect(run).not.toHaveBeenCalled();
  });
});
