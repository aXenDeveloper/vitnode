const BASE_DELAY_SECONDS = 10;
const MAX_DELAY_SECONDS = 60 * 60;

/**
 * Exponential backoff for a failed queue task. `attempts` is the number of
 * attempts already made (>= 1); the delay grows as
 * `BASE_DELAY_SECONDS * 2^(attempts - 1)`, capped at {@link MAX_DELAY_SECONDS}.
 */
export const getQueueBackoffDate = (
  attempts: number,
  from: Date = new Date(),
): Date => {
  const exponent = Math.max(0, attempts - 1);
  const delaySeconds = Math.min(
    BASE_DELAY_SECONDS * 2 ** exponent,
    MAX_DELAY_SECONDS,
  );

  return new Date(from.getTime() + delaySeconds * 1000);
};
