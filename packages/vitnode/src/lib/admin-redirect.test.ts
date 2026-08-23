import { describe, expect, it } from "vitest";

import {
  ADMIN_SIGN_IN_PATH,
  getAdminSignInHref,
  sanitizeAdminRedirect,
} from "./admin-redirect";

describe("sanitizeAdminRedirect", () => {
  it("keeps AdminCP paths, query string included", () => {
    expect(sanitizeAdminRedirect("/admin/core/users")).toBe(
      "/admin/core/users",
    );
    expect(sanitizeAdminRedirect("/admin/core/users?page=2&sort=name")).toBe(
      "/admin/core/users?page=2&sort=name",
    );
  });

  it("rejects anything that would leave the origin", () => {
    expect(sanitizeAdminRedirect("//evil.example/admin")).toBeUndefined();
    expect(sanitizeAdminRedirect("/\\evil.example/admin")).toBeUndefined();
    expect(sanitizeAdminRedirect("https://evil.example")).toBeUndefined();
    expect(sanitizeAdminRedirect("/admin/core\\..\\..\\evil")).toBeUndefined();
    expect(sanitizeAdminRedirect("admin/core")).toBeUndefined();
  });

  it("rejects paths outside the AdminCP", () => {
    expect(sanitizeAdminRedirect("/settings")).toBeUndefined();
    expect(sanitizeAdminRedirect("/administrators")).toBeUndefined();
    expect(sanitizeAdminRedirect("/admin/../settings")).toBeUndefined();
  });

  it("rejects the sign-in page, which would be a loop", () => {
    expect(sanitizeAdminRedirect("/admin")).toBeUndefined();
    expect(
      sanitizeAdminRedirect("/admin?redirect=/admin/core"),
    ).toBeUndefined();
  });

  it("rejects a missing value", () => {
    expect(sanitizeAdminRedirect(null)).toBeUndefined();
    expect(sanitizeAdminRedirect(undefined)).toBeUndefined();
    expect(sanitizeAdminRedirect("")).toBeUndefined();
  });
});

describe("getAdminSignInHref", () => {
  it("remembers where the admin was", () => {
    expect(getAdminSignInHref("/admin/core/users?page=2")).toEqual({
      pathname: ADMIN_SIGN_IN_PATH,
      query: { redirect: "/admin/core/users?page=2" },
    });
  });

  it("falls back to the bare sign-in page", () => {
    expect(getAdminSignInHref("/admin")).toBe(ADMIN_SIGN_IN_PATH);
    expect(getAdminSignInHref(null)).toBe(ADMIN_SIGN_IN_PATH);
  });
});
