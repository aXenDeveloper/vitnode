import { findAdminRoutesWithoutStaffPermission } from "@vitnode/core/api/lib/route";
import { describe, expect, it } from "vitest";

import { newsroomApiPlugin } from "@/config.api";

describe("newsroom admin routes", () => {
  it("all require a staff permission", () => {
    const { hono } = newsroomApiPlugin();

    expect(hono.routes.some(route => route.path.includes("/admin/"))).toBe(
      true,
    );
    expect(findAdminRoutesWithoutStaffPermission(hono)).toEqual([]);
  });
});
