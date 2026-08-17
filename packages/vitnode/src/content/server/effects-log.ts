import type { Context } from "hono";

import type { EventEmitResult } from "../../api/models/events";

/**
 * The prefix every Content Engine post-commit failure is logged behind.
 *
 * Greppable on purpose, and distinct from `[content-search]`, which
 * `syncContentSearch` already owns: an operator looking for "why did nobody
 * hear about this publish" is asking a different question from "why is this
 * article missing from search", and one prefix for both would make neither
 * answerable.
 */
export const CONTENT_EFFECTS_LOG_PREFIX = "[content-effects]";

/**
 * Reports listeners that did not receive an event whose mutation **has already
 * committed**.
 *
 * `EventsModel.emit` reports rather than throws, so `failures` is the only place
 * a dead listener or a broker outage is visible at all. Two things follow from
 * the write having committed, and they are the whole contract:
 *
 * 1. **The request still succeeds.** The row is in the database; answering 500
 *    would tell the client its edit was lost when it was not, and it would
 *    invite a retry that creates a second version of everything.
 * 2. **The failure is never swallowed.** It goes to `core_logs` behind
 *    {@link CONTENT_EFFECTS_LOG_PREFIX} with the content type, the item and the
 *    listener that failed, so the AdminCP log viewer can find it and an operator
 *    can replay whatever the listener was meant to do.
 *
 * Delivery is **at-least-once** where a retry is involved (the scheduled effects
 * task) and best-effort otherwise (an interactive route). There is no outbox and
 * no exactly-once guarantee; a listener that must act once keys off the
 * identifiers in the payload.
 *
 * A result with no failures logs nothing - an expected success is not an error,
 * and a log full of them is a log nobody reads.
 */
export const reportContentEventFailures = async (
  c: Context,
  {
    action,
    contentTypeId,
    event,
    itemId,
    locale,
  }: {
    action: string;
    contentTypeId: string;
    event: EventEmitResult | null;
    itemId: number;
    /** Present only for a translation mutation. */
    locale?: string;
  },
): Promise<void> => {
  if (!event || event.failures.length === 0) return;

  const message = `${CONTENT_EFFECTS_LOG_PREFIX} ${JSON.stringify({
    action,
    contentTypeId,
    delivered: event.delivered,
    eventId: event.eventId,
    failures: event.failures.map(failure => ({
      error: failure.error,
      listener: `${failure.pluginId}:${failure.module}:${failure.listener}`,
    })),
    itemId,
    ...(locale === undefined ? {} : { locale }),
  })}`;

  try {
    await c.get("log").error(message);
  } catch {
    // The logger writes to the database, so it can fail for the same reason the
    // transport did. Both are best effort *after* a committed write, and neither
    // may turn it into a failed request - so the console is the last resort.
    // eslint-disable-next-line no-console
    console.error(`[VitNode] ${message}`);
  }
};
