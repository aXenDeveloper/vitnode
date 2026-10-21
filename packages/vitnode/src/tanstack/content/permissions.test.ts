import { describe, expect, it } from "vitest";

import { contentPermissionBatches } from "./permissions";

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

describe("contentPermissionBatches", () => {
  it.each<[string, (number | string)[], number, (number | string)[][]]>([
    ["nothing for no ids", [], 50, []],
    ["repeated numbers once", [3, 1, 3, 2, 1], 50, [[1, 2, 3]]],
    ["repeated strings once", ["b", "a", "b"], 50, [["a", "b"]]],
    [
      "caller order across batches, each batch sorted as strings",
      [9, 10, 3, 1, 2],
      2,
      [[10, 9], [1, 3], [2]],
    ],
  ])("returns %s", (_label, ids, size, expected) => {
    expect(contentPermissionBatches(ids, size)).toStrictEqual(expected);
  });

  it("cuts 120 ids into batches of 50, 50 and 20", () => {
    const batches = contentPermissionBatches(range(1, 120));

    expect(batches.map(batch => batch.length)).toStrictEqual([50, 50, 20]);
    expect(batches.flat().toSorted((a, b) => a - b)).toStrictEqual(
      range(1, 120),
    );
  });

  it("leaves earlier full batches untouched when ids are appended", () => {
    const before = contentPermissionBatches(range(1, 100));
    const after = contentPermissionBatches([
      ...range(1, 100),
      ...range(101, 130),
    ]);

    expect(after.slice(0, 2)).toStrictEqual(before);
    expect(after[2]).toHaveLength(30);
  });
});
