import { describe, expect, it } from "vitest";

import { isSidebarOpenInCookies } from "./sidebar-cookie";

describe("isSidebarOpenInCookies", () => {
  it("stays open until someone collapses it", () => {
    expect(isSidebarOpenInCookies(undefined)).toBe(true);
    expect(isSidebarOpenInCookies("vitnode_locale=pl")).toBe(true);
    expect(isSidebarOpenInCookies("sidebar_state=true")).toBe(true);
  });

  it("remembers a collapsed sidebar among other cookies", () => {
    expect(
      isSidebarOpenInCookies("vitnode_locale=pl; sidebar_state=false; a=b"),
    ).toBe(false);
  });

  it("ignores a cookie whose name only ends the same way", () => {
    expect(isSidebarOpenInCookies("old_sidebar_state=false")).toBe(true);
  });
});
