import { describe, expect, it } from "vitest";

import { createGenerationQueue } from "./generation-queue";

/**
 * What the dev server's regeneration queue must guarantee, stated as the
 * interleavings it exists to prevent.
 *
 * The failure this is all for is not a crash. It is four generated files that
 * describe a plugin configuration nobody has any more, sitting on disk until an
 * unrelated edit happens to touch a watched file - so the browser serves a route
 * that was deleted, or 404s one that was added, with nothing in the log.
 *
 * ## Why the passes are functions that resolve when told
 *
 * A test that ran real passes could only ever assert on how long they happened
 * to take, which is the one thing this has to be independent of. So each pass
 * here hands back its own `resolve`, and the test settles them in whatever order
 * it wants to state: "the older pass finishes last" is a line of code rather
 * than a sleep and a hope.
 */

/** A run function whose passes are resolved by the test, in any order. */
const controllablePass = () => {
  const started: string[] = [];
  const finished: string[] = [];
  const pending: { fail: (error: Error) => void; finish: () => void }[] = [];
  let next = 0;

  return {
    /** In-flight passes, oldest first, each with its own resolver. */
    pending,
    /** Which passes ran, in the order they were entered. */
    started,
    /** Which passes completed, in the order they completed. */
    finished,
    run: async (): Promise<void> => {
      const id = `pass-${next++}`;

      started.push(id);

      return new Promise<void>((resolve, reject) => {
        pending.push({
          fail: (error: Error) => {
            finished.push(id);
            reject(error);
          },
          finish: () => {
            finished.push(id);
            resolve();
          },
        });
      });
    },
  };
};

/**
 * Let the microtask queue drain, without waiting for any pass to finish.
 *
 * `settled()` is the wrong tool for an assertion taken *mid-flight*: it waits
 * for everything outstanding, including the pass this test is deliberately
 * leaving unfinished. Several turns, because a chained pass is entered a couple
 * of microtasks after the one before it resolves.
 */
const tick = async (turns = 6): Promise<void> => {
  for (let i = 0; i < turns; i++) await Promise.resolve();
};

const errorsOf = () => {
  const errors: unknown[] = [];

  return { errors, onError: (error: unknown) => errors.push(error) };
};

describe("serialization", () => {
  it("never runs two passes at once", async () => {
    const pass = controllablePass();
    const { onError } = errorsOf();
    const queue = createGenerationQueue(pass.run, onError);

    queue.request();
    await tick();
    expect(pass.started).toEqual(["pass-0"]);

    // Two more watcher events while the first pass is still reading.
    queue.request();
    queue.request();
    await tick();

    // Still one. The queued pass has not been entered.
    expect(pass.started).toEqual(["pass-0"]);
    expect(pass.pending).toHaveLength(1);

    pass.pending[0].finish();
    await tick();
    pass.pending[1].finish();
    await queue.settled();
  });

  /**
   * The whole reason this module exists: watch event A, watch event B, and the
   * older generation finishing *after* the newer one.
   *
   * Unserialized, A's write lands last and the generated files describe the
   * state B already replaced. Serialized, B cannot start until A has finished,
   * so "older finishes last" is not an order the queue can produce - which is
   * what this asserts by settling the passes in the opposite order to the one
   * they were requested in and finding that there was never a second pass to
   * settle.
   */
  it("cannot let an older pass finish after a newer one", async () => {
    const pass = controllablePass();
    const { onError } = errorsOf();
    const queue = createGenerationQueue(pass.run, onError);

    queue.request(); // watch event A
    await tick();
    queue.request(); // watch event B, while A is still running

    await tick();

    // B has not started, so there is nothing that could finish before A.
    expect(pass.pending).toHaveLength(1);

    pass.pending[0].finish(); // A completes
    await tick();

    // Only now did B run, and it can only complete after A.
    pass.pending[1].finish();
    await queue.settled();
    expect(pass.finished).toEqual(["pass-0", "pass-1"]);
  });

  it("runs the queued pass after the running one, not instead of it", async () => {
    const pass = controllablePass();
    const { onError } = errorsOf();
    const queue = createGenerationQueue(pass.run, onError);

    queue.request();
    await tick();
    queue.request();

    pass.pending[0].finish();
    await tick();

    expect(pass.started).toEqual(["pass-0", "pass-1"]);
    pass.pending[1].finish();
    await queue.settled();
    expect(pass.finished).toEqual(["pass-0", "pass-1"]);
  });
});

describe("coalescing", () => {
  /**
   * Rebuilding a plugin rewrites every file in its `dist`, which is dozens of
   * watcher events for one logical change. Each pass re-reads everything from
   * disk when it starts, so one queued pass answers all of them.
   */
  it("collapses a burst of requests into a single queued pass", async () => {
    const pass = controllablePass();
    const { onError } = errorsOf();
    const queue = createGenerationQueue(pass.run, onError);

    queue.request();
    await tick();

    for (let i = 0; i < 40; i++) queue.request();

    pass.pending[0].finish();
    await tick();

    // Forty events, one extra pass - and it is still running, so nothing else
    // was queued behind it either.
    expect(pass.started).toEqual(["pass-0", "pass-1"]);

    pass.pending[1].finish();
    await queue.settled();
    expect(pass.started).toEqual(["pass-0", "pass-1"]);
  });

  /**
   * The queued flag is cleared before the work rather than after it, and this is
   * the difference: a change that arrives while a pass is *reading* has to queue
   * another pass, because the pass that is running has already read the old
   * bytes.
   */
  it("still queues a change that arrives after a pass started reading", async () => {
    const pass = controllablePass();
    const { onError } = errorsOf();
    const queue = createGenerationQueue(pass.run, onError);

    queue.request();
    await tick();
    expect(pass.started).toEqual(["pass-0"]);

    // The edit that this running pass cannot have seen.
    queue.request();

    pass.pending[0].finish();
    await tick();

    expect(pass.started).toEqual(["pass-0", "pass-1"]);

    pass.pending[1].finish();
    await queue.settled();
  });

  it("is idle again once everything asked for has run", async () => {
    const pass = controllablePass();
    const { onError } = errorsOf();
    const queue = createGenerationQueue(pass.run, onError);

    expect(queue.isBusy()).toBe(false);

    queue.request();
    expect(queue.isBusy()).toBe(true);

    await tick();
    pass.pending[0].finish();
    await queue.settled();

    expect(queue.isBusy()).toBe(false);
  });

  it("starts a fresh pass for a change that arrives after it went idle", async () => {
    const pass = controllablePass();
    const { onError } = errorsOf();
    const queue = createGenerationQueue(pass.run, onError);

    queue.request();
    await tick();
    pass.pending[0].finish();
    await queue.settled();

    queue.request();
    await tick();
    pass.pending[1].finish();
    await queue.settled();

    expect(pass.started).toEqual(["pass-0", "pass-1"]);
  });
});

describe("a pass that throws", () => {
  /**
   * A dev server that stopped regenerating after one bad manifest would need a
   * restart to recover from a typo - which is exactly the moment an author is
   * about to fix it and expects the next save to work.
   */
  it("reports the failure and keeps the queue running", async () => {
    const pass = controllablePass();
    const { errors, onError } = errorsOf();
    const queue = createGenerationQueue(pass.run, onError);

    queue.request();
    await tick();
    pass.pending[0].fail(new Error("bad manifest"));
    await queue.settled();

    expect(errors).toHaveLength(1);
    expect(String(errors[0])).toContain("bad manifest");

    // The next save still regenerates.
    queue.request();
    await tick();
    expect(pass.started).toEqual(["pass-0", "pass-1"]);

    pass.pending[1].finish();
    await queue.settled();
    expect(errors).toHaveLength(1);
  });

  it("never rejects out of request(), which a watcher callback cannot catch", async () => {
    const pass = controllablePass();
    const { onError } = errorsOf();
    const queue = createGenerationQueue(pass.run, onError);

    expect(() => {
      queue.request();
    }).not.toThrow();

    await tick();
    pass.pending[0].fail(new Error("boom"));

    await expect(queue.settled()).resolves.toBeUndefined();
  });
});

describe("no unrestricted async", () => {
  /**
   * The queue is a chain and a boolean. It spawns nothing, holds no timer and
   * subscribes to nothing, so there is no rebuild to leak and no listener to
   * accumulate across a dev session - which is why the dev server can call
   * `request()` from three watcher events and forget about it.
   */
  it("holds at most one running pass and one queued one, ever", async () => {
    const pass = controllablePass();
    const { onError } = errorsOf();
    const queue = createGenerationQueue(pass.run, onError);

    // Five bursts of twenty-five watcher events, each drained before the next.
    for (let round = 0; round < 5; round++) {
      for (let i = 0; i < 25; i++) queue.request();

      await tick();

      // Exactly one pass entered per burst, and nothing else in flight.
      expect(pass.pending).toHaveLength(round + 1);
      expect(pass.started).toHaveLength(round + 1);

      pass.pending[round].finish();
      await queue.settled();
    }

    // A hundred and twenty-five events, five passes.
    expect(pass.started).toHaveLength(5);
    expect(pass.finished).toEqual(pass.started);
  });
});
