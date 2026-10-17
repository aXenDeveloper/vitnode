import type { drizzle } from "drizzle-orm/postgres-js";

import {
  renewUpdateCheckLease,
  UPDATE_CHECK_LEASE_MS,
  UPDATE_CHECK_RENEW_INTERVAL_MS,
  UpdateCheckLeaseLostError,
} from "./lock";

type Db = ReturnType<typeof drizzle>;

interface UpdateCheckHeartbeat {
  signal: AbortSignal;
  stop: () => Promise<void>;
}

export const startUpdateCheckHeartbeat = ({
  confirmedAt,
  db,
  owner,
  renew = renewUpdateCheckLease,
}: {
  confirmedAt: number;
  db: Db;
  owner: string;
  renew?: typeof renewUpdateCheckLease;
}): UpdateCheckHeartbeat => {
  const controller = new AbortController();
  let stopped = false;
  let beatTimer: ReturnType<typeof setTimeout> | undefined;
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  let pending: Promise<void> = Promise.resolve();

  const lose = (cause?: unknown) => {
    clearTimeout(beatTimer);
    clearTimeout(deadlineTimer);
    if (controller.signal.aborted) return;
    controller.abort(
      new UpdateCheckLeaseLostError(
        cause === undefined ? undefined : { cause },
      ),
    );
  };

  const armDeadline = (from: number) => {
    clearTimeout(deadlineTimer);
    deadlineTimer = setTimeout(
      () => lose(),
      Math.max(0, from + UPDATE_CHECK_LEASE_MS - Date.now()),
    );
  };

  const beat = async () => {
    const sentAt = Date.now();
    try {
      const renewal = await renew(db, owner);
      if (renewal.status === "lost") {
        lose();

        return;
      }
    } catch (error) {
      lose(error);

      return;
    }
    if (stopped || controller.signal.aborted) return;

    armDeadline(sentAt);
    schedule();
  };

  const schedule = () => {
    beatTimer = setTimeout(() => {
      pending = beat();
    }, UPDATE_CHECK_RENEW_INTERVAL_MS);
  };

  armDeadline(confirmedAt);
  schedule();

  return {
    signal: controller.signal,
    stop: async () => {
      stopped = true;
      clearTimeout(beatTimer);
      if (!controller.signal.aborted) {
        const aborted = new Promise<void>(resolve => {
          controller.signal.addEventListener("abort", () => resolve(), {
            once: true,
          });
        });
        await Promise.race([pending, aborted]);
      }
      clearTimeout(deadlineTimer);
    },
  };
};
