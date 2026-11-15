import { formatDecimal, parseDecimal } from "@/lib/ai/decimal";

export const decimalOrNull = (value: null | string | undefined) =>
  value === null || value === undefined
    ? null
    : formatDecimal(parseDecimal(value));
