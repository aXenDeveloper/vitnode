/**
 * A form's number as the decimal string the AI API takes. Money never travels
 * as a float, and `String(1e-7)` is not a decimal the API would accept.
 */
export const toAiDecimal = (value: number, fractionDigits = 6): string => {
  const fixed = Math.max(value, 0).toFixed(fractionDigits);

  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
};

/** The API's decimal string as a form's number. */
export const fromAiDecimal = (value: null | string): null | number =>
  value === null ? null : Number(value);
