import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCoalescer } from "./coalesce";

describe("createCoalescer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("turns a burst of events into one refresh", () => {
    const run = vi.fn();
    const coalescer = createCoalescer(run, { maxWait: 5_000, wait: 1_000 });

    for (let index = 0; index < 50; index++) {
      coalescer.schedule();
      vi.advanceTimersByTime(10);
    }
    vi.advanceTimersByTime(1_000);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("still refreshes during an endless stream, at most every maxWait", () => {
    const run = vi.fn();
    const coalescer = createCoalescer(run, { maxWait: 5_000, wait: 1_000 });

    for (let index = 0; index < 120; index++) {
      coalescer.schedule();
      vi.advanceTimersByTime(100);
    }

    expect(run).toHaveBeenCalledTimes(2);
  });

  it("does nothing once cancelled", () => {
    const run = vi.fn();
    const coalescer = createCoalescer(run, { maxWait: 5_000, wait: 1_000 });
    coalescer.schedule();
    coalescer.cancel();
    vi.advanceTimersByTime(10_000);

    expect(run).not.toHaveBeenCalled();
  });
});
