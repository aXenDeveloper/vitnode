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

/**
 * What `total` is actually counting for this collection.
 *
 * A multi-language collection is indexed once per translation, and its indexer
 * counts published *translations* - so comparing that against distinct items
 * would report a fully-indexed collection with three languages as 33% covered.
 * One rule, read off the data rather than configured, so a collection that gains
 * a second language starts being measured correctly without anything being
 * switched on.
 */
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

/**
 * Nothing indexed, exactly covered, out of step, or outside the rebuild system.
 *
 * "Out of step" is any mismatch, in **either** direction. Fewer documents than
 * source records means something was missed; more means documents survive for
 * records that no longer qualify - and calling that one healthy is how a stale
 * index stays invisible.
 *
 * "Unmanaged" comes first and does not look at the counts at all: without an
 * indexer there is no source to compare against, so `indexed` matching `total`
 * would only mean the fallback matched itself. It says nothing about the plugin -
 * registering an indexer is optional, and a plugin that only ever calls
 * `search.index()` keeps its collection perfectly current without one. All that
 * is known is that a rebuild cannot reproduce it.
 */
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

/**
 * Indexed items as a percentage of source items, or `null` when there is no
 * source count to divide by.
 *
 * Can exceed 100 - that is the point, and the number is shown as it is. Use
 * {@link getCollectionCoverageBar} for the width of anything drawn.
 */
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
