/**
 * Fixed-point decimal money. Every amount is a `bigint` of 10^-12 units, so a
 * price of $0.075 per million tokens (7.5e-8 per token) is exact, and summing
 * a thousand calls never drifts the way JavaScript floats do.
 *
 * Amounts cross the API and the database as decimal strings. PostgreSQL stores
 * them as `numeric(24, 12)`, the same scale, so a round trip is lossless.
 */

export const DECIMAL_SCALE = 12;
const SCALE_FACTOR = 10n ** BigInt(DECIMAL_SCALE);

export type Decimal = bigint;

const DECIMAL_PATTERN = /^(-)?(\d+)(?:\.(\d+))?$/;

export class DecimalParseError extends Error {
  constructor(value: string) {
    super(`"${value}" is not a decimal number.`);
    this.name = "DecimalParseError";
  }
}

/** Parses `"0.0003"`, `"12"` or `"-1.5"`. Digits beyond the scale are rounded half up. */
export const parseDecimal = (value: string): Decimal => {
  const match = DECIMAL_PATTERN.exec(value.trim());
  if (!match) throw new DecimalParseError(value);
  const [, sign, whole, fraction = ""] = match;

  const kept = fraction.slice(0, DECIMAL_SCALE).padEnd(DECIMAL_SCALE, "0");
  let units = BigInt(whole) * SCALE_FACTOR + BigInt(kept);
  const dropped = fraction.slice(DECIMAL_SCALE);
  if (dropped.length > 0 && Number(dropped[0]) >= 5) units += 1n;

  return sign ? -units : units;
};

/** `null` in, `null` out - unknown stays unknown. */
export const parseDecimalOrNull = (
  value: null | string | undefined,
): Decimal | null =>
  value === null || value === undefined ? null : parseDecimal(value);

/**
 * From a provider-reported JavaScript number. Goes through the shortest string
 * that round-trips the float, not through float arithmetic.
 */
export const decimalFromNumber = (value: number): Decimal => {
  if (!Number.isFinite(value)) {
    throw new DecimalParseError(String(value));
  }
  const text = value.toFixed(DECIMAL_SCALE + 2);

  return parseDecimal(text);
};

export const decimalFromInteger = (value: bigint | number): Decimal =>
  BigInt(value) * SCALE_FACTOR;

/** Canonical string, trailing zeros trimmed: `"0.0003"`, `"12"`. */
export const formatDecimal = (value: Decimal): string => {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / SCALE_FACTOR;
  const fraction = (absolute % SCALE_FACTOR)
    .toString()
    .padStart(DECIMAL_SCALE, "0")
    .replace(/0+$/, "");

  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
};

export const formatDecimalOrNull = (value: Decimal | null): null | string =>
  value === null ? null : formatDecimal(value);

/** `a * b` for two decimals, rounded half up at the scale. */
export const multiplyDecimal = (a: Decimal, b: Decimal): Decimal =>
  divideRound(a * b, SCALE_FACTOR);

/** `amount * count`, where `count` is a whole number such as tokens. */
export const multiplyByInteger = (
  amount: Decimal,
  count: bigint | number,
): Decimal => amount * BigInt(count);

/** `a / b`, rounded half up at the scale. */
export const divideDecimal = (a: Decimal, b: Decimal): Decimal => {
  if (b === 0n) throw new RangeError("Division by zero.");

  return divideRound(a * SCALE_FACTOR, b);
};

export const divideByInteger = (
  amount: Decimal,
  count: bigint | number,
): Decimal => {
  if (BigInt(count) === 0n) throw new RangeError("Division by zero.");

  return divideRound(amount, BigInt(count));
};

export const sumDecimals = (values: Decimal[]): Decimal =>
  values.reduce((total, value) => total + value, 0n);

export const maxDecimal = (a: Decimal, b: Decimal): Decimal => (a > b ? a : b);
export const minDecimal = (a: Decimal, b: Decimal): Decimal => (a < b ? a : b);

const divideRound = (numerator: bigint, denominator: bigint): bigint => {
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const quotient = (n * 2n + d) / (d * 2n);

  return negative ? -quotient : quotient;
};

/** Rounds up to the scale's last digit - for reservations, never down. */
export const ceilDivideDecimal = (a: Decimal, b: Decimal): Decimal => {
  if (b <= 0n) throw new RangeError("Division by a non-positive number.");
  const numerator = a * SCALE_FACTOR;

  return numerator >= 0n ? (numerator + b - 1n) / b : -(-numerator / b);
};
