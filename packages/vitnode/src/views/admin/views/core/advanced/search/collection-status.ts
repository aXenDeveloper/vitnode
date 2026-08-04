export interface SearchCollection {
  /** Whether an indexer is registered for this item type right now. */
  hasIndexer: boolean;
  indexed: number;
  itemType: string;
  lastIndexedAt: Date | null | string;
  pluginId: string;
  /** Source items the indexer reports; `null` when there is no indexer. */
  total: null | number;
}

export type CollectionStatus = "empty" | "indexed" | "orphaned" | "stale";

/**
 * Nothing indexed, exactly covered, out of step, or abandoned.
 *
 * "Out of step" is any mismatch, in **either** direction. Fewer documents than
 * source records means something was missed; more means documents survive for
 * records that no longer qualify - and calling that one healthy is how a stale
 * index stays invisible.
 *
 * "Orphaned" comes first and does not look at the counts at all: documents with
 * no registered indexer have no source to be compared against, so `indexed`
 * matching `total` would only mean the fallback matched itself.
 */
export const getCollectionStatus = ({
  hasIndexer,
  indexed,
  total,
}: Pick<
  SearchCollection,
  "hasIndexer" | "indexed" | "total"
>): CollectionStatus => {
  if (!hasIndexer && indexed > 0) return "orphaned";
  if (indexed === 0) return "empty";
  if (indexed === total) return "indexed";

  return "stale";
};

/**
 * Indexed items as a percentage of source items, or `null` when there is no
 * source count to divide by.
 *
 * Can exceed 100 - that is the point, and the number is shown as it is. Use
 * {@link getCollectionCoverageBar} for the width of anything drawn.
 */
export const getCollectionCoverage = ({
  indexed,
  total,
}: Pick<SearchCollection, "indexed" | "total">): null | number => {
  if (total === null) return null;
  if (total > 0) return Math.round((indexed / total) * 100);

  return indexed > 0 ? 100 : 0;
};

export const getCollectionCoverageBar = (
  collection: Pick<SearchCollection, "indexed" | "total">,
): null | number => {
  const coverage = getCollectionCoverage(collection);

  return coverage === null ? null : Math.min(coverage, 100);
};
