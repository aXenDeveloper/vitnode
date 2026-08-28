import { describe, expect, it } from "vitest";

import type { UserHeaderUser } from "./user-header-model";

import {
  USER_HEADER_HREF,
  userHeaderMenu,
  userHeaderState,
  userProfileHref,
} from "./user-header-model";

const user = (overrides: Partial<UserHeaderUser> = {}): UserHeaderUser => ({
  avatarColor: "ff0000",
  isAdmin: false,
  name: "Ada",
  nameCode: "ada",
  ...overrides,
});

/** Every item across every group, in the order they are drawn. */
const keysOf = (groups: ReturnType<typeof userHeaderMenu>): string[] =>
  groups.flat().map(item => item.key);

describe("the menu a signed-in visitor gets", () => {
  it("is the three account links, in order", () => {
    expect(keysOf(userHeaderMenu(user()))).toEqual([
      "my_profile",
      "files",
      "settings",
    ]);
  });

  it("points each one at the path that owns it", () => {
    const items = userHeaderMenu(user({ nameCode: "ada" })).flat();
    const href = (key: string) => items.find(item => item.key === key)?.href;

    expect(href("my_profile")).toBe("/users/ada");
    expect(href("files")).toBe(USER_HEADER_HREF.files);
    expect(href("settings")).toBe(USER_HEADER_HREF.settings);
  });

  it("never returns an empty group, so a separator always has items above it", () => {
    for (const isAdmin of [false, true]) {
      for (const group of userHeaderMenu(user({ isAdmin }))) {
        expect(group.length).toBeGreaterThan(0);
      }
    }
  });

  it("gives every item a distinct key", () => {
    const keys = keysOf(userHeaderMenu(user({ isAdmin: true })));

    expect(new Set(keys).size).toBe(keys.length);
  });

  // The moderator item pointed at `/mod_cp`, which no application serves, behind
  // a flag the session route hardcodes to `false`. It is not carried over.
  it("has no moderator item", () => {
    expect(keysOf(userHeaderMenu(user({ isAdmin: true })))).not.toContain(
      "mod_cp",
    );
  });
});

describe("the AdminCP item", () => {
  it("is absent for a visitor who is not an admin", () => {
    expect(keysOf(userHeaderMenu(user({ isAdmin: false })))).not.toContain(
      "admin_cp",
    );
    expect(userHeaderMenu(user({ isAdmin: false }))).toHaveLength(1);
  });

  it("is present for an admin, in its own group after the account links", () => {
    const groups = userHeaderMenu(user({ isAdmin: true }));

    expect(groups).toHaveLength(2);
    expect(keysOf([groups[1]])).toEqual(["admin_cp"]);
  });

  it("points at the AdminCP and opens in a new tab", () => {
    const adminCp = userHeaderMenu(user({ isAdmin: true }))
      .flat()
      .find(item => item.key === "admin_cp");

    expect(adminCp?.href).toBe(USER_HEADER_HREF.adminCp);
    expect(adminCp?.newTab).toBe(true);
  });

  it("does not change the account links it is added to", () => {
    expect(keysOf([userHeaderMenu(user({ isAdmin: true }))[0]])).toEqual(
      keysOf(userHeaderMenu(user({ isAdmin: false }))),
    );
  });
});

describe("a profile href", () => {
  it("escapes the name code rather than interpolating it raw", () => {
    expect(userProfileHref("a b/c")).toBe("/users/a%20b%2Fc");
  });

  it("leaves an ordinary name code alone", () => {
    expect(userProfileHref("ada-lovelace_1")).toBe("/users/ada-lovelace_1");
  });
});

describe("the state the header renders", () => {
  it("is authenticated when the session names a user", () => {
    const session = { user: user() };

    expect(userHeaderState({ session })).toEqual({
      status: "authenticated",
      user: session.user,
    });
  });

  it("is anonymous when the session answered with nobody", () => {
    expect(userHeaderState({ session: { user: null } })).toEqual({
      status: "anonymous",
    });
  });

  it("is loading while nothing has been read yet", () => {
    expect(userHeaderState({})).toEqual({ status: "loading" });
    expect(userHeaderState({ isError: false, session: undefined })).toEqual({
      status: "loading",
    });
  });

  // The Next.js header has always rendered the guest controls here, because
  // `getSessionApi()` answers `{ user: null }` for any non-200. Note this is a
  // *rendering* decision and not the one a route guard makes with the same
  // failure - `ensureAuthState` rejects rather than signing anybody out.
  it("is anonymous when the read failed with nothing cached", () => {
    expect(userHeaderState({ isError: true })).toEqual({
      status: "anonymous",
    });
  });

  it("keeps a signed-in visitor through a failed refetch", () => {
    const session = { user: user() };

    expect(userHeaderState({ isError: true, session })).toEqual({
      status: "authenticated",
      user: session.user,
    });
  });

  it("shows the guest controls, not a stuck placeholder, on a failed refetch of an anonymous session", () => {
    expect(userHeaderState({ isError: true, session: { user: null } })).toEqual(
      { status: "anonymous" },
    );
  });
});
