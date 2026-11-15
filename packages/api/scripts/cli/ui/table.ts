import { padEnd, padStart, visibleWidth } from "./colors";

export interface TableColumn {
  align?: "left" | "right";
  header: string;
}

export interface RenderTableOptions {
  columns: readonly TableColumn[];
  /** Paints the header row and the rule under it. */
  muted?: (text: string) => string;
  /** Cells may already be colored; widths ignore escape codes. */
  rows: readonly (readonly string[])[];
  /** The character the rule under the header is drawn with. */
  rule?: string;
}

const GAP = "   ";

/**
 * A plain aligned table: header, rule, rows. No borders - in a terminal the
 * alignment is the structure, and a box only adds characters to copy around.
 */
export const renderTable = ({
  columns,
  muted = text => text,
  rows,
  rule = "─",
}: RenderTableOptions): string[] => {
  const widths = columns.map((column, index) =>
    Math.max(
      visibleWidth(column.header),
      ...rows.map(row => visibleWidth(row[index] ?? "")),
    ),
  );

  const line = (cells: readonly string[]) =>
    columns
      .map((column, index) => {
        const cell = cells[index] ?? "";
        const width = widths[index];

        if (column.align === "right") return padStart(cell, width);

        // The last left-aligned column is not padded: trailing spaces are
        // invisible and only get in the way of a copy-paste.
        return index === columns.length - 1 ? cell : padEnd(cell, width);
      })
      .join(GAP)
      .trimEnd();

  const totalWidth =
    widths.reduce((sum, width) => sum + width, 0) +
    GAP.length * (columns.length - 1);

  return [
    muted(line(columns.map(column => column.header))),
    muted(rule.repeat(totalWidth)),
    ...rows.map(line),
  ];
};
