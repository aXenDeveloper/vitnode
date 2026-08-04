import { describe, expect, it } from "vitest";

import {
  getCollectionCoverage,
  getCollectionCoverageBar,
  getCollectionStatus,
} from "./collection-status";

describe("getCollectionStatus", () => {
  it("reports empty when nothing is indexed", () => {
    expect(getCollectionStatus({ indexed: 0, total: 0 })).toBe("empty");
    expect(getCollectionStatus({ indexed: 0, total: 10 })).toBe("empty");
  });

  it("reports stale when fewer items are indexed than the source has", () => {
    expect(getCollectionStatus({ indexed: 5, total: 10 })).toBe("stale");
  });

  it("reports indexed only when the counts match exactly", () => {
    expect(getCollectionStatus({ indexed: 10, total: 10 })).toBe("indexed");
  });

  it("reports stale when more items are indexed than the source has", () => {
    // Documents surviving for records that no longer qualify. Calling this
    // healthy is how a stale index stays invisible.
    expect(getCollectionStatus({ indexed: 11, total: 10 })).toBe("stale");
    expect(getCollectionStatus({ indexed: 10, total: 0 })).toBe("stale");
  });

  it("never calls an over-indexed collection healthy", () => {
    for (const indexed of [1, 2, 11, 100]) {
      expect(getCollectionStatus({ indexed, total: 0 })).not.toBe("indexed");
    }
    expect(getCollectionStatus({ indexed: 11, total: 10 })).not.toBe("indexed");
  });
});

describe("getCollectionCoverage", () => {
  it("returns a whole-percent ratio of indexed to total", () => {
    expect(getCollectionCoverage({ indexed: 5, total: 10 })).toBe(50);
    expect(getCollectionCoverage({ indexed: 10, total: 10 })).toBe(100);
  });

  it("returns 0 when there is nothing to cover", () => {
    expect(getCollectionCoverage({ indexed: 0, total: 0 })).toBe(0);
    expect(getCollectionCoverage({ indexed: 0, total: 10 })).toBe(0);
  });

  it("rounds to the nearest percent", () => {
    expect(getCollectionCoverage({ indexed: 1, total: 3 })).toBe(33);
  });

  it("reports past 100 rather than hiding an over-indexed collection", () => {
    expect(getCollectionCoverage({ indexed: 11, total: 10 })).toBe(110);
    expect(getCollectionCoverage({ indexed: 10, total: 0 })).toBe(100);
  });
});

describe("getCollectionCoverageBar", () => {
  it("clamps the drawn width to the track", () => {
    expect(getCollectionCoverageBar({ indexed: 11, total: 10 })).toBe(100);
    expect(getCollectionCoverageBar({ indexed: 200, total: 10 })).toBe(100);
  });

  it("matches the measured coverage below the cap", () => {
    expect(getCollectionCoverageBar({ indexed: 5, total: 10 })).toBe(50);
    expect(getCollectionCoverageBar({ indexed: 0, total: 10 })).toBe(0);
  });
});
