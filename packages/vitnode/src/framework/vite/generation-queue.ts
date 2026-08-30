/**
 * The rule that stops an older regeneration overwriting a newer one.
 *
 * A dev server watches a handful of files that decide what the generated
 * projections say - the app's config, every plugin route manifest it has ever
 * read, the app's own route file names - and regeneration is asynchronous: it
 * resolves several manifests, imports each one, compiles them and writes four
 * files. The watcher fires far faster than that. Rebuilding a plugin rewrites
 * every file in its `dist`, which is dozens of events inside one second.
 *
 * Run those concurrently and two failures follow, in order of how hard they are
 * to see:
 *
 * 1. **Stale output wins.** Pass A starts, pass B starts, B finishes first, A
 *    finishes last - and A's write is the one on disk. The generated files then
 *    describe a manifest that no longer exists, and nothing corrects them until
 *    something unrelated happens to touch a watched file. In a browser that is a
 *    route that vanished still being served, or one that was just added still
 *    404ing, with no error anywhere.
 * 2. **A pass per file.** Forty watcher events become forty passes, each
 *    re-reading every manifest, for one logical change.
 *
 * Both are fixed by the same two rules, and this module is the whole of them:
 *
 *     serialize   at most one pass runs at a time - they are chained, not raced
 *     coalesce    at most one pass waits behind it, however many were asked for
 *
 * Coalescing is safe *because* of serialization, and only because of it: a pass
 * re-reads everything from disk when it starts, so the one queued pass sees the
 * final state on disk whether it was asked for once or forty times. Nothing is
 * lost by collapsing the requests, because none of them carries any information
 * beyond "something changed".
 *
 * ## Why this is its own module
 *
 * It was six lines inside `configureServer`, which is where it belongs at
 * runtime and the one place it could never be tested: asserting that an *older*
 * pass cannot finish last needs two passes whose completion order is controlled,
 * and inside a Vite plugin the only way to get one is to run a dev server.
 *
 * Here it is a pure function of a `run` callback and the order its promises
 * settle in, so `./generation-queue.test.ts` states the interleaving directly
 * and without a filesystem. No timers, no event emitter and no unbounded async:
 * one chain, one boolean.
 */

export interface GenerationQueue {
  /**
   * Whether a pass is running or waiting - for a test, and for a diagnostic.
   *
   * Never a condition to schedule on: `request` already decides that, and a
   * caller that checked this first would race the answer.
   */
  isBusy: () => boolean;
  /**
   * Ask for a regeneration.
   *
   * Returns immediately - the watcher callback that calls this must not block -
   * and never rejects: a failing pass is reported through `onError` and the
   * chain carries on, because a dev server that stopped regenerating after one
   * bad manifest would need a restart to recover from a typo.
   */
  request: () => void;
  /**
   * Resolves when nothing is running or queued.
   *
   * A test seam, and named as one. Nothing in the dev server awaits this - the
   * watcher is fire-and-forget by design - but a test that cannot await the work
   * can only assert on timing.
   */
  settled: () => Promise<void>;
}

/**
 * A serialized, coalesced regeneration queue.
 *
 * `run` is the whole pass: it must re-read its inputs from disk each time it is
 * called, which is what makes collapsing several requests into one correct
 * rather than merely cheap.
 *
 * `onError` receives anything `run` rejects with. It is required rather than
 * optional so that swallowing a failure has to be written down: a pass that
 * throws has left the generated files describing the previous state, and the
 * person who caused it is looking at their editor, not at this queue.
 */
export const createGenerationQueue = (
  run: () => Promise<void>,
  onError: (error: unknown) => void,
): GenerationQueue => {
  let chain: Promise<void> = Promise.resolve();
  let queued = false;
  let running = false;

  const request = (): void => {
    // Already waiting. A second request adds nothing: the pass that is queued
    // has not started reading anything yet, so it will see this change too.
    if (queued) return;

    queued = true;
    chain = chain.then(async () => {
      // Cleared *before* the work rather than after it, so a change that arrives
      // while this pass is reading queues another one behind it. Clearing it
      // afterwards would drop that change on the floor - the pass that saw the
      // old bytes would be the last one to run.
      queued = false;
      running = true;

      try {
        await run();
      } catch (error) {
        onError(error);
      } finally {
        running = false;
      }
    });
  };

  return {
    isBusy: () => queued || running,
    request,
    // The chain is read at call time, so this waits for whatever is outstanding
    // now - including a pass queued after an earlier `settled()` was taken.
    settled: async () => {
      while (queued || running) await chain;
    },
  };
};
