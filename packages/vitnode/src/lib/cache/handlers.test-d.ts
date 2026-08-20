import type {
  CacheEntry,
  CacheHandler,
} from "next/dist/server/lib/cache-handlers/types";

import { assertType, describe, it } from "vitest";

import type { UseCacheEntry, UseCacheHandler } from "./use-cache-handler";

import useCacheHandler from "./use-cache-handler";

/**
 * The handlers declare their own copies of Next's cache-handler contracts, so a
 * moved or renamed internal type cannot break `tsc -p tsconfig.build.json` for
 * everyone. This is where that copy is checked against the real thing.
 *
 * A failure here is not a bug in the handler - it means Next changed the
 * contract, and the handler needs reviewing against the new one before the next
 * release. That is a deliberately louder signal than a runtime cache miss.
 */
describe("use cache handler", () => {
  it("implements Next's CacheHandler contract", () => {
    assertType<CacheHandler>(useCacheHandler);
  });

  it("keeps its local entry type in step with Next's", () => {
    assertType<UseCacheEntry>({} as CacheEntry);
    assertType<CacheEntry>({} as UseCacheEntry);
  });

  it("keeps its local handler type in step with Next's", () => {
    assertType<UseCacheHandler>({} as CacheHandler);
  });
});
