import { describe, expect, it } from "vitest";

import { ADMIN_TABLE_MAX_PAGE_SIZE } from "@/views/admin/table/params";
import { MY_FILES_MAX_PAGE_SIZE } from "@/views/files/my-files-query";

import { asSearchValue, readFirstValue, readPageSize } from "./table-params";

describe("readFirstValue", () => {
  it("takes the first of a repeated parameter", () => {
    expect(readFirstValue(["25", "50"])).toBe("25");
  });

  it("takes the value of a single one", () => {
    expect(readFirstValue("25")).toBe("25");
  });

  it.each([
    [undefined, ""],
    [null, ""],
    [[], ""],
    ["", ""],
  ])(
    "reads %o as the empty string, which every caller rejects",
    (value, expected) => {
      expect(readFirstValue(value)).toBe(expected);
    },
  );

  it("keeps an empty first value rather than skipping to the second", () => {
    expect(readFirstValue(["", "50"])).toBe("");
  });
});

describe("asSearchValue", () => {
  it("passes a string through", () => {
    expect(asSearchValue("createdAt")).toBe("createdAt");
  });

  it("spells a finite number as the API would see it", () => {
    expect(asSearchValue(25)).toBe("25");
    expect(asSearchValue(0)).toBe("0");
    expect(asSearchValue(-1)).toBe("-1");
  });

  it("spells a boolean, which a router may have parsed one into", () => {
    expect(asSearchValue(true)).toBe("true");
    expect(asSearchValue(false)).toBe("false");
  });

  it("takes the first of an array, as the URL's repeated key", () => {
    expect(asSearchValue(["a", "b"])).toBe("a");
    expect(asSearchValue([25])).toBe("25");
  });

  it.each([
    ["nothing", undefined],
    ["a null", null],
    ["an object", { first: 25 }],
    ["a NaN", Number.NaN],
    ["an Infinity", Number.POSITIVE_INFINITY],
    ["an empty array", []],
  ])("refuses %s rather than inventing a spelling for it", (_name, value) => {
    expect(asSearchValue(value)).toBeUndefined();
  });
});

describe("readPageSize", () => {
  it("keeps a usable size", () => {
    expect(readPageSize("25", 100)).toBe("25");
  });

  it("clamps to the caller's own maximum", () => {
    expect(readPageSize("500", 100)).toBe("100");
    expect(readPageSize("500", 50)).toBe("50");
  });

  it("leaves a size at the maximum alone", () => {
    expect(readPageSize("100", 100)).toBe("100");
  });

  it.each(["abc", "0", "-1", "1.5", "", " ", "1e3", "25px", "+25", "Infinity"])(
    "refuses %o, so the caller falls back to its own default",
    raw => {
      expect(readPageSize(raw, 100)).toBeUndefined();
    },
  );

  it("refuses a size beyond what a safe integer can hold", () => {
    expect(readPageSize("9".repeat(30), 100)).toBeUndefined();
  });

  it("takes the maximum as an argument rather than owning one", () => {
    // The two callers' caps happen to agree today; neither is this module's.
    expect(readPageSize("500", MY_FILES_MAX_PAGE_SIZE)).toBe(
      String(MY_FILES_MAX_PAGE_SIZE),
    );
    expect(readPageSize("500", ADMIN_TABLE_MAX_PAGE_SIZE)).toBe(
      String(ADMIN_TABLE_MAX_PAGE_SIZE),
    );
  });
});
