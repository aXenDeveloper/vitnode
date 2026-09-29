export const ADMIN_SESSION_MIN_CHECK_DELAY_MS = 10_000;

const MAX_TIMEOUT_MS = 2_147_483_647;

export const adminSessionCheckDelay = (
  expiresAt: Date | string,
  now = Date.now(),
): number => {
  const remaining = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(remaining)) return ADMIN_SESSION_MIN_CHECK_DELAY_MS;

  return Math.min(
    Math.max(remaining, ADMIN_SESSION_MIN_CHECK_DELAY_MS),
    MAX_TIMEOUT_MS,
  );
};
