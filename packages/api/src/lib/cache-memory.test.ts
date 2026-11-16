import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MEMORY_CACHE_MAX_TTL_SECONDS, MemoryCacheStore } from "./cache-memory";

describe("MemoryCacheStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("caps a long TTL at the in-memory maximum", () => {
    const store = new MemoryCacheStore();
    store.set("key", "1", 3600);

    vi.advanceTimersByTime(MEMORY_CACHE_MAX_TTL_SECONDS * 1000 - 1);
    expect(store.get("key")).toBe("1");

    vi.advanceTimersByTime(1);
    expect(store.get("key")).toBeNull();
  });

  it("keeps a shorter TTL as given", () => {
    const store = new MemoryCacheStore();
    store.set("key", "1", 2);

    vi.advanceTimersByTime(2000);

    expect(store.get("key")).toBeNull();
  });

  it("honours a lock's TTL in full rather than capping it", () => {
    const store = new MemoryCacheStore();
    expect(store.setIfAbsent("lock", "1", 55)).toBe(true);

    vi.advanceTimersByTime(MEMORY_CACHE_MAX_TTL_SECONDS * 1000);
    expect(store.setIfAbsent("lock", "1", 55)).toBe(false);

    vi.advanceTimersByTime(55_000);
    expect(store.setIfAbsent("lock", "1", 55)).toBe(true);
  });

  it("evicts the least recently used key once full", () => {
    const store = new MemoryCacheStore(2);
    store.set("a", "1", 10);
    store.set("b", "2", 10);
    store.get("a");

    store.set("c", "3", 10);

    expect(store.get("a")).toBe("1");
    expect(store.get("b")).toBeNull();
    expect(store.get("c")).toBe("3");
  });
});
