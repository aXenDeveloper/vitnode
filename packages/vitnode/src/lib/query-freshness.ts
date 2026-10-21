/**
 * `staleTime` for data that changes from minute to minute, such as counters
 * and queues: 15 seconds.
 */
export const OPERATIONAL_STALE_TIME = 15_000;

/**
 * `staleTime` for records people read more often than they change, such as
 * content and containers: one minute. The default of `contentListQueryOptions`;
 * invalidate the query after a write instead of shortening it.
 */
export const RECORD_STALE_TIME = 60_000;
