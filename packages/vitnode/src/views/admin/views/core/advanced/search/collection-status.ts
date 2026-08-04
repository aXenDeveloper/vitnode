export interface SearchCollection {
  indexed: number;
  itemType: string;
  lastIndexedAt: Date | null | string;
  pluginId: string;
  total: number;
}

export type CollectionStatus = "empty" | "indexed" | "stale";

/**
 * Nothing indexed, exactly covered, or out of step.
 *
 * "Out of step" is any mismatch, in **either** direction. Fewer documents than
 * source records means something was missed; more means documents survive for
 * records that no longer qualify - and calling that one healthy is how a stale
 * index stays invisible.
 */
export const getCollectionStatus = ({
  indexed,
  total,
}: Pick<SearchCollection, "indexed" | "total">): CollectionStatus => {
  if (indexed === 0) return "empty";
  if (indexed === total) return "indexed";

  return "stale";
};

/**
 * Indexed items as a percentage of source items.
 *
 * Can exceed 100 - that is the point, and the number is shown as it is. Use
 * {@link getCollectionCoverageBar} for the width of anything drawn.
 */
export const getCollectionCoverage = ({
  indexed,
  total,
}: Pick<SearchCollection, "indexed" | "total">): number => {
  if (total > 0) return Math.round((indexed / total) * 100);

  return indexed > 0 ? 100 : 0;
};

export const getCollectionCoverageBar = (
  collection: Pick<SearchCollection, "indexed" | "total">,
): number => Math.min(getCollectionCoverage(collection), 100);
