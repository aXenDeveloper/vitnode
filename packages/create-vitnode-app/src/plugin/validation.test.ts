import { describe, expect, it } from "vitest";

import { reservedPluginNameProblem } from "./validation.js";

describe("reservedPluginNameProblem", () => {
  it.each(["admin", "api", "login", "users"])(
    "refuses %s, a route core already serves",
    name => {
      expect(reservedPluginNameProblem(name)).toContain(`/${name}`);
    },
  );

  it.each(["blog", "forum", "admin-tools"])("accepts %s", name => {
    expect(reservedPluginNameProblem(name)).toBeNull();
  });
});
