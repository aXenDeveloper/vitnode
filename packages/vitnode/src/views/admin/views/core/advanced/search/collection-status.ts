export interface SearchCollectionLanguage {
  documents: number;
  languageCode: string;
  lastIndexedAt: Date | null | string;
}

export interface SearchCollection {
  /** Index rows, counting one per language. */
  documents: number;
  /** Whether a rebuild indexer is registered for this item type right now. */
  hasIndexer: boolean;
  /** Distinct items in the index, however many languages each has. */
  indexed: number;
  itemType: string;
  /** One entry per language present in the index. Empty when there are none. */
  languages: SearchCollectionLanguage[];
  lastIndexedAt: Date | null | string;
  pluginId: string;
  /** Source items the indexer reports; `null` when there is no indexer. */
  total: null | number;
}

export const getCollectionIndexedCount = (
  collection: Partial<Pick<SearchCollection, "documents" | "languages">> &
    Pick<SearchCollection, "indexed">,
): number =>
  // Both optional, because this also reads responses from an API that predates
  // the per-language breakdown: no languages reported is the single-language
  // case, which is what it always was.
  (collection.languages?.length ?? 0) > 0
    ? (collection.documents ?? collection.indexed)
    : collection.indexed;

export type CollectionStatus = "empty" | "indexed" | "stale" | "unmanaged";

export const getCollectionStatus = (
  collection: Partial<Pick<SearchCollection, "documents" | "languages">> &
    Pick<SearchCollection, "hasIndexer" | "indexed" | "total">,
): CollectionStatus => {
  const indexed = getCollectionIndexedCount(collection);

  if (!collection.hasIndexer && indexed > 0) return "unmanaged";
  if (indexed === 0) return "empty";
  if (indexed === collection.total) return "indexed";

  return "stale";
};

export const getCollectionCoverage = (
  collection: Partial<Pick<SearchCollection, "documents" | "languages">> &
    Pick<SearchCollection, "indexed" | "total">,
): null | number => {
  const { total } = collection;
  const indexed = getCollectionIndexedCount(collection);

  if (total === null) return null;
  if (total > 0) return Math.round((indexed / total) * 100);

  return indexed > 0 ? 100 : 0;
};

export const getCollectionCoverageBar = (
  collection: Partial<Pick<SearchCollection, "documents" | "languages">> &
    Pick<SearchCollection, "indexed" | "total">,
): null | number => {
  const coverage = getCollectionCoverage(collection);

  return coverage === null ? null : Math.min(coverage, 100);
};
