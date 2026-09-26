import { describe, expect, it } from "vitest";

import { zoneDisplayName } from "./zone-name";

describe("zoneDisplayName", () => {
  it("capitalises a one-word zone", () => {
    expect(zoneDisplayName("header")).toBe("Header");
  });

  it("turns hyphens into spaces and keeps sentence case", () => {
    expect(zoneDisplayName("before-profile")).toBe("Before profile");
  });

  it("keeps digits readable", () => {
    expect(zoneDisplayName("column-2")).toBe("Column 2");
  });

  it("names every scope segment ahead of the zone", () => {
    expect(zoneDisplayName("settings:before-profile")).toBe(
      "Settings · Before profile",
    );
    expect(zoneDisplayName("blog:post:after-body")).toBe(
      "Blog · Post · After body",
    );
  });

  it("leaves an id that is not a zone id exactly as it was", () => {
    expect(zoneDisplayName("Not A Zone")).toBe("Not A Zone");
  });
});
