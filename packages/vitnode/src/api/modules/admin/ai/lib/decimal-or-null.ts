import { formatDecimal, parseDecimal } from "@/api/lib/ai/decimal";

export const decimalOrNull = (value: null | string | undefined) =>
  value === null || value === undefined
    ? null
    : formatDecimal(parseDecimal(value));
