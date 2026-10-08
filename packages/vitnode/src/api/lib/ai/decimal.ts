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

export const parseDecimalOrNull = (
  value: null | string | undefined,
): Decimal | null =>
  value === null || value === undefined ? null : parseDecimal(value);

export const decimalFromNumber = (value: number): Decimal => {
  if (!Number.isFinite(value)) {
    throw new DecimalParseError(String(value));
  }
  const text = value.toFixed(DECIMAL_SCALE + 2);

  return parseDecimal(text);
};

export const decimalFromInteger = (value: bigint | number): Decimal =>
  BigInt(value) * SCALE_FACTOR;

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

export const multiplyDecimal = (a: Decimal, b: Decimal): Decimal =>
  divideRound(a * b, SCALE_FACTOR);

export const multiplyByInteger = (
  amount: Decimal,
  count: bigint | number,
): Decimal => amount * BigInt(count);

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

const divideRound = (numerator: bigint, denominator: bigint): bigint => {
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const quotient = (n * 2n + d) / (d * 2n);

  return negative ? -quotient : quotient;
};
