// @vitest-environment node
import { findAdminRoutesWithoutStaffPermission } from "@vitnode/core/api/lib/route";
import { describe, expect, it } from "vitest";

import { blogApiPlugin } from "@/config.api";

describe("blog admin routes", () => {
  it("all require a staff permission", () => {
    const { hono } = blogApiPlugin();

    // Guards against passing vacuously on an empty route table.
    expect(hono.routes.some(route => route.path.includes("/admin/"))).toBe(
      true,
    );
    expect(findAdminRoutesWithoutStaffPermission(hono)).toEqual([]);
  });
});
