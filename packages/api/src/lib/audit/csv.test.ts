import { describe, expect, it } from "vitest";

import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it.each([
    ['=HYPERLINK("http://x")', `"'=HYPERLINK(""http://x"")"`],
    ["+1", `"'+1"`],
    ["-2", `"'-2"`],
    ["@SUM(A1)", `"'@SUM(A1)"`],
    ["\tcmd", `"'\tcmd"`],
    ["\rcmd", `"'\rcmd"`],
    ['say "hi"', `"say ""hi"""`],
    ["plain", `"plain"`],
    [null, `""`],
    [undefined, `""`],
    [42, `"42"`],
    [false, `"false"`],
    [new Date("2026-01-02T00:00:00.000Z"), `"2026-01-02T00:00:00.000Z"`],
    [{ a: "b" }, `"{""a"":""b""}"`],
  ])("%j -> %s", (value, cell) => {
    expect(csvCell(value)).toBe(cell);
  });
});

describe("toCsv", () => {
  it("writes the header first and joins rows with CRLF", () => {
    expect(
      toCsv(
        ["id", "label"],
        [
          [1, "A"],
          [2, "=B"],
        ],
      ),
    ).toBe(`"id","label"\r\n"1","A"\r\n"2","'=B"`);
  });
});
