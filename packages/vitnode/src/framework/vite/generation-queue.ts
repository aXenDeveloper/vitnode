export interface GenerationQueue {
  isBusy: () => boolean;

  request: () => void;

  settled: () => Promise<void>;
}

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
