import { describe, expect, it } from "vitest";

import type { AnyBlockInstance } from "../../blocks/types";
import type { EditorZoneMount, VisualEditorState } from "./types";

import { createBlockInstance } from "../../blocks/instance";
import {
  changedZoneIds,
  findBlock,
  initialVisualEditorState,
  isVisualEditorDirty,
  visualEditorReducer,
} from "./reducer";

const block = (text: string): AnyBlockInstance =>
  createBlockInstance("core:text", { body: text });

const mount = (
  id: string,
  blocks: readonly AnyBlockInstance[],
  allowedBlocks?: EditorZoneMount["allowedBlocks"],
): EditorZoneMount => ({
  allowedBlocks,
  blocks,
  id,
  registry: undefined,
});

const mounted = (...zones: readonly EditorZoneMount[]): VisualEditorState =>
  zones.reduce(
    (state, zone) => visualEditorReducer(state, { type: "mount", zone }),
    initialVisualEditorState,
  );

const ids = (state: VisualEditorState, zoneId: string): string[] =>
  state.zones[zoneId].blocks.map(instance => instance.id);

describe("visualEditorReducer", () => {
  it("captures the incoming blocks as the baseline on the first mount", () => {
    const first = block("a");
    const state = mounted(mount("main", [first]));

    expect(state.order).toStrictEqual(["main"]);
    expect(state.zones.main.blocks).toStrictEqual([first]);
    expect(state.zones.main.initial).toStrictEqual([first]);
    expect(isVisualEditorDirty(state)).toBe(false);
  });

  it("never writes through the array it was mounted with", () => {
    const loaded = [block("a")];
    const state = visualEditorReducer(initialVisualEditorState, {
      type: "mount",
      zone: mount("main", loaded),
    });

    const next = visualEditorReducer(state, {
      index: 1,
      instance: block("b"),
      type: "insert",
      zoneId: "main",
    });

    expect(loaded).toHaveLength(1);
    expect(next.zones.main.blocks).toHaveLength(2);
    expect(next.zones.main.initial).toHaveLength(1);
  });

  it("keeps edits when the same zone mounts again", () => {
    const first = block("a");
    const added = block("b");
    const state = visualEditorReducer(mounted(mount("main", [first])), {
      index: 1,
      instance: added,
      type: "insert",
      zoneId: "main",
    });

    const remounted = visualEditorReducer(state, {
      type: "mount",
      zone: mount("main", [first]),
    });

    expect(ids(remounted, "main")).toStrictEqual([first.id, added.id]);
    expect(remounted.zones.main.initial).toStrictEqual([first]);
    expect(remounted).toBe(state);
  });

  it("refreshes the allowlist and registry on a later mount", () => {
    const state = mounted(mount("main", [block("a")], ["core:text"]));
    const same = visualEditorReducer(state, {
      type: "mount",
      zone: mount("main", [], ["core:text"]),
    });

    expect(same).toBe(state);

    const widened = visualEditorReducer(state, {
      type: "mount",
      zone: mount("main", [], "*"),
    });

    expect(widened.zones.main.allowedBlocks).toBe("*");
    expect(widened.zones.main.blocks).toStrictEqual(state.zones.main.blocks);
  });

  it("clamps the insert index into the zone", () => {
    const first = block("a");
    const late = block("b");
    const early = block("c");
    const state = visualEditorReducer(mounted(mount("main", [first])), {
      index: 99,
      instance: late,
      type: "insert",
      zoneId: "main",
    });
    const next = visualEditorReducer(state, {
      index: -4,
      instance: early,
      type: "insert",
      zoneId: "main",
    });

    expect(ids(next, "main")).toStrictEqual([early.id, first.id, late.id]);
  });

  it("ignores an insert into a zone that never mounted", () => {
    const state = mounted(mount("main", []));

    expect(
      visualEditorReducer(state, {
        index: 0,
        instance: block("a"),
        type: "insert",
        zoneId: "aside",
      }),
    ).toBe(state);
  });

  it("clears the selection when the selected block is removed", () => {
    const first = block("a");
    const second = block("b");
    const state = visualEditorReducer(mounted(mount("main", [first, second])), {
      blockId: second.id,
      type: "select",
    });

    const removed = visualEditorReducer(state, {
      blockId: second.id,
      type: "remove",
    });

    expect(ids(removed, "main")).toStrictEqual([first.id]);
    expect(removed.selectedBlockId).toBeNull();
    expect(removed.selectedZoneId).toBeNull();

    const other = visualEditorReducer(state, {
      blockId: first.id,
      type: "remove",
    });

    expect(other.selectedBlockId).toBe(second.id);
  });

  it("duplicates a block with a fresh id, deeply copied, and selects the copy", () => {
    const original = createBlockInstance("core:hero", {
      seo: { title: "a" },
      title: "Hello",
    });
    const state = visualEditorReducer(mounted(mount("main", [original])), {
      blockId: original.id,
      type: "duplicate",
    });

    const [, copy] = state.zones.main.blocks;

    expect(state.zones.main.blocks).toHaveLength(2);
    expect(copy.id).not.toBe(original.id);
    expect(copy.type).toBe(original.type);
    expect(copy.data).toStrictEqual(original.data);
    expect(copy.data.seo).not.toBe(original.data.seo);
    expect(state.selectedBlockId).toBe(copy.id);
    expect(state.selectedZoneId).toBe("main");
  });

  it("reorders inside one zone against the list without the moved block", () => {
    const [a, b, c] = [block("a"), block("b"), block("c")];
    const state = mounted(mount("main", [a, b, c]));

    expect(
      ids(
        visualEditorReducer(state, {
          blockId: a.id,
          toIndex: 2,
          toZoneId: "main",
          type: "move",
        }),
        "main",
      ),
    ).toStrictEqual([b.id, c.id, a.id]);

    expect(
      ids(
        visualEditorReducer(state, {
          blockId: c.id,
          toIndex: 0,
          toZoneId: "main",
          type: "move",
        }),
        "main",
      ),
    ).toStrictEqual([c.id, a.id, b.id]);

    expect(
      ids(
        visualEditorReducer(state, {
          blockId: b.id,
          toIndex: 1,
          toZoneId: "main",
          type: "move",
        }),
        "main",
      ),
    ).toStrictEqual([a.id, b.id, c.id]);
  });

  it("moves a block across zones and follows it with the selection", () => {
    const [a, b, c] = [block("a"), block("b"), block("c")];
    const state = visualEditorReducer(
      mounted(mount("main", [a, b]), mount("aside", [c])),
      { blockId: a.id, type: "select" },
    );

    const moved = visualEditorReducer(state, {
      blockId: a.id,
      toIndex: 0,
      toZoneId: "aside",
      type: "move",
    });

    expect(ids(moved, "main")).toStrictEqual([b.id]);
    expect(ids(moved, "aside")).toStrictEqual([a.id, c.id]);
    expect(moved.selectedZoneId).toBe("aside");
    expect(findBlock(moved, a.id)).toStrictEqual({
      index: 0,
      instance: a,
      zoneId: "aside",
    });
  });

  it("replaces a block's data instead of merging it", () => {
    const instance = createBlockInstance("core:text", {
      body: "a",
      heading: "h",
    });
    const state = visualEditorReducer(mounted(mount("main", [instance])), {
      blockId: instance.id,
      data: { body: "b" },
      type: "update",
    });

    expect(state.zones.main.blocks[0].data).toStrictEqual({ body: "b" });
    expect(isVisualEditorDirty(state)).toBe(true);
  });

  it("ignores an update that changes nothing", () => {
    const instance = createBlockInstance("core:text", {
      body: "a",
      seo: { title: "t" },
    });
    const state = mounted(mount("main", [instance]));

    expect(
      visualEditorReducer(state, {
        blockId: instance.id,
        data: { body: "a", seo: { title: "t" } },
        type: "update",
      }),
    ).toBe(state);
  });

  it("derives the selected zone and clears both on null", () => {
    const instance = block("a");
    const state = visualEditorReducer(mounted(mount("main", [instance])), {
      blockId: instance.id,
      type: "select",
    });

    expect(state.selectedZoneId).toBe("main");

    const cleared = visualEditorReducer(state, {
      blockId: null,
      type: "select",
    });

    expect(cleared.selectedBlockId).toBeNull();
    expect(cleared.selectedZoneId).toBeNull();
  });

  it("restores every zone on discard and clears the selection", () => {
    const [a, b, c] = [block("a"), block("b"), block("c")];
    const state = mounted(mount("main", [a, b]), mount("aside", [c]));
    const edited = visualEditorReducer(
      visualEditorReducer(state, { blockId: b.id, type: "remove" }),
      { index: 0, instance: block("d"), type: "insert", zoneId: "aside" },
    );
    const selected = visualEditorReducer(edited, {
      blockId: a.id,
      type: "select",
    });

    expect(changedZoneIds(selected)).toStrictEqual(["main", "aside"]);

    const discarded = visualEditorReducer(selected, { type: "discard" });

    expect(ids(discarded, "main")).toStrictEqual([a.id, b.id]);
    expect(ids(discarded, "aside")).toStrictEqual([c.id]);
    expect(discarded.selectedBlockId).toBeNull();
    expect(isVisualEditorDirty(discarded)).toBe(false);
  });

  it("rebaselines every zone once it is saved", () => {
    const [a, b] = [block("a"), block("b")];
    const state = visualEditorReducer(mounted(mount("main", [a])), {
      index: 1,
      instance: b,
      type: "insert",
      zoneId: "main",
    });

    expect(changedZoneIds(state)).toStrictEqual(["main"]);

    const saved = visualEditorReducer(state, { type: "saved" });

    expect(isVisualEditorDirty(saved)).toBe(false);
    expect(saved.zones.main.initial).toStrictEqual([a, b]);

    const discarded = visualEditorReducer(saved, { type: "discard" });

    expect(ids(discarded, "main")).toStrictEqual([a.id, b.id]);
  });

  it("is dirty for an edit and clean again once it is undone", () => {
    const instance = createBlockInstance("core:text", { body: "a" });
    const state = mounted(mount("main", [instance]));
    const edited = visualEditorReducer(state, {
      blockId: instance.id,
      data: { body: "b" },
      type: "update",
    });

    expect(isVisualEditorDirty(edited)).toBe(true);

    const undone = visualEditorReducer(edited, {
      blockId: instance.id,
      data: { body: "a" },
      type: "update",
    });

    expect(isVisualEditorDirty(undone)).toBe(false);
    expect(changedZoneIds(undone)).toStrictEqual([]);
  });

  it("stays clean when a block is moved away and back", () => {
    const [a, b] = [block("a"), block("b")];
    const state = mounted(mount("main", [a, b]));
    const moved = visualEditorReducer(state, {
      blockId: a.id,
      toIndex: 1,
      toZoneId: "main",
      type: "move",
    });

    expect(isVisualEditorDirty(moved)).toBe(true);

    const back = visualEditorReducer(moved, {
      blockId: a.id,
      toIndex: 0,
      toZoneId: "main",
      type: "move",
    });

    expect(isVisualEditorDirty(back)).toBe(false);
  });

  it("finds nothing for an unknown block", () => {
    const state = mounted(mount("main", [block("a")]));

    expect(findBlock(state, "MISSING")).toBeNull();
    expect(
      visualEditorReducer(state, { blockId: "MISSING", type: "select" }),
    ).toBe(state);
  });
});
