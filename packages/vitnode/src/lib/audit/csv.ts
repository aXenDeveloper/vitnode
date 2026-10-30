/** Characters a spreadsheet reads as the start of a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One CSV cell: `null` and `undefined` are empty, objects are JSON, and a
 * value a spreadsheet would run as a formula (`=HYPERLINK(...)`, `+1`, `@SUM`)
 * is prefixed with `'` so it is shown, not evaluated. Always quoted.
 */
export const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return '""';

  let text: string;
  if (value instanceof Date) text = value.toISOString();
  else if (typeof value === "string") text = value;
  else if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    text = value.toString();
  } else text = JSON.stringify(value) ?? "";

  if (FORMULA_START.test(text)) text = `'${text}`;

  return `"${text.replaceAll('"', '""')}"`;
};

/** A CSV document - header row first, CRLF line endings (RFC 4180). */
export const toCsv = (
  header: readonly string[],
  rows: readonly (readonly unknown[])[],
): string =>
  [header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
