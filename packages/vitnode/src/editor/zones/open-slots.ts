/**
 * How many empty cells an area draws after the widgets it already holds.
 *
 * An area is a grid, so a widget that does not fill the last row leaves places
 * beside it a drop can land in - and a place nobody can see is a place nobody
 * uses. Empty, it offers one per column; part-filled, it offers exactly enough
 * to finish the row; full to the zone's cap, it offers none, because there is
 * nowhere for the next widget to go.
 */
export const areaOpenSlots = ({
  children,
  columns,
  full,
}: {
  children: number;
  columns: number;
  full: boolean;
}): number => {
  if (children === 0) return columns;
  if (full) return 0;

  return (columns - (children % columns)) % columns;
};
