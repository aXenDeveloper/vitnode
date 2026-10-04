/**
 * AI points for display: at most one decimal place, and `<0.1` for any
 * positive amount too small to show - never a misleading `0`. Points are
 * kept at full precision everywhere else; this is presentation only.
 */
export const formatAiPoints = (
  points: null | string,
  locale = "en",
): string => {
  if (points === null) return "∞";
  const value = Number(points);
  if (!Number.isFinite(value)) return points;
  if (value > 0 && value < 0.1) {
    return `<${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(0.1)}`;
  }

  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    Math.floor(value * 10) / 10,
  );
};

/** USD for the AdminCP: small amounts keep enough digits to be meaningful. */
export const formatAiUsd = (usd: null | string, locale = "en"): string => {
  if (usd === null) return "—";
  const value = Number(usd);
  if (!Number.isFinite(value)) return usd;

  return new Intl.NumberFormat(locale, {
    currency: "USD",
    maximumFractionDigits: value !== 0 && Math.abs(value) < 0.01 ? 6 : 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
};
