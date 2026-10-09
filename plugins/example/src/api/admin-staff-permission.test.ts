// @vitest-environment node
import { findAdminRoutesWithoutStaffPermission } from "@vitnode/core/api/lib/route";
import { describe, expect, it } from "vitest";

import { exampleApiPlugin } from "@/config.api";

describe("example admin routes", () => {
  it("all require a staff permission", () => {
    const { hono } = exampleApiPlugin();

    expect(hono.routes.some(route => route.path.includes("/admin/"))).toBe(
      true,
    );
    expect(findAdminRoutesWithoutStaffPermission(hono)).toEqual([]);
  });
});
