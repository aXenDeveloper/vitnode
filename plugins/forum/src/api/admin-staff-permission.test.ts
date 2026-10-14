import { findAdminRoutesWithoutStaffPermission } from "@vitnode/core/api/lib/route";
import { describe, expect, it } from "vitest";

import { forumApiPlugin } from "@/config.api";

describe("forum admin routes", () => {
  it("all require a staff permission", () => {
    const { hono } = forumApiPlugin();

    expect(hono.routes.some(route => route.path.includes("/admin/"))).toBe(
      true,
    );
    expect(findAdminRoutesWithoutStaffPermission(hono)).toEqual([]);
  });
});
