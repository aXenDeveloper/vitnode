/** A task that runs at most once per burst of requests. */
export interface Coalescer {
  /** Drops a scheduled run; a run already going finishes. */
  cancel: () => void;
  /** Runs now if nothing runs yet; otherwise right after the current run. */
  flush: () => void;
  /** Asks for a run: after `debounceMs` of quiet, but within `maxWaitMs`. */
  schedule: () => void;
}

/**
 * Coalesces bursts of `schedule()` calls into single runs of `run`: it waits
 * for `debounceMs` without a new call, yet never longer than `maxWaitMs` after
 * the first call of a burst, so continuous traffic cannot postpone it forever.
 * One run at a time: a call that lands during a run schedules exactly one
 * more, after it. A failed run is not retried. Universal.
 */
export const createCoalescer = ({
  debounceMs,
  maxWaitMs,
  run,
}: {
  debounceMs: number;
  maxWaitMs: number;
  run: () => Promise<unknown>;
}): Coalescer => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let firstAt: null | number = null;
  let running = false;
  let again = false;

  const start = (): void => {
    clearTimeout(timer);
    timer = undefined;
    firstAt = null;
    if (running) {
      again = true;

      return;
    }
    running = true;
    void run()
      .catch(() => {
        // The caller surfaces its own failures; a hint is not retried.
      })
      .finally(() => {
        running = false;
        if (again) {
          again = false;
          schedule();
        }
      });
  };

  const schedule = (): void => {
    const now = Date.now();
    firstAt ??= now;
    clearTimeout(timer);
    timer = setTimeout(
      start,
      Math.max(0, Math.min(debounceMs, firstAt + maxWaitMs - now)),
    );
  };

  return {
    cancel: () => {
      clearTimeout(timer);
      timer = undefined;
      firstAt = null;
      again = false;
    },
    flush: start,
    schedule,
  };
};
