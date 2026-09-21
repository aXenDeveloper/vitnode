import { describe, expect, test, vi } from "vitest";

import {
  loadLucideIcon,
  loadLucideIcons,
  preloadAllLucideIcons,
  readLucideIcon,
  seedLucideIcons,
  subscribeLucideIcons,
} from "./icon-registry";

describe("loadLucideIcon", () => {
  test("resolves icon data for a canonical name", async () => {
    const icon = await loadLucideIcon("house");

    expect(icon?.name).toBe("house");
    expect(icon?.node.length).toBeGreaterThan(0);
  });

  test("resolves an alias name", async () => {
    const [alias, canonical] = await Promise.all([
      loadLucideIcon("home"),
      loadLucideIcon("house"),
    ]);

    expect(alias?.node).toStrictEqual(canonical?.node);
  });

  test("returns undefined for an unknown name", async () => {
    await expect(loadLucideIcon("not-a-real-icon")).resolves.toBeUndefined();
  });

  test("returns a stable promise per name", () => {
    expect(loadLucideIcon("camera")).toBe(loadLucideIcon("camera"));
  });

  test("fills the synchronous cache and notifies subscribers", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLucideIcons(listener);

    expect(readLucideIcon("anchor")).toBeUndefined();

    await loadLucideIcon("anchor");

    expect(readLucideIcon("anchor")?.name).toBe("anchor");
    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });

  test("remembers a miss so it is never fetched twice", async () => {
    await loadLucideIcon("not-a-real-icon");

    expect(readLucideIcon("not-a-real-icon")).toBeNull();
  });
});

describe("seedLucideIcons", () => {
  test("makes seeded icons readable synchronously", async () => {
    const house = await loadLucideIcon("house");

    if (!house) throw new Error("house must resolve");

    seedLucideIcons({ "seeded-house": house, "seeded-miss": null });

    expect(readLucideIcon("seeded-house")).toBe(house);
    expect(readLucideIcon("seeded-miss")).toBeNull();
    await expect(loadLucideIcon("seeded-house")).resolves.toBe(house);
  });
});

describe("preloadAllLucideIcons", () => {
  test("caches every name the picker offers and marks the rest as missing", async () => {
    await preloadAllLucideIcons();

    const { names } = await loadLucideIcons();
    const cold = names.filter(name => !readLucideIcon(name));

    expect(cold).toStrictEqual([]);
    expect(readLucideIcon("definitely-not-an-icon")).toBeNull();
  });
});
