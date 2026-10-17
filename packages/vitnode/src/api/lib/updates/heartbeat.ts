import type { drizzle } from "drizzle-orm/postgres-js";

import {
  renewUpdateCheckLease,
  UPDATE_CHECK_LEASE_MS,
  UPDATE_CHECK_RENEW_INTERVAL_MS,
  UpdateCheckLeaseLostError,
} from "./lock";

type Db = ReturnType<typeof drizzle>;

export interface UpdateCheckHeartbeat {
  /** Aborted with an {@link UpdateCheckLeaseLostError} once ownership can no longer be confirmed. */
  signal: AbortSignal;
  /** Stops renewing and waits for a renewal already on its way. Never throws. */
  stop: () => Promise<void>;
}

/**
 * Renews the lease about once a minute while a check runs. One renewal at a
 * time: the next is only scheduled after the previous one answered. A renewal
 * that says `lost`, fails, or does not answer before the lease could have run
 * out stops the check - it never keeps going on ownership it cannot confirm.
 */
export const startUpdateCheckHeartbeat = ({
  confirmedAt,
  db,
  intervalMs = UPDATE_CHECK_RENEW_INTERVAL_MS,
  leaseMs = UPDATE_CHECK_LEASE_MS,
  owner,
  renew = renewUpdateCheckLease,
}: {
  /** `Date.now()` from just before the lease was taken: it runs at least `leaseMs` from then. */
  confirmedAt: number;
  db: Db;
  intervalMs?: number;
  leaseMs?: number;
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

  // Measured on this instance's own clock from when the renewal was sent, which
  // is never later than when the database stamped it.
  const armDeadline = (from: number) => {
    clearTimeout(deadlineTimer);
    deadlineTimer = setTimeout(
      () => lose(),
      Math.max(0, from + leaseMs - Date.now()),
    );
  };

  const beat = async () => {
    const sentAt = Date.now();
    try {
      const renewal = await renew(db, owner, { leaseMs });
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
    }, intervalMs);
  };

  armDeadline(confirmedAt);
  schedule();

  return {
    signal: controller.signal,
    stop: async () => {
      stopped = true;
      clearTimeout(beatTimer);
      clearTimeout(deadlineTimer);
      await pending;
    },
  };
};
