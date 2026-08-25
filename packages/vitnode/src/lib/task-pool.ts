/**
 * A bounded queue for work that is already asynchronous.
 *
 * Not a scheduler and not a retry policy: it starts what it is given, at most
 * `limit` at a time, and starts the next one the moment a slot frees. That is
 * the whole of it, and it is deliberately the whole of it - the caller keeps its
 * own outcome per task, which is what lets a hundred uploads report a hundred
 * results rather than one.
 *
 * Work may be added while earlier work is still running, so a second selection
 * joins the queue behind the first instead of doubling what is in flight.
 */
export interface TaskPool {
  /** Queues one task, starting it immediately if a slot is free. */
  add: (task: () => Promise<void>) => void;
  /** How many tasks are running. Never above the pool's limit. */
  readonly inFlight: number;
  /** How many tasks are queued but not started. */
  readonly waiting: number;
}

/**
 * A pool that runs at most `limit` tasks at once.
 *
 * The ceiling exists because "start every request now" is not the same offer to
 * a browser as it is to a server: two hundred concurrent uploads are two hundred
 * connections queued by the browser anyway, with every one of them timing out
 * against the same clock and none of them able to say which file it was. Six at
 * a time finish in the same wall-clock and fail one file at a time.
 *
 * A task that rejects frees its slot like any other - the pool never stalls on a
 * failure, because the failure is the caller's to report and not the pool's to
 * hold on to.
 */
export const createTaskPool = (limit: number): TaskPool => {
  const ceiling = Math.max(1, Math.floor(limit));
  const waiting: (() => Promise<void>)[] = [];
  let inFlight = 0;

  const pump = () => {
    while (inFlight < ceiling && waiting.length > 0) {
      const task = waiting.shift();
      if (!task) return;

      inFlight += 1;
      // One release per task, whichever way it ends. A synchronous throw is
      // caught for the same reason a rejection is: it is a slot that would
      // otherwise never come back, and the pool would quietly stop.
      const release = () => {
        inFlight -= 1;
        pump();
      };

      try {
        void task().then(release, release);
      } catch {
        release();
      }
    }
  };

  return {
    add: task => {
      waiting.push(task);
      pump();
    },
    get inFlight() {
      return inFlight;
    },
    get waiting() {
      return waiting.length;
    },
  };
};
