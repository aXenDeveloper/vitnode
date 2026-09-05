export interface TaskPool {
  /** Queues one task, starting it immediately if a slot is free. */
  add: (task: () => Promise<void>) => void;
  /** How many tasks are running. Never above the pool's limit. */
  readonly inFlight: number;
  /** How many tasks are queued but not started. */
  readonly waiting: number;
}

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
