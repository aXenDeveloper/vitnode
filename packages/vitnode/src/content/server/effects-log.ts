import type { Context } from "hono";

import type { EventEmitResult } from "../../api/models/events";

export const CONTENT_EFFECTS_LOG_PREFIX = "[content-effects]";

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
