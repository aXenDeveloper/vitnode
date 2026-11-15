const BASE_DELAY_SECONDS = 10;
const MAX_DELAY_SECONDS = 60 * 60;

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
