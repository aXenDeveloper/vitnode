import { describe, expect, it } from "vitest";

import {
  getCollectionCoverage,
  getCollectionStatus,
} from "./collection-status";

describe("getCollectionStatus", () => {
  it("reports empty when nothing is indexed", () => {
    expect(getCollectionStatus({ indexed: 0, total: 12 })).toBe("empty");
    expect(getCollectionStatus({ indexed: 0, total: 0 })).toBe("empty");
  });

  it("reports stale when fewer items are indexed than the source has", () => {
    expect(getCollectionStatus({ indexed: 6, total: 8 })).toBe("stale");
  });

  it("reports indexed when coverage is complete", () => {
    expect(getCollectionStatus({ indexed: 2, total: 2 })).toBe("indexed");
  });

  it("never reports stale when the indexed count exceeds the source count", () => {
    expect(getCollectionStatus({ indexed: 5, total: 3 })).toBe("indexed");
  });
});

describe("getCollectionCoverage", () => {
  it("returns a whole-percent ratio of indexed to total", () => {
    expect(getCollectionCoverage({ indexed: 6, total: 8 })).toBe(75);
    expect(getCollectionCoverage({ indexed: 2, total: 2 })).toBe(100);
  });

  it("returns 0 when there is nothing to cover", () => {
    expect(getCollectionCoverage({ indexed: 0, total: 0 })).toBe(0);
  });

  it("rounds to the nearest percent", () => {
    expect(getCollectionCoverage({ indexed: 1, total: 3 })).toBe(33);
  });
});
