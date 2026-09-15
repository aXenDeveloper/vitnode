import { describe, expect, test } from "vitest";

import { loadLucideIcon, loadLucideIcons } from "./icon-registry";

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

  test("resolves every name the picker offers", async () => {
    const { names } = await loadLucideIcons();
    const resolved = await Promise.all(names.map(loadLucideIcon));

    expect(resolved.filter(icon => !icon)).toStrictEqual([]);
  });

  test("returns undefined for an unknown name", async () => {
    await expect(loadLucideIcon("not-a-real-icon")).resolves.toBeUndefined();
  });

  test("returns a stable promise so React.use does not re-suspend", () => {
    expect(loadLucideIcon("camera")).toBe(loadLucideIcon("camera"));
  });
});
