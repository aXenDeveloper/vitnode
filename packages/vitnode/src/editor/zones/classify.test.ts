import { describe, expect, it } from "vitest";

import { createAreaInstance } from "../../blocks/area";
import { createBlockInstance } from "../../blocks/instance";
import { classifyZoneEntries, describeInvalidEntry } from "./classify";

const block = (text: string) =>
  createBlockInstance("core:text", { body: text });

const area = (children: ReturnType<typeof block>[] = []) =>
  createAreaInstance({ children });

describe("classifyZoneEntries", () => {
  it("keeps every valid block in the order it was stored", () => {
    const [a, b] = [block("a"), block("b")];

    expect(classifyZoneEntries([a, b])).toStrictEqual({
      invalid: [],
      nodes: [a, b],
    });
  });

  it("holds on to a malformed value instead of dropping it", () => {
    const [a, b] = [block("a"), block("b")];
    const malformed = { foo: "bar" };

    expect(classifyZoneEntries([a, malformed, b])).toStrictEqual({
      invalid: [{ index: 1, value: malformed }],
      nodes: [a, b],
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

    const { invalid, nodes } = classifyZoneEntries([first, clash]);

    expect(nodes).toStrictEqual([first]);
    expect(invalid).toStrictEqual([{ index: 1, value: clash }]);
  });

  it("treats a missing field as an empty zone", () => {
    expect(classifyZoneEntries(undefined)).toStrictEqual({
      invalid: [],
      nodes: [],
    });
    expect(classifyZoneEntries(null)).toStrictEqual({
      invalid: [],
      nodes: [],
    });
  });
});

describe("classifyZoneEntries, reading an area", () => {
  it("keeps a well formed area with its children", () => {
    const child = block("inside");
    const holder = area([child]);

    expect(classifyZoneEntries([holder])).toStrictEqual({
      invalid: [],
      nodes: [holder],
    });
  });

  it("keeps an empty area, which is a layout the page still owns", () => {
    const holder = area();

    expect(classifyZoneEntries([holder]).nodes).toStrictEqual([holder]);
  });

  it("quarantines an area stored with a layout it cannot read", () => {
    const broken = { ...area(), layout: { columns: 7 } };

    expect(classifyZoneEntries([broken])).toStrictEqual({
      invalid: [{ index: 0, value: broken }],
      nodes: [],
    });
  });

  it("quarantines an area whose children are not an array", () => {
    const broken = { ...area(), children: { 0: block("a") } };

    expect(classifyZoneEntries([broken]).invalid).toStrictEqual([
      { index: 0, value: broken },
    ]);
  });

  it("quarantines an area holding a malformed child, and keeps nothing of it", () => {
    const broken = { ...area(), children: [block("a"), { foo: "bar" }] };

    expect(classifyZoneEntries([broken])).toStrictEqual({
      invalid: [{ index: 0, value: broken }],
      nodes: [],
    });
  });

  it("quarantines an area nested inside an area", () => {
    const nested = { ...area(), children: [area([block("a")])] };

    expect(classifyZoneEntries([nested])).toStrictEqual({
      invalid: [{ index: 0, value: nested }],
      nodes: [],
    });
  });

  it("never re-reads a broken area as a plain block", () => {
    const broken = {
      ...area(),
      children: "nope",
      data: { body: "a" },
      type: "core:text",
    };

    const { invalid, nodes } = classifyZoneEntries([broken]);

    expect(nodes).toStrictEqual([]);
    expect(invalid).toStrictEqual([{ index: 0, value: broken }]);
  });

  it("quarantines an area whose child id is already taken elsewhere in the zone", () => {
    const first = block("a");
    const holder = { ...area(), children: [{ ...block("b"), id: first.id }] };

    const { invalid, nodes } = classifyZoneEntries([first, holder]);

    expect(nodes).toStrictEqual([first]);
    expect(invalid).toStrictEqual([{ index: 1, value: holder }]);
  });

  it("quarantines an area repeating one id inside its own children", () => {
    const child = block("a");
    const holder = { ...area(), children: [child, { ...child }] };

    expect(classifyZoneEntries([holder]).invalid).toStrictEqual([
      { index: 0, value: holder },
    ]);
  });

  it("quarantines a block whose id an area already claimed", () => {
    const child = block("inside");
    const holder = area([child]);
    const clash = { ...block("b"), id: child.id };

    const { invalid, nodes } = classifyZoneEntries([holder, clash]);

    expect(nodes).toStrictEqual([holder]);
    expect(invalid).toStrictEqual([{ index: 1, value: clash }]);
  });

  it("quarantines a second area sharing the first one's id", () => {
    const holder = area([block("a")]);
    const clash = { ...area([block("b")]), id: holder.id };

    const { invalid, nodes } = classifyZoneEntries([holder, clash]);

    expect(nodes).toStrictEqual([holder]);
    expect(invalid).toStrictEqual([{ index: 1, value: clash }]);
  });

  it("reads a legacy zone of plain blocks exactly as it always did", () => {
    const [a, b, c] = [block("a"), block("b"), block("c")];

    expect(classifyZoneEntries([a, b, c])).toStrictEqual({
      invalid: [],
      nodes: [a, b, c],
    });
  });

  it("keeps areas and blocks side by side, in the order they were stored", () => {
    const [a, b] = [block("a"), block("b")];
    const holder = area([block("inside")]);

    expect(classifyZoneEntries([a, holder, b]).nodes).toStrictEqual([
      a,
      holder,
      b,
    ]);
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
