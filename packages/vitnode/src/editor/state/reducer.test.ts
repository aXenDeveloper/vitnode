import { describe, expect, it } from "vitest";

import type { AnyBlockInstance } from "../../blocks/types";
import type { EditorZoneMount, VisualEditorState } from "./types";

import { createBlockInstance } from "../../blocks/instance";
import { buildInvalidSnapshot, buildSaveInput } from "../adapter/save-input";
import {
  changedZoneIds,
  findBlock,
  initialVisualEditorState,
  isVisualEditorDirty,
  unsafeZoneIds,
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
      blockId: a.id,
      data: { body: "a2" },
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
