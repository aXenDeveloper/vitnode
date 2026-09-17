import { describe, expect, it } from "vitest";

import { createBlockInstance } from "../../blocks/instance";
import { classifyZoneEntries, describeInvalidEntry } from "./classify";

const block = (text: string) =>
  createBlockInstance("core:text", { body: text });

describe("classifyZoneEntries", () => {
  it("keeps every valid block in the order it was stored", () => {
    const [a, b] = [block("a"), block("b")];

    expect(classifyZoneEntries([a, b])).toStrictEqual({
      blocks: [a, b],
      invalid: [],
    });
  });

  it("holds on to a malformed value instead of dropping it", () => {
    const [a, b] = [block("a"), block("b")];
    const malformed = { foo: "bar" };

    expect(classifyZoneEntries([a, malformed, b])).toStrictEqual({
      blocks: [a, b],
      invalid: [{ index: 1, value: malformed }],
    });
  });

  it("records the index the malformed value was stored at", () => {
    const { invalid } = classifyZoneEntries([
      null,
      block("a"),
      "text",
      block("b"),
      42,
    ]);

    expect(invalid.map(entry => entry.index)).toStrictEqual([0, 2, 4]);
  });

  it("refuses an envelope whose id is not a block instance id", () => {
    const broken = { data: {}, id: "not a valid id", type: "core:text" };

    expect(classifyZoneEntries([broken]).invalid).toStrictEqual([
      { index: 0, value: broken },
    ]);
  });

  it("keeps the first of two blocks sharing an id and quarantines the second", () => {
    const first = block("a");
    const clash = { ...block("b"), id: first.id };

    const { blocks, invalid } = classifyZoneEntries([first, clash]);

    expect(blocks).toStrictEqual([first]);
    expect(invalid).toStrictEqual([{ index: 1, value: clash }]);
  });

  it("treats a missing field as an empty zone", () => {
    expect(classifyZoneEntries(undefined)).toStrictEqual({
      blocks: [],
      invalid: [],
    });
    expect(classifyZoneEntries(null)).toStrictEqual({
      blocks: [],
      invalid: [],
    });
  });
});

describe("describeInvalidEntry", () => {
  it("prints the shape an editor has to recognise it by", () => {
    expect(describeInvalidEntry({ foo: "bar" })).toBe('{"foo":"bar"}');
    expect(describeInvalidEntry(["a"])).toBe('["a"]');
    expect(describeInvalidEntry("legacy")).toBe('"legacy"');
    expect(describeInvalidEntry(null)).toBe("null");
    expect(describeInvalidEntry(42)).toBe("42");
  });

  it("survives a value JSON cannot print", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(describeInvalidEntry(circular)).toBe("{…}");
    expect(describeInvalidEntry(10n)).toBe("10n");
  });

  it("truncates rather than filling the panel", () => {
    expect(describeInvalidEntry("x".repeat(400))).toHaveLength(120);
  });
});
