import { describe, expect, it } from "vitest";

import type { StaffPermissionSet } from "@/api/lib/permission-staff";

import { EMPTY_STAFF_PERMISSION_SET } from "@/api/lib/staff-permission";

import type { AdminAccess } from "./state";

import {
  ADMIN_ENTRY_PATH,
  ADMIN_HOME_PATH,
  ADMIN_SESSION_QUERY_KEY,
  adminPermissionsOf,
  adminSessionFailureFromError,
  adminSessionFailureFromStatus,
  adminSessionReadFromStatus,
  canEnterAdmin,
  hasAdminPermission,
  isAdminAccess,
} from "./state";

/**
 * The admin access rules, as a table.
 *
 * No render, no request, no DOM - `./state` imports nothing at runtime except
 * the permission predicate every frontend already shares, which is what lets the
 * whole policy be exercised here rather than through a browser. What is being
 * pinned is the half whose being wrong is *silent*: a status the AdminCP would
 * read as a denial, or a permission set an outage would produce.
 */

interface TestSession {
  permissions: StaffPermissionSet;
  user: { id: number };
}

const sessionWith = (permissions: StaffPermissionSet): TestSession => ({
  permissions,
  user: { id: 1 },
});

const granted = (
  permissions: StaffPermissionSet,
): AdminAccess<TestSession> => ({
  session: sessionWith(permissions),
  status: "granted",
});

const denied: AdminAccess<TestSession> = { status: "denied" };

const setOf = (
  ...permissions: { module: string; permission: string; plugin: string }[]
): StaffPermissionSet => ({ permissions, root: false });

describe("the status policy", () => {
  it("reads 200 with a body as the only success", () => {
    expect(adminSessionReadFromStatus(200, sessionWith(setOf()))).toEqual({
      session: sessionWith(setOf()),
      status: "granted",
    });
  });

  it("reads 403 as the only denial", () => {
    expect(adminSessionReadFromStatus(403)).toEqual({ status: "denied" });
  });

  /**
   * The assertion this whole feature exists for.
   *
   * A rate limit and a failing database are not permission decisions, and an
   * AdminCP that reads them as one signs every administrator out during an
   * outage - then presents them with a sign-in form for a session they already
   * hold, because the sign-in screen is where a denied administrator is sent.
   */
  it.each([429, 500, 502, 503, 504])("never reads %i as a denial", status => {
    const read = adminSessionReadFromStatus(status);

    expect(read).toEqual({ httpStatus: status, status: "api_error" });
    expect(read.status).not.toBe("denied");
  });

  /**
   * The reason the policy is an allowlist rather than `status >= 400`.
   *
   * Each of these is a reply an inverted rule would have read as an
   * administrator holding no permissions: a `204` with no body, a `302` a
   * redirect-following fetch turned into somebody's login page, a `401` from a
   * proxy in front of the API.
   */
  it.each([204, 301, 302, 401, 418])(
    "never reads %i as a grant or a denial",
    status => {
      expect(adminSessionReadFromStatus(status).status).toBe("api_error");
    },
  );

  it("refuses a 200 that carried no body", () => {
    // The route's `200` is declared with a schema, so an empty one is a reply
    // this layer cannot honour. Calling it a grant would hand `undefined` to
    // everything that reads `session.permissions`.
    expect(adminSessionReadFromStatus(200)).toEqual({
      httpStatus: 200,
      status: "api_error",
    });
  });

  it("agrees with the no-body helper the server read uses", () => {
    // `readAdminSessionOnApi` calls `adminSessionFailureFromStatus` rather than
    // the full mapper, so the two must not be able to drift.
    for (const status of [401, 403, 429, 500]) {
      expect(adminSessionFailureFromStatus(status)).toEqual(
        adminSessionReadFromStatus(status),
      );
    }
  });
});

describe("classifying a raised failure", () => {
  it("reads a fetch TypeError as a network failure", () => {
    expect(adminSessionFailureFromError(new TypeError("fetch failed"))).toEqual(
      { status: "network_error" },
    );
  });

  it("reads anything else as an API failure", () => {
    // `rawApiFetch` throws a plain Error for a 500, carrying the failing URL.
    expect(
      adminSessionFailureFromError(new Error("500 - https://api.invalid/x")),
    ).toEqual({ status: "api_error" });
  });

  it("never classifies a failure as a decision", () => {
    for (const error of [new TypeError("x"), new Error("y"), "z", null]) {
      expect(isAdminAccess(adminSessionFailureFromError(error))).toBe(false);
    }
  });
});

describe("telling a decision from a failure", () => {
  it.each([
    [{ session: sessionWith(setOf()), status: "granted" as const }, true],
    [{ status: "denied" as const }, true],
    [{ httpStatus: 500, status: "api_error" as const }, false],
    [{ status: "network_error" as const }, false],
  ])("%o is a decision: %s", (read, expected) => {
    expect(isAdminAccess(read)).toBe(expected);
  });
});

describe("entering the AdminCP", () => {
  it("lets a granted session in", () => {
    expect(canEnterAdmin(granted(setOf()))).toBe(true);
  });

  it("keeps a denied one out", () => {
    expect(canEnterAdmin(denied)).toBe(false);
  });

  it("lets an administrator with no permissions in", () => {
    // Being *inside* the AdminCP and being able to *do* anything in it are
    // different questions. Every core screen is reachable by URL to any
    // administrator and gates its content instead; the nav hides the link and
    // Hono refuses the data.
    expect(canEnterAdmin(granted(EMPTY_STAFF_PERMISSION_SET))).toBe(true);
  });
});

describe("the permission set an access decision carries", () => {
  it("is the session's when granted", () => {
    const permissions = setOf({
      module: "users",
      permission: "can_view",
      plugin: "@vitnode/core",
    });

    expect(adminPermissionsOf(granted(permissions))).toBe(permissions);
  });

  /**
   * A denial is a real answer, not a failure signal: the API was asked and said
   * this browser holds no admin session, so it holds no admin permissions. A
   * *failed* read never reaches here - it rejects in the query - which is why
   * this can be an empty set without being ambiguous.
   */
  it("is the shared empty set when denied", () => {
    expect(adminPermissionsOf(denied)).toBe(EMPTY_STAFF_PERMISSION_SET);
  });

  it("hands back a set nobody can push into", () => {
    expect(() =>
      (adminPermissionsOf(denied).permissions as unknown[]).push({}),
    ).toThrow();
  });
});

describe("checking one permission", () => {
  const usersView = {
    module: "users",
    permission: "can_view",
    plugin: "@vitnode/core",
  };

  it("finds a permission the administrator holds", () => {
    expect(hasAdminPermission(granted(setOf(usersView)), usersView)).toBe(true);
  });

  it("refuses one they do not", () => {
    expect(
      hasAdminPermission(granted(setOf(usersView)), {
        ...usersView,
        permission: "can_delete",
      }),
    ).toBe(false);
  });

  it("refuses everything for a denied session", () => {
    expect(hasAdminPermission(denied, usersView)).toBe(false);
  });

  it("defaults the plugin to core", () => {
    expect(
      hasAdminPermission(granted(setOf(usersView)), {
        module: "users",
        permission: "can_view",
      }),
    ).toBe(true);
  });

  /**
   * The namespacing rule that makes a plugin's permissions its own. A plugin
   * declares `module`/`permission` strings that may collide with core's, and the
   * `plugin` field is what keeps a grant under one from opening the other.
   */
  it("does not let a core grant open a plugin's page", () => {
    expect(
      hasAdminPermission(granted(setOf(usersView)), {
        module: "users",
        permission: "can_view",
        plugin: "@vitnode/blog",
      }),
    ).toBe(false);
  });

  it("does not let a plugin grant open a core page", () => {
    const blogView = { ...usersView, plugin: "@vitnode/blog" };

    expect(
      hasAdminPermission(granted(setOf(blogView)), {
        module: "users",
        permission: "can_view",
      }),
    ).toBe(false);
  });

  /** Root short-circuits, in every plugin and for every module. */
  it("grants everything to root", () => {
    const rootSet: StaffPermissionSet = { permissions: [], root: true };

    expect(
      hasAdminPermission(granted(rootSet), {
        module: "anything",
        permission: "at_all",
        plugin: "@someone/else",
      }),
    ).toBe(true);
  });

  it("does not grant root to a denied session", () => {
    // There is no session to be root *of*. The empty set is `root: false`, and
    // this is the assertion that keeps it that way.
    expect(EMPTY_STAFF_PERMISSION_SET.root).toBe(false);
    expect(hasAdminPermission(denied, { module: "m", permission: "p" })).toBe(
      false,
    );
  });
});

describe("the cache key", () => {
  it("is two segments and names no user", () => {
    // The browser does not know who the admin cookie belongs to until the query
    // answers, so a user id in the key could only come from the *public*
    // session - a different cookie, which can name a different person or nobody.
    // Isolation is bought by lifetime instead; see `removeAdminSession`.
    expect(ADMIN_SESSION_QUERY_KEY).toEqual(["vitnode", "admin-session"]);
  });

  it("is not the public session's key", () => {
    expect(ADMIN_SESSION_QUERY_KEY).not.toContain("session");
  });
});

describe("the AdminCP's paths", () => {
  it("carry no locale prefix", () => {
    expect(ADMIN_ENTRY_PATH).toBe("/admin");
    expect(ADMIN_HOME_PATH).toBe("/admin/core");
  });

  it("put the home page under the entry, not beside it", () => {
    // What makes the `_admin` guard's redirect to `/admin` incapable of looping:
    // the home page is a descendant, so it is guarded, and the entry is not.
    expect(ADMIN_HOME_PATH.startsWith(`${ADMIN_ENTRY_PATH}/`)).toBe(true);
  });
});
