export interface SearchCollection {
  indexed: number;
  itemType: string;
  lastIndexedAt: Date | null | string;
  pluginId: string;
  total: number;
}

export type CollectionStatus = "empty" | "indexed" | "stale";

// Nothing indexed yet, partially indexed (fewer items than the source has), or
// fully covered — the three states the coverage report distinguishes.
export const getCollectionStatus = ({
  indexed,
  total,
}: Pick<SearchCollection, "indexed" | "total">): CollectionStatus => {
  if (indexed === 0) return "empty";
  if (indexed < total) return "stale";

  return "indexed";
};

export const getCollectionCoverage = ({
  indexed,
  total,
}: Pick<SearchCollection, "indexed" | "total">): number =>
  total > 0 ? Math.round((indexed / total) * 100) : 0;
