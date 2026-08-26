import { describe, expect, it } from "vitest";

import { createTaskPool } from "./task-pool";

/** Lets every promise chain that is already settled run to the end. */
const flush = async () => {
  await new Promise<void>(resolve => {
    setTimeout(resolve, 0);
  });
};

const tasks = () => {
  const settle = new Map<
    string,
    { reject: (error: unknown) => void; resolve: () => void }
  >();
  const started: string[] = [];
  const running = new Set<string>();
  let peak = 0;

  return {
    add: (pool: ReturnType<typeof createTaskPool>, name: string) => {
      pool.add(async () => {
        started.push(name);
        running.add(name);
        peak = Math.max(peak, running.size);

        try {
          await new Promise<void>((resolve, reject) => {
            settle.set(name, { reject, resolve });
          });
        } finally {
          running.delete(name);
        }
      });
    },
    finish: async (name: string) => {
      settle.get(name)?.resolve();
      await flush();
    },
    get peak() {
      return peak;
    },
    fail: async (name: string) => {
      settle.get(name)?.reject(new Error(name));
      await flush();
    },
    get running() {
      return [...running];
    },
    get started() {
      return started;
    },
  };
};

/**
 * The ceiling, and the two ways a pool with one can go wrong: starting too many,
 * and - much worse - stopping.
 *
 * Nothing here waits on a clock. Every task is a promise the test settles by
 * hand, which is what makes "three were running and the fourth was not" a fact
 * rather than a race with a timer.
 */
describe("createTaskPool", () => {
  it("starts no more than the limit", async () => {
    const pool = createTaskPool(2);
    const work = tasks();

    for (const name of ["a", "b", "c", "d"]) work.add(pool, name);
    await flush();

    expect(work.running).toEqual(["a", "b"]);
    expect(pool.inFlight).toBe(2);
    expect(pool.waiting).toBe(2);
  });

  it("starts the next one the moment a slot frees, in the order queued", async () => {
    const pool = createTaskPool(2);
    const work = tasks();

    for (const name of ["a", "b", "c", "d"]) work.add(pool, name);
    await work.finish("a");

    expect(work.running).toEqual(["b", "c"]);

    await work.finish("b");
    expect(work.running).toEqual(["c", "d"]);
    expect(work.started).toEqual(["a", "b", "c", "d"]);
    expect(work.peak).toBe(2);
  });

  it("frees a slot for a task that rejected", async () => {
    // The one that matters. A pool that only released on success would stop
    // dead on the first refused upload, with everything behind it queued
    // forever and nothing saying why.
    const pool = createTaskPool(1);
    const work = tasks();

    for (const name of ["a", "b"]) work.add(pool, name);
    await work.fail("a");

    expect(work.running).toEqual(["b"]);
  });

  it("frees a slot for a task that threw before it awaited anything", async () => {
    const pool = createTaskPool(1);
    const started: string[] = [];

    pool.add(() => {
      started.push("throws");
      throw new Error("synchronous");
    });
    pool.add(async () => {
      started.push("after");
      await Promise.resolve();
    });
    await flush();

    expect(started).toEqual(["throws", "after"]);
    expect(pool.inFlight).toBe(0);
  });

  it("accepts work added while earlier work is still running", async () => {
    const pool = createTaskPool(2);
    const work = tasks();

    for (const name of ["a", "b"]) work.add(pool, name);
    await flush();
    // A second selection joins the queue rather than doubling what is in flight.
    for (const name of ["c", "d"]) work.add(pool, name);
    await flush();

    expect(work.running).toEqual(["a", "b"]);

    await work.finish("a");
    await work.finish("b");
    expect(work.running).toEqual(["c", "d"]);
    expect(work.peak).toBe(2);
  });

  it("treats a limit below one as one", () => {
    const pool = createTaskPool(0);
    const work = tasks();

    for (const name of ["a", "b"]) work.add(pool, name);

    expect(work.running).toEqual(["a"]);
  });
});
