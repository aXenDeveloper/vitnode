import { describe, expect, it } from "vitest";

import type { AnyBlockInstance } from "../../blocks/types";
import type { EditorZoneMount, VisualEditorState } from "../state/types";

import { createBlockInstance } from "../../blocks/instance";
import {
  initialVisualEditorState,
  unsafeZoneIds,
  visualEditorReducer,
} from "../state/reducer";
import { createMemoryAdapter } from "./memory";
import { buildInvalidSnapshot, buildSaveInput } from "./save-input";

const block = (text: string): AnyBlockInstance =>
  createBlockInstance("core:text", { body: text });

const mount = (
  id: string,
  blocks: readonly AnyBlockInstance[],
): EditorZoneMount => ({
  allowedBlocks: undefined,
  blocks,
  id,
  invalid: [],
  registry: undefined,
});

const mounted = (...zones: readonly EditorZoneMount[]): VisualEditorState =>
  zones.reduce(
    (state, zone) => visualEditorReducer(state, { type: "mount", zone }),
    initialVisualEditorState,
  );

describe("buildSaveInput", () => {
  it("carries every mounted zone and names only the changed ones", () => {
    const [a, b, c] = [block("a"), block("b"), block("c")];
    const state = visualEditorReducer(
      mounted(mount("main", [a, b]), mount("aside", [c])),
      { ref: { blockId: b.id, zoneId: "main" }, type: "remove" },
    );

    const input = buildSaveInput(state);

    expect(input.changedZoneIds).toStrictEqual(["main"]);
    expect(Object.keys(input.zones)).toStrictEqual(["main", "aside"]);
    expect(input.zones.main).toStrictEqual([a]);
    expect(input.zones.aside).toStrictEqual([c]);
  });

  it("changes nothing to report on a page nobody edited", () => {
    const input = buildSaveInput(mounted(mount("main", [block("a")])));

    expect(input.changedZoneIds).toStrictEqual([]);
    expect(Object.keys(input.zones)).toStrictEqual(["main"]);
  });

  it("hands over the very arrays a save is later rebaselined to", () => {
    const state = mounted(mount("main", [block("a")]), mount("aside", []));

    const input = buildSaveInput(state);

    expect(input.zones.main).toBe(state.zones.main.blocks);
    expect(input.zones.aside).toBe(state.zones.aside.blocks);
  });

  it("is empty before any zone mounts", () => {
    expect(buildSaveInput(initialVisualEditorState)).toStrictEqual({
      changedZoneIds: [],
      zones: {},
    });
  });
});

describe("createMemoryAdapter", () => {
  it("records what it was asked to save", async () => {
    const seen: string[][] = [];
    const adapter = createMemoryAdapter({
      onSave: input => {
        seen.push([...input.changedZoneIds]);
      },
    });
    const state = visualEditorReducer(mounted(mount("main", [])), {
      index: 0,
      instance: block("a"),
      type: "insert",
      zoneId: "main",
    });

    await adapter.save(buildSaveInput(state));

    expect(adapter.saves).toHaveLength(1);
    expect(adapter.saves[0].zones.main).toHaveLength(1);
    expect(seen).toStrictEqual([["main"]]);
  });
});

describe("a zone holding a value the editor could not read", () => {
  const malformed = { foo: "bar" };

  it("names the zone unsafe, because the payload it would send drops the value", () => {
    const [a, b] = [block("a"), block("b")];
    const state = mounted({
      ...mount("main", [a, b]),
      invalid: [{ index: 1, value: malformed }],
    });

    expect(unsafeZoneIds(state)).toStrictEqual(["main"]);
    expect(buildSaveInput(state).zones.main).toStrictEqual([a, b]);
  });

  it("baselines every mounted zone, so a save cannot rebase onto a later value", () => {
    const entries = [{ index: 0, value: malformed }];
    const state = mounted(
      { ...mount("main", []), invalid: entries },
      mount("aside", [block("c")]),
    );

    expect(buildInvalidSnapshot(state)).toStrictEqual({
      aside: [],
      main: entries,
    });
  });
});
