import { describe, expect, it } from "vitest";

import type { AnyBlockInstance } from "../../blocks/types";
import type {
  EditorBlockRef,
  EditorZoneMount,
  VisualEditorState,
} from "./types";

import { createBlockInstance } from "../../blocks/instance";
import { buildInvalidSnapshot, buildSaveInput } from "../adapter/save-input";
import {
  changedZoneIds,
  findBlock,
  findBlockInZone,
  initialVisualEditorState,
  isVisualEditorDirty,
  unsafeZoneIds,
  visualEditorReducer,
} from "./reducer";

const block = (text: string): AnyBlockInstance =>
  createBlockInstance("core:text", { body: text });

const ref = (zoneId: string, blockId: string): EditorBlockRef => ({
  blockId,
  zoneId,
});

const mount = (
  id: string,
  blocks: readonly AnyBlockInstance[],
  allowedBlocks?: EditorZoneMount["allowedBlocks"],
): EditorZoneMount => ({
  allowedBlocks,
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

const ids = (state: VisualEditorState, zoneId: string): string[] =>
  state.zones[zoneId].blocks.map(instance => instance.id);

const inFlight = (state: VisualEditorState) =>
  ({
    invalid: buildInvalidSnapshot(state),
    snapshot: buildSaveInput(state).zones,
    type: "saved",
  }) as const;

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
      ref: ref("main", second.id),
      type: "select",
    });

    const removed = visualEditorReducer(state, {
      ref: ref("main", second.id),
      type: "remove",
    });

    expect(ids(removed, "main")).toStrictEqual([first.id]);
    expect(removed.selected).toBeNull();

    const other = visualEditorReducer(state, {
      ref: ref("main", first.id),
      type: "remove",
    });

    expect(other.selected).toStrictEqual({
      blockId: second.id,
      zoneId: "main",
    });
  });

  it("duplicates a block with a fresh id, deeply copied, and selects the copy", () => {
    const original = createBlockInstance("core:hero", {
      seo: { title: "a" },
      title: "Hello",
    });
    const state = visualEditorReducer(mounted(mount("main", [original])), {
      ref: ref("main", original.id),
      type: "duplicate",
    });

    const [, copy] = state.zones.main.blocks;

    expect(state.zones.main.blocks).toHaveLength(2);
    expect(copy.id).not.toBe(original.id);
    expect(copy.type).toBe(original.type);
    expect(copy.data).toStrictEqual(original.data);
    expect(copy.data.seo).not.toBe(original.data.seo);
    expect(state.selected).toStrictEqual({ blockId: copy.id, zoneId: "main" });
  });

  it("reorders inside one zone against the list without the moved block", () => {
    const [a, b, c] = [block("a"), block("b"), block("c")];
    const state = mounted(mount("main", [a, b, c]));

    expect(
      ids(
        visualEditorReducer(state, {
          blockId: a.id,
          fromZoneId: "main",
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
          fromZoneId: "main",
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
          fromZoneId: "main",
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
      { ref: ref("main", a.id), type: "select" },
    );

    const moved = visualEditorReducer(state, {
      blockId: a.id,
      fromZoneId: "main",
      toIndex: 0,
      toZoneId: "aside",
      type: "move",
    });

    expect(ids(moved, "main")).toStrictEqual([b.id]);
    expect(ids(moved, "aside")).toStrictEqual([a.id, c.id]);
    expect(moved.selected).toStrictEqual({ blockId: a.id, zoneId: "aside" });
    expect(findBlock(moved, ref("aside", a.id))).toStrictEqual({
      index: 0,
      instance: a,
    });
  });

  it("replaces a block's data instead of merging it", () => {
    const instance = createBlockInstance("core:text", {
      body: "a",
      heading: "h",
    });
    const state = visualEditorReducer(mounted(mount("main", [instance])), {
      data: { body: "b" },
      ref: ref("main", instance.id),
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
        data: { body: "a", seo: { title: "t" } },
        ref: ref("main", instance.id),
        type: "update",
      }),
    ).toBe(state);
  });

  it("carries the zone alongside the selected block and clears both on null", () => {
    const instance = block("a");
    const state = visualEditorReducer(mounted(mount("main", [instance])), {
      ref: ref("main", instance.id),
      type: "select",
    });

    expect(state.selected).toStrictEqual({
      blockId: instance.id,
      zoneId: "main",
    });

    const cleared = visualEditorReducer(state, { ref: null, type: "select" });

    expect(cleared.selected).toBeNull();
  });

  it("restores every zone on discard and clears the selection", () => {
    const [a, b, c] = [block("a"), block("b"), block("c")];
    const state = mounted(mount("main", [a, b]), mount("aside", [c]));
    const edited = visualEditorReducer(
      visualEditorReducer(state, { ref: ref("main", b.id), type: "remove" }),
      { index: 0, instance: block("d"), type: "insert", zoneId: "aside" },
    );
    const selected = visualEditorReducer(edited, {
      ref: ref("main", a.id),
      type: "select",
    });

    expect(changedZoneIds(selected)).toStrictEqual(["main", "aside"]);

    const discarded = visualEditorReducer(selected, { type: "discard" });

    expect(ids(discarded, "main")).toStrictEqual([a.id, b.id]);
    expect(ids(discarded, "aside")).toStrictEqual([c.id]);
    expect(discarded.selected).toBeNull();
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

    const saved = visualEditorReducer(state, inFlight(state));

    expect(isVisualEditorDirty(saved)).toBe(false);
    expect(saved.zones.main.initial).toStrictEqual([a, b]);

    const discarded = visualEditorReducer(saved, { type: "discard" });

    expect(ids(discarded, "main")).toStrictEqual([a.id, b.id]);
  });

  it("is dirty for an edit and clean again once it is undone", () => {
    const instance = createBlockInstance("core:text", { body: "a" });
    const state = mounted(mount("main", [instance]));
    const edited = visualEditorReducer(state, {
      data: { body: "b" },
      ref: ref("main", instance.id),
      type: "update",
    });

    expect(isVisualEditorDirty(edited)).toBe(true);

    const undone = visualEditorReducer(edited, {
      data: { body: "a" },
      ref: ref("main", instance.id),
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
      fromZoneId: "main",
      toIndex: 1,
      toZoneId: "main",
      type: "move",
    });

    expect(isVisualEditorDirty(moved)).toBe(true);

    const back = visualEditorReducer(moved, {
      blockId: a.id,
      fromZoneId: "main",
      toIndex: 0,
      toZoneId: "main",
      type: "move",
    });

    expect(isVisualEditorDirty(back)).toBe(false);
  });

  it("finds nothing for an unknown block", () => {
    const state = mounted(mount("main", [block("a")]));

    expect(findBlock(state, ref("main", "MISSING"))).toBeNull();
    expect(
      visualEditorReducer(state, {
        ref: ref("main", "MISSING"),
        type: "select",
      }),
    ).toBe(state);
  });
});

describe("the baseline a saved snapshot writes", () => {
  it("no edit during save: goes clean against the snapshot it sent", () => {
    const [a, b] = [block("a"), block("b")];
    const edited = visualEditorReducer(mounted(mount("main", [a])), {
      index: 1,
      instance: b,
      type: "insert",
      zoneId: "main",
    });
    const saved = visualEditorReducer(edited, inFlight(edited));

    expect(saved.zones.main.initial).toBe(edited.zones.main.blocks);
    expect(ids(saved, "main")).toStrictEqual([a.id, b.id]);
    expect(isVisualEditorDirty(saved)).toBe(false);
    expect(changedZoneIds(saved)).toStrictEqual([]);
  });

  it("edit during save: stays dirty, because the server never saw the late block", () => {
    const [a, b, late] = [block("a"), block("b"), block("c")];
    const sent = visualEditorReducer(mounted(mount("main", [a])), {
      index: 1,
      instance: b,
      type: "insert",
      zoneId: "main",
    });
    const sending = inFlight(sent);
    const current = visualEditorReducer(sent, {
      index: 2,
      instance: late,
      type: "insert",
      zoneId: "main",
    });

    const saved = visualEditorReducer(current, sending);

    expect(saved.zones.main.initial).toStrictEqual([a, b]);
    expect(ids(saved, "main")).toStrictEqual([a.id, b.id, late.id]);
    expect(isVisualEditorDirty(saved)).toBe(true);
    expect(changedZoneIds(saved)).toStrictEqual(["main"]);

    const settled = visualEditorReducer(saved, inFlight(saved));

    expect(isVisualEditorDirty(settled)).toBe(false);
  });

  it("names only the zones that still differ after a partial save", () => {
    const [a, b, c, d] = [block("a"), block("b"), block("c"), block("d")];
    const sent = visualEditorReducer(
      mounted(mount("main", [a]), mount("aside", [c])),
      { index: 1, instance: b, type: "insert", zoneId: "main" },
    );
    const sending = inFlight(sent);
    const current = visualEditorReducer(sent, {
      index: 1,
      instance: d,
      type: "insert",
      zoneId: "aside",
    });

    const saved = visualEditorReducer(current, sending);

    expect(changedZoneIds(saved)).toStrictEqual(["aside"]);
    expect(saved.zones.main.initial).toStrictEqual([a, b]);
    expect(saved.zones.aside.initial).toStrictEqual([c]);
  });

  it("leaves a zone that mounted after the save started on its own baseline", () => {
    const [a, c, d] = [block("a"), block("c"), block("d")];
    const sent = mounted(mount("main", [a]));
    const sending = inFlight(sent);
    const current = visualEditorReducer(
      visualEditorReducer(sent, { type: "mount", zone: mount("aside", [c]) }),
      { index: 1, instance: d, type: "insert", zoneId: "aside" },
    );

    const saved = visualEditorReducer(current, sending);

    expect(Object.keys(sending.snapshot)).toStrictEqual(["main"]);
    expect(saved.zones.aside.initial).toStrictEqual([c]);
    expect(changedZoneIds(saved)).toStrictEqual(["aside"]);
  });

  it("resurrects nothing for a zone the snapshot has and the page no longer does", () => {
    const [a, c] = [block("a"), block("c")];
    const sending = inFlight(mounted(mount("main", [a]), mount("aside", [c])));
    const current = mounted(mount("main", [a]), mount("sidebar", []));

    const saved = visualEditorReducer(current, sending);

    expect(Object.keys(saved.zones)).toStrictEqual(["main", "sidebar"]);
    expect(saved.zones.sidebar.blocks).toStrictEqual([]);
    expect(saved.zones.sidebar.initial).toStrictEqual([]);
    expect(isVisualEditorDirty(saved)).toBe(false);
  });

  it("keeps a page dirty when a discard lands before the save it raced", () => {
    const [a, b] = [block("a"), block("b")];
    const sent = visualEditorReducer(mounted(mount("main", [a])), {
      index: 1,
      instance: b,
      type: "insert",
      zoneId: "main",
    });
    const sending = inFlight(sent);
    const discarded = visualEditorReducer(sent, { type: "discard" });

    const saved = visualEditorReducer(discarded, sending);

    expect(ids(saved, "main")).toStrictEqual([a.id]);
    expect(saved.zones.main.initial).toStrictEqual([a, b]);
    expect(isVisualEditorDirty(saved)).toBe(true);
  });
});

describe("persisted content the editor cannot read", () => {
  const malformed = { foo: "bar" };

  const withMalformed = (
    id: string,
    blocks: readonly AnyBlockInstance[],
  ): EditorZoneMount => ({
    ...mount(id, blocks),
    invalid: [{ index: 1, value: malformed }],
  });

  it("carries the malformed entry into the zone instead of forgetting it", () => {
    const [a, b] = [block("a"), block("b")];
    const state = mounted(withMalformed("main", [a, b]));

    expect(state.zones.main.blocks).toStrictEqual([a, b]);
    expect(state.zones.main.invalid).toStrictEqual([
      { index: 1, value: malformed },
    ]);
    expect(isVisualEditorDirty(state)).toBe(false);
  });

  it("names the zone as unsafe to save while the entry is still there", () => {
    const state = mounted(
      withMalformed("main", [block("a"), block("b")]),
      mount("aside", [block("c")]),
    );

    expect(unsafeZoneIds(state)).toStrictEqual(["main"]);
  });

  it("still reports nothing unsafe on a page whose zones all parsed", () => {
    expect(unsafeZoneIds(mounted(mount("main", [block("a")])))).toStrictEqual(
      [],
    );
  });

  it("stays unsafe while a sibling block is edited, so the save cannot drop it", () => {
    const [a, b] = [block("a"), block("b")];
    const edited = visualEditorReducer(mounted(withMalformed("main", [a, b])), {
      data: { body: "a2" },
      ref: ref("main", a.id),
      type: "update",
    });

    expect(isVisualEditorDirty(edited)).toBe(true);
    expect(unsafeZoneIds(edited)).toStrictEqual(["main"]);
    expect(edited.zones.main.invalid).toStrictEqual([
      { index: 1, value: malformed },
    ]);
  });

  it("clears the block once it is removed on purpose, and that alone is an edit", () => {
    const [a, b] = [block("a"), block("b")];
    const removed = visualEditorReducer(
      mounted(withMalformed("main", [a, b])),
      { index: 1, type: "remove-invalid", zoneId: "main" },
    );

    expect(unsafeZoneIds(removed)).toStrictEqual([]);
    expect(isVisualEditorDirty(removed)).toBe(true);
    expect(changedZoneIds(removed)).toStrictEqual(["main"]);
    expect(removed.zones.main.blocks).toStrictEqual([a, b]);
  });

  it("ignores a removal aimed at an index or a zone that holds nothing", () => {
    const state = mounted(withMalformed("main", [block("a"), block("b")]));

    expect(
      visualEditorReducer(state, {
        index: 7,
        type: "remove-invalid",
        zoneId: "main",
      }),
    ).toBe(state);
    expect(
      visualEditorReducer(state, {
        index: 1,
        type: "remove-invalid",
        zoneId: "ghost",
      }),
    ).toBe(state);
  });

  it("puts the entry back on discard, because discard undoes everything", () => {
    const [a, b] = [block("a"), block("b")];
    const state = mounted(withMalformed("main", [a, b]));
    const removed = visualEditorReducer(state, {
      index: 1,
      type: "remove-invalid",
      zoneId: "main",
    });

    const back = visualEditorReducer(removed, { type: "discard" });

    expect(back.zones.main.invalid).toStrictEqual([
      { index: 1, value: malformed },
    ]);
    expect(unsafeZoneIds(back)).toStrictEqual(["main"]);
    expect(isVisualEditorDirty(back)).toBe(false);
  });

  it("goes clean once a save that dropped the entry on purpose lands", () => {
    const [a, b] = [block("a"), block("b")];
    const removed = visualEditorReducer(
      mounted(withMalformed("main", [a, b])),
      { index: 1, type: "remove-invalid", zoneId: "main" },
    );

    const input = buildSaveInput(removed);
    const saved = visualEditorReducer(removed, inFlight(removed));

    expect(input.changedZoneIds).toStrictEqual(["main"]);
    expect(input.zones.main).toStrictEqual([a, b]);
    expect(isVisualEditorDirty(saved)).toBe(false);
    expect(
      visualEditorReducer(saved, { type: "discard" }).zones.main.invalid,
    ).toStrictEqual([]);
  });

  it("is dirty again if the entry comes back before a save in flight lands", () => {
    const [a, b] = [block("a"), block("b")];
    const state = mounted(withMalformed("main", [a, b]));
    const removed = visualEditorReducer(state, {
      index: 1,
      type: "remove-invalid",
      zoneId: "main",
    });
    const sending = inFlight(removed);
    const restored = visualEditorReducer(removed, { type: "discard" });

    const saved = visualEditorReducer(restored, sending);

    expect(isVisualEditorDirty(saved)).toBe(true);
    expect(unsafeZoneIds(saved)).toStrictEqual(["main"]);
  });
});

describe("one block id living in two zones", () => {
  const withId = (id: string, text: string): AnyBlockInstance => ({
    data: { body: text },
    id,
    type: "core:text",
  });

  const twins = (): VisualEditorState =>
    mounted(
      mount("A", [withId("A1", "a1"), withId("X", "in a")]),
      mount("B", [withId("X", "in b"), withId("B1", "b1")]),
    );

  it("gives the block a fresh id when it moves into a zone already holding that id", () => {
    const moved = visualEditorReducer(twins(), {
      blockId: "X",
      fromZoneId: "B",
      toIndex: 2,
      toZoneId: "A",
      type: "move",
    });

    const ids = moved.zones.A.blocks.map(instance => instance.id);

    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(ids.slice(0, 2)).toStrictEqual(["A1", "X"]);
    expect(moved.zones.A.blocks[2].data).toStrictEqual({ body: "in b" });
    expect(moved.zones.B.blocks.map(instance => instance.id)).toStrictEqual([
      "B1",
    ]);
  });

  it("keeps the id when the zone it moves into has no such block", () => {
    const moved = visualEditorReducer(
      mounted(
        mount("A", [withId("A1", "a1"), withId("X", "in a")]),
        mount("B", [withId("X", "in b")]),
        mount("C", []),
      ),
      {
        blockId: "X",
        fromZoneId: "B",
        toIndex: 0,
        toZoneId: "C",
        type: "move",
      },
    );

    expect(moved.zones.C.blocks.map(instance => instance.id)).toStrictEqual([
      "X",
    ]);
  });

  it("follows the re-identified block with the selection that was on it", () => {
    const selected = visualEditorReducer(twins(), {
      ref: ref("B", "X"),
      type: "select",
    });

    const moved = visualEditorReducer(selected, {
      blockId: "X",
      fromZoneId: "B",
      toIndex: 0,
      toZoneId: "A",
      type: "move",
    });

    expect(moved.selected?.zoneId).toBe("A");
    expect(moved.selected?.blockId).not.toBe("X");
    const landed = moved.zones.A.blocks.find(
      instance => instance.id === moved.selected?.blockId,
    );

    expect(landed?.data).toStrictEqual({ body: "in b" });
  });

  it("leaves a selection in the other zone alone when a twin moves", () => {
    const selected = visualEditorReducer(twins(), {
      ref: ref("A", "X"),
      type: "select",
    });

    const moved = visualEditorReducer(selected, {
      blockId: "X",
      fromZoneId: "B",
      toIndex: 0,
      toZoneId: "A",
      type: "move",
    });

    expect(moved.selected).toStrictEqual({ blockId: "X", zoneId: "A" });
  });

  it("selects the copy in the zone the ref names, never the other one", () => {
    const state = twins();

    expect(
      visualEditorReducer(state, { ref: ref("A", "X"), type: "select" })
        .selected,
    ).toStrictEqual({ blockId: "X", zoneId: "A" });
    expect(
      visualEditorReducer(state, { ref: ref("B", "X"), type: "select" })
        .selected,
    ).toStrictEqual({ blockId: "X", zoneId: "B" });
  });

  it("updates only the copy the ref names and leaves the twin's data alone", () => {
    const updated = visualEditorReducer(twins(), {
      data: { body: "edited" },
      ref: ref("B", "X"),
      type: "update",
    });

    expect(findBlock(updated, ref("B", "X"))?.instance.data).toStrictEqual({
      body: "edited",
    });
    expect(findBlock(updated, ref("A", "X"))?.instance.data).toStrictEqual({
      body: "in a",
    });
  });

  it("removes only the copy the ref names and keeps the twin on the page", () => {
    const removed = visualEditorReducer(twins(), {
      ref: ref("B", "X"),
      type: "remove",
    });

    expect(ids(removed, "B")).toStrictEqual(["B1"]);
    expect(ids(removed, "A")).toStrictEqual(["A1", "X"]);
  });

  it("duplicates into the ref's own zone, right after the block it copied", () => {
    const state = visualEditorReducer(twins(), {
      ref: ref("A", "X"),
      type: "duplicate",
    });
    const copy = state.zones.A.blocks[2];

    expect(ids(state, "A")).toStrictEqual(["A1", "X", copy.id]);
    expect(copy.id).not.toBe("X");
    expect(copy.data).toStrictEqual({ body: "in a" });
    expect(ids(state, "B")).toStrictEqual(["X", "B1"]);
    expect(state.selected).toStrictEqual({ blockId: copy.id, zoneId: "A" });
  });

  it("moves the copy the source zone owns and leaves the twin where it was", () => {
    const moved = visualEditorReducer(
      visualEditorReducer(twins(), { type: "mount", zone: mount("C", []) }),
      {
        blockId: "X",
        fromZoneId: "B",
        toIndex: 0,
        toZoneId: "C",
        type: "move",
      },
    );

    expect(ids(moved, "C")).toStrictEqual(["X"]);
    expect(ids(moved, "B")).toStrictEqual(["B1"]);
    expect(ids(moved, "A")).toStrictEqual(["A1", "X"]);
    expect(findBlock(moved, ref("C", "X"))?.instance.data).toStrictEqual({
      body: "in b",
    });
  });

  it("looks a block up per zone, by ref and by zone alike", () => {
    const state = twins();

    expect(findBlock(state, ref("A", "X"))).toStrictEqual({
      index: 1,
      instance: withId("X", "in a"),
    });
    expect(findBlock(state, ref("B", "X"))).toStrictEqual({
      index: 0,
      instance: withId("X", "in b"),
    });
    expect(findBlockInZone(state.zones.A, "X")).toStrictEqual({
      index: 1,
      instance: withId("X", "in a"),
    });
    expect(findBlockInZone(state.zones.B, "X")).toStrictEqual({
      index: 0,
      instance: withId("X", "in b"),
    });
    expect(findBlockInZone(state.zones.A, "B1")).toBeNull();
  });

  it("keeps the selection when the twin in the other zone is removed", () => {
    const selected = visualEditorReducer(twins(), {
      ref: ref("A", "X"),
      type: "select",
    });

    const removed = visualEditorReducer(selected, {
      ref: ref("B", "X"),
      type: "remove",
    });

    expect(removed.selected).toStrictEqual({ blockId: "X", zoneId: "A" });
    expect(ids(removed, "A")).toStrictEqual(["A1", "X"]);
  });
});

describe("a zone that leaves the page", () => {
  const edited = (): VisualEditorState =>
    visualEditorReducer(
      mounted(mount("main", [block("a")]), mount("aside", [block("c")])),
      { index: 1, instance: block("d"), type: "insert", zoneId: "aside" },
    );

  it("takes a clean zone off the page without recording it as dropped", () => {
    const state = mounted(
      mount("main", [block("a")]),
      mount("aside", [block("c")]),
    );

    const next = visualEditorReducer(state, {
      type: "unmount",
      zoneId: "aside",
    });

    expect(next.order).toStrictEqual(["main"]);
    expect(Object.keys(next.zones)).toStrictEqual(["main"]);
    expect(next.droppedZoneIds).toStrictEqual([]);
  });

  it("keeps a zone that left out of the payload a save would send", () => {
    const state = edited();

    expect(buildSaveInput(state).changedZoneIds).toStrictEqual(["aside"]);

    const input = buildSaveInput(
      visualEditorReducer(state, { type: "unmount", zoneId: "aside" }),
    );

    expect(input.changedZoneIds).toStrictEqual([]);
    expect(Object.keys(input.zones)).toStrictEqual(["main"]);
  });

  it("clears a selection the leaving zone owned, and only that one", () => {
    const instance = block("a");
    const state = visualEditorReducer(
      mounted(mount("main", [instance]), mount("aside", [block("c")])),
      { ref: ref("main", instance.id), type: "select" },
    );

    expect(
      visualEditorReducer(state, { type: "unmount", zoneId: "main" }).selected,
    ).toBeNull();
    expect(
      visualEditorReducer(state, { type: "unmount", zoneId: "aside" }).selected,
    ).toStrictEqual({ blockId: instance.id, zoneId: "main" });
  });

  it("records a zone that leaves with unsaved edits, and still removes it", () => {
    const dropped = visualEditorReducer(edited(), {
      type: "unmount",
      zoneId: "aside",
    });

    expect(dropped.droppedZoneIds).toStrictEqual(["aside"]);
    expect(dropped.order).toStrictEqual(["main"]);
    expect(Object.keys(dropped.zones)).toStrictEqual(["main"]);
    expect(isVisualEditorDirty(dropped)).toBe(false);
  });

  it("forgets what it recorded once the page is discarded", () => {
    const dropped = visualEditorReducer(edited(), {
      type: "unmount",
      zoneId: "aside",
    });

    expect(
      visualEditorReducer(dropped, { type: "discard" }).droppedZoneIds,
    ).toStrictEqual([]);
  });

  it("forgets what it recorded once a save lands", () => {
    const dropped = visualEditorReducer(edited(), {
      type: "unmount",
      zoneId: "aside",
    });

    expect(
      visualEditorReducer(dropped, inFlight(dropped)).droppedZoneIds,
    ).toStrictEqual([]);
  });

  it("dismisses what it recorded, and changes nothing when there is none", () => {
    const dropped = visualEditorReducer(edited(), {
      type: "unmount",
      zoneId: "aside",
    });
    const dismissed = visualEditorReducer(dropped, {
      type: "dismiss-dropped",
    });

    expect(dismissed.droppedZoneIds).toStrictEqual([]);
    expect(dismissed.order).toStrictEqual(["main"]);
    expect(visualEditorReducer(dismissed, { type: "dismiss-dropped" })).toBe(
      dismissed,
    );
  });

  it("rebaselines a zone that comes back from the blocks it mounts with", () => {
    const [c, d] = [block("c"), block("d")];
    const state = visualEditorReducer(
      mounted(mount("main", [block("a")]), mount("aside", [c])),
      { index: 1, instance: d, type: "insert", zoneId: "aside" },
    );
    const dropped = visualEditorReducer(state, {
      type: "unmount",
      zoneId: "aside",
    });

    const back = visualEditorReducer(dropped, {
      type: "mount",
      zone: mount("aside", [c, d]),
    });

    expect(back.droppedZoneIds).toStrictEqual([]);
    expect(back.order).toStrictEqual(["main", "aside"]);
    expect(ids(back, "aside")).toStrictEqual([c.id, d.id]);
    expect(back.zones.aside.initial).toStrictEqual([c, d]);
    expect(isVisualEditorDirty(back)).toBe(false);
  });

  it("ignores an unmount aimed at a zone that never mounted", () => {
    const state = mounted(mount("main", [block("a")]));

    expect(
      visualEditorReducer(state, { type: "unmount", zoneId: "ghost" }),
    ).toBe(state);
  });
});
