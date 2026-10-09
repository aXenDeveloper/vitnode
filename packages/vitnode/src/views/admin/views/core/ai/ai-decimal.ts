export const toAiDecimal = (value: number, fractionDigits = 6): string => {
  const fixed = Math.max(value, 0).toFixed(fractionDigits);

  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
};

export const fromAiDecimal = (value: null | string): null | number =>
  value === null ? null : Number(value);
