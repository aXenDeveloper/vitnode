import { describe, expect, it } from "vitest";

import {
  getCollectionCoverage,
  getCollectionCoverageBar,
  getCollectionStatus,
} from "./collection-status";

/** A registered collection: an indexer exists, so `total` is a real count. */
const registered = (indexed: number, total: number) => ({
  hasIndexer: true,
  indexed,
  total,
});

/**
 * A collection with no rebuild indexer, and so no source count. It may still be
 * kept current by live `search.index()` writes - that is why the status only
 * claims it is outside the rebuild system.
 */
const unmanaged = (indexed: number) => ({
  hasIndexer: false,
  indexed,
  total: null,
});

describe("getCollectionStatus", () => {
  it("reports empty when nothing is indexed", () => {
    expect(getCollectionStatus(registered(0, 0))).toBe("empty");
    expect(getCollectionStatus(registered(0, 10))).toBe("empty");
  });

  it("reports stale when fewer items are indexed than the source has", () => {
    expect(getCollectionStatus(registered(5, 10))).toBe("stale");
  });

  it("reports indexed only when the counts match exactly", () => {
    expect(getCollectionStatus(registered(10, 10))).toBe("indexed");
  });

  it("reports stale when more items are indexed than the source has", () => {
    // Documents surviving for records that no longer qualify. Calling this
    // healthy is how a stale index stays invisible.
    expect(getCollectionStatus(registered(11, 10))).toBe("stale");
    expect(getCollectionStatus(registered(10, 0))).toBe("stale");
  });

  it("never calls an over-indexed collection healthy", () => {
    for (const indexed of [1, 2, 11, 100]) {
      expect(getCollectionStatus(registered(indexed, 0))).not.toBe("indexed");
    }
    expect(getCollectionStatus(registered(11, 10))).not.toBe("indexed");
  });

  describe("collections with no rebuild indexer", () => {
    it("reports unmanaged when documents have no indexer", () => {
      expect(getCollectionStatus(unmanaged(11))).toBe("unmanaged");
    });

    it("decides on indexer availability before comparing counts", () => {
      // The trap this exists for: the old `total = indexed` fallback made
      // `indexed === total` true, so an unrebuildable collection read as healthy.
      expect(
        getCollectionStatus({ hasIndexer: false, indexed: 11, total: 11 }),
      ).toBe("unmanaged");
      expect(
        getCollectionStatus({ hasIndexer: false, indexed: 1, total: 1 }),
      ).toBe("unmanaged");
    });

    it("reports empty rather than unmanaged when there is nothing indexed", () => {
      // Nothing indexed, so nothing to say about how it would be rebuilt.
      expect(getCollectionStatus(unmanaged(0))).toBe("empty");
    });
  });
});

describe("getCollectionCoverage", () => {
  it("returns a whole-percent ratio of indexed to total", () => {
    expect(getCollectionCoverage(registered(5, 10))).toBe(50);
    expect(getCollectionCoverage(registered(10, 10))).toBe(100);
  });

  it("returns 0 when there is nothing to cover", () => {
    expect(getCollectionCoverage(registered(0, 0))).toBe(0);
    expect(getCollectionCoverage(registered(0, 10))).toBe(0);
  });

  it("rounds to the nearest percent", () => {
    expect(getCollectionCoverage(registered(1, 3))).toBe(33);
  });

  it("reports past 100 rather than hiding an over-indexed collection", () => {
    expect(getCollectionCoverage(registered(11, 10))).toBe(110);
    expect(getCollectionCoverage(registered(10, 0))).toBe(100);
  });

  it("returns null when there is no source count", () => {
    // Not 100: there is nothing to be complete against.
    expect(getCollectionCoverage(unmanaged(11))).toBeNull();
    expect(getCollectionCoverage(unmanaged(0))).toBeNull();
  });
});

describe("getCollectionCoverageBar", () => {
  it("clamps the drawn width to the track", () => {
    expect(getCollectionCoverageBar(registered(11, 10))).toBe(100);
    expect(getCollectionCoverageBar(registered(200, 10))).toBe(100);
  });

  it("matches the measured coverage below the cap", () => {
    expect(getCollectionCoverageBar(registered(5, 10))).toBe(50);
    expect(getCollectionCoverageBar(registered(0, 10))).toBe(0);
  });

  it("draws nothing without a source count", () => {
    expect(getCollectionCoverageBar(unmanaged(11))).toBeNull();
  });
});
