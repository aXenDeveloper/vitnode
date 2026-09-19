import { describe, expect, it } from "vitest";

import type {
  AnyBlockInstance,
  BlockAreaInstance,
  BlockAreaLayout,
} from "../../blocks/types";
import type {
  EditorContainerRef,
  EditorNodeRef,
  EditorZoneMount,
  VisualEditorSnapshot,
  VisualEditorState,
} from "./types";

import { createAreaInstance, isBlockAreaInstance } from "../../blocks/area";
import { AREA_CHILDREN_DEFAULT_MAX } from "../../blocks/const";
import { createBlockInstance } from "../../blocks/instance";
import {
  createBlockRegistry,
  setDefaultBlockRegistry,
} from "../../blocks/registry";
import { field } from "../../content/fields";
import { buildInvalidSnapshot, buildSaveInput } from "../adapter/save-input";
import {
  changedZoneIds,
  containerAcceptsBlock,
  containerNodes,
  findArea,
  findBlock,
  findNode,
  initialVisualEditorState,
  isVisualEditorDirty,
  unsafeZoneIds,
  visualEditorReducer,
} from "./reducer";

const block = (text: string): AnyBlockInstance =>
  createBlockInstance("core:text", { body: text });

const area = (
  children: readonly AnyBlockInstance[] = [],
  layout?: Partial<BlockAreaLayout>,
): BlockAreaInstance => createAreaInstance({ children, layout });

const ref = (
  zoneId: string,
  nodeId: string,
  areaId: null | string = null,
): EditorNodeRef => ({ areaId, kind: "block", nodeId, zoneId });

const areaRef = (zoneId: string, nodeId: string): EditorNodeRef => ({
  areaId: null,
  kind: "area",
  nodeId,
  zoneId,
});

const into = (
  zoneId: string,
  areaId: null | string = null,
): EditorContainerRef => ({ areaId, zoneId });

const mount = (
  id: string,
  nodes: readonly (AnyBlockInstance | BlockAreaInstance)[],
  allowedBlocks?: EditorZoneMount["allowedBlocks"],
  bounds: { max?: number; min?: number } = {},
): EditorZoneMount => ({
  allowedBlocks,
  id,
  invalid: [],
  max: bounds.max,
  min: bounds.min,
  nodes,
  registry: undefined,
});

const mounted = (...zones: readonly EditorZoneMount[]): VisualEditorState =>
  zones.reduce(
    (state, zone) => visualEditorReducer(state, { type: "mount", zone }),
    initialVisualEditorState,
  );

const ids = (state: VisualEditorState, zoneId: string): string[] =>
  state.zones[zoneId].nodes.map(node => node.id);

const childIds = (
  state: VisualEditorState,
  zoneId: string,
  areaId: string,
): string[] =>
  (containerNodes(state, into(zoneId, areaId)) ?? []).map(node => node.id);

const inFlight = (state: VisualEditorState, canonical?: VisualEditorSnapshot) =>
  ({
    canonical,
    invalid: buildInvalidSnapshot(state),
    snapshot: buildSaveInput(state).zones,
    type: "saved",
  }) as const;

describe("visualEditorReducer", () => {
  it("captures the incoming nodes as the baseline on the first mount", () => {
    const first = block("a");
    const state = mounted(mount("main", [first]));

    expect(state.order).toStrictEqual(["main"]);
    expect(state.zones.main.nodes).toStrictEqual([first]);
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
      container: into("main"),
      index: 1,
      instance: block("b"),
      type: "insert",
    });

    expect(loaded).toHaveLength(1);
    expect(next.zones.main.nodes).toHaveLength(2);
    expect(next.zones.main.initial).toHaveLength(1);
  });

  it("keeps edits when the same zone mounts again", () => {
    const first = block("a");
    const added = block("b");
    const state = visualEditorReducer(mounted(mount("main", [first])), {
      container: into("main"),
      index: 1,
      instance: added,
      type: "insert",
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
    const only = block("a");
    const state = mounted(mount("main", [only], ["core:text"]));
    const same = visualEditorReducer(state, {
      type: "mount",
      zone: mount("main", [only], ["core:text"]),
    });

    expect(same).toBe(state);

    const widened = visualEditorReducer(state, {
      type: "mount",
      zone: mount("main", [only], "*"),
    });

    expect(widened.zones.main.allowedBlocks).toBe("*");
    expect(widened.zones.main.nodes).toStrictEqual(state.zones.main.nodes);
  });

  it("widens the allowlist without adopting content the editor is still editing", () => {
    const only = block("a");
    const edited = visualEditorReducer(mounted(mount("main", [only])), {
      data: { body: "edited" },
      ref: ref("main", only.id),
      type: "update",
    });

    const widened = visualEditorReducer(edited, {
      type: "mount",
      zone: mount("main", [block("elsewhere")], "*"),
    });

    expect(widened.zones.main.allowedBlocks).toBe("*");
    expect(widened.zones.main.nodes).toStrictEqual(edited.zones.main.nodes);
    expect(widened.zones.main.initial).toBe(edited.zones.main.initial);
  });

  it("clamps the insert index into the zone", () => {
    const first = block("a");
    const late = block("b");
    const early = block("c");
    const state = visualEditorReducer(mounted(mount("main", [first])), {
      container: into("main"),
      index: 99,
      instance: late,
      type: "insert",
    });
    const next = visualEditorReducer(state, {
      container: into("main"),
      index: -4,
      instance: early,
      type: "insert",
    });

    expect(ids(next, "main")).toStrictEqual([early.id, first.id, late.id]);
  });

  it("ignores an insert into a zone or an area that never mounted", () => {
    const state = mounted(mount("main", []));

    expect(
      visualEditorReducer(state, {
        container: into("aside"),
        index: 0,
        instance: block("a"),
        type: "insert",
      }),
    ).toBe(state);
    expect(
      visualEditorReducer(state, {
        container: into("main", "GHOST"),
        index: 0,
        instance: block("a"),
        type: "insert",
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

    expect(other.selected).toStrictEqual(ref("main", second.id));
  });

  it("duplicates a block with a fresh id, deeply copied, and selects the copy", () => {
    const original = createBlockInstance(
      "core:hero",
      { seo: { title: "a" }, title: "Hello" },
      "wide",
    );
    const state = visualEditorReducer(mounted(mount("main", [original])), {
      ref: ref("main", original.id),
      type: "duplicate",
    });

    const [, copy] = state.zones.main.nodes;

    expect(state.zones.main.nodes).toHaveLength(2);
    expect(copy.id).not.toBe(original.id);
    expect(isBlockAreaInstance(copy)).toBe(false);
    expect(findBlock(state, ref("main", copy.id))?.instance.type).toBe(
      original.type,
    );
    expect(findBlock(state, ref("main", copy.id))?.instance.variant).toBe(
      "wide",
    );
    expect(findBlock(state, ref("main", copy.id))?.instance.data).toStrictEqual(
      original.data,
    );
    expect(findBlock(state, ref("main", copy.id))?.instance.data.seo).not.toBe(
      original.data.seo,
    );
    expect(state.selected).toStrictEqual(ref("main", copy.id));
  });

  it("reorders inside one zone against the list without the moved block", () => {
    const [a, b, c] = [block("a"), block("b"), block("c")];
    const state = mounted(mount("main", [a, b, c]));

    const reorder = (nodeId: string, toIndex: number): string[] =>
      ids(
        visualEditorReducer(state, {
          from: into("main"),
          nodeId,
          to: into("main"),
          toIndex,
          type: "move",
        }),
        "main",
      );

    expect(reorder(a.id, 2)).toStrictEqual([b.id, c.id, a.id]);
    expect(reorder(c.id, 0)).toStrictEqual([c.id, a.id, b.id]);
    expect(reorder(b.id, 1)).toStrictEqual([a.id, b.id, c.id]);
  });

  it("moves a block across zones and follows it with the selection", () => {
    const [a, b, c] = [block("a"), block("b"), block("c")];
    const state = visualEditorReducer(
      mounted(mount("main", [a, b]), mount("aside", [c])),
      { ref: ref("main", a.id), type: "select" },
    );

    const moved = visualEditorReducer(state, {
      from: into("main"),
      nodeId: a.id,
      to: into("aside"),
      toIndex: 0,
      type: "move",
    });

    expect(ids(moved, "main")).toStrictEqual([b.id]);
    expect(ids(moved, "aside")).toStrictEqual([a.id, c.id]);
    expect(moved.selected).toStrictEqual(ref("aside", a.id));
    expect(findBlock(moved, ref("aside", a.id))).toStrictEqual({
      index: 0,
      instance: a,
    });
  });

  it("merges an update into the data the block already holds", () => {
    const instance = createBlockInstance("core:text", {
      body: "a",
      heading: "h",
    });
    const state = visualEditorReducer(mounted(mount("main", [instance])), {
      data: { body: "b" },
      ref: ref("main", instance.id),
      type: "update",
    });

    expect(
      findBlock(state, ref("main", instance.id))?.instance.data,
    ).toStrictEqual({ body: "b", heading: "h" });
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

    expect(state.selected).toStrictEqual(ref("main", instance.id));

    const cleared = visualEditorReducer(state, { ref: null, type: "select" });

    expect(cleared.selected).toBeNull();
  });

  it("restores every zone on discard and clears the selection", () => {
    const [a, b, c] = [block("a"), block("b"), block("c")];
    const state = mounted(mount("main", [a, b]), mount("aside", [c]));
    const edited = visualEditorReducer(
      visualEditorReducer(state, { ref: ref("main", b.id), type: "remove" }),
      {
        container: into("aside"),
        index: 0,
        instance: block("d"),
        type: "insert",
      },
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
      container: into("main"),
      index: 1,
      instance: b,
      type: "insert",
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
      from: into("main"),
      nodeId: a.id,
      to: into("main"),
      toIndex: 1,
      type: "move",
    });

    expect(isVisualEditorDirty(moved)).toBe(true);

    const back = visualEditorReducer(moved, {
      from: into("main"),
      nodeId: a.id,
      to: into("main"),
      toIndex: 0,
      type: "move",
    });

    expect(isVisualEditorDirty(back)).toBe(false);
  });

  it("finds nothing for an unknown block", () => {
    const state = mounted(mount("main", [block("a")]));

    expect(findNode(state, ref("main", "MISSING"))).toBeNull();
    expect(
      visualEditorReducer(state, {
        ref: ref("main", "MISSING"),
        type: "select",
      }),
    ).toBe(state);
  });
});

describe("a node's identity, which is its container and not its raw id", () => {
  const child = block("inside");
  const loose = block("outside");
  const holder = area([child]);

  const page = (): VisualEditorState => mounted(mount("main", [loose, holder]));

  it("never falls back to a global lookup when the container is wrong", () => {
    const state = page();

    expect(findNode(state, ref("main", child.id))).toBeNull();
    expect(findNode(state, ref("main", loose.id, holder.id))).toBeNull();
    expect(findNode(state, ref("main", child.id, holder.id))).not.toBeNull();
  });

  it("refuses a ref whose kind does not match the node it names", () => {
    const state = page();

    expect(findNode(state, ref("main", holder.id))).toBeNull();
    expect(findNode(state, areaRef("main", loose.id))).toBeNull();
    expect(findArea(state, areaRef("main", holder.id))?.index).toBe(1);
    expect(findBlock(state, areaRef("main", holder.id))).toBeNull();
  });

  it("reads a container's nodes, and nothing for one that is not there", () => {
    const state = page();

    expect(containerNodes(state, into("main"))).toHaveLength(2);
    expect(containerNodes(state, into("main", holder.id))).toStrictEqual([
      child,
    ]);
    expect(containerNodes(state, into("main", loose.id))).toBeNull();
    expect(containerNodes(state, into("ghost"))).toBeNull();
  });

  it("selects an area and a block inside it independently", () => {
    const onArea = visualEditorReducer(page(), {
      ref: areaRef("main", holder.id),
      type: "select",
    });

    expect(onArea.selected).toStrictEqual(areaRef("main", holder.id));

    const onChild = visualEditorReducer(onArea, {
      ref: ref("main", child.id, holder.id),
      type: "select",
    });

    expect(onChild.selected).toStrictEqual(ref("main", child.id, holder.id));
  });
});

describe("areas on the canvas", () => {
  it("inserts an area at a zone root and leaves the blocks around it", () => {
    const [a, b] = [block("a"), block("b")];
    const holder = area();
    const state = visualEditorReducer(mounted(mount("main", [a, b])), {
      area: holder,
      index: 1,
      type: "insert-area",
      zoneId: "main",
    });

    expect(ids(state, "main")).toStrictEqual([a.id, holder.id, b.id]);
    expect(childIds(state, "main", holder.id)).toStrictEqual([]);
    expect(isVisualEditorDirty(state)).toBe(true);
  });

  it("ignores an area aimed at a zone that never mounted", () => {
    const state = mounted(mount("main", []));

    expect(
      visualEditorReducer(state, {
        area: area(),
        index: 0,
        type: "insert-area",
        zoneId: "aside",
      }),
    ).toBe(state);
  });

  it("inserts a block into an area", () => {
    const child = block("inside");
    const holder = area([child]);
    const added = block("added");
    const state = visualEditorReducer(mounted(mount("main", [holder])), {
      container: into("main", holder.id),
      index: 0,
      instance: added,
      type: "insert",
    });

    expect(childIds(state, "main", holder.id)).toStrictEqual([
      added.id,
      child.id,
    ]);
    expect(ids(state, "main")).toStrictEqual([holder.id]);
  });

  it("reorders an area among the blocks at the zone root", () => {
    const [a, b] = [block("a"), block("b")];
    const holder = area([block("inside")]);
    const state = mounted(mount("main", [a, b, holder]));

    const moved = visualEditorReducer(state, {
      from: into("main"),
      nodeId: holder.id,
      to: into("main"),
      toIndex: 0,
      type: "move",
    });

    expect(ids(moved, "main")).toStrictEqual([holder.id, a.id, b.id]);
    expect(childIds(moved, "main", holder.id)).toHaveLength(1);
  });

  it("moves a root block into an area", () => {
    const [a, b] = [block("a"), block("b")];
    const holder = area([block("inside")]);
    const state = mounted(mount("main", [a, b, holder]));

    const moved = visualEditorReducer(state, {
      from: into("main"),
      nodeId: a.id,
      to: into("main", holder.id),
      toIndex: 0,
      type: "move",
    });

    expect(ids(moved, "main")).toStrictEqual([b.id, holder.id]);
    expect(childIds(moved, "main", holder.id)[0]).toBe(a.id);
    expect(childIds(moved, "main", holder.id)).toHaveLength(2);
  });

  it("moves an area's child back out to the zone root", () => {
    const child = block("inside");
    const holder = area([child]);
    const root = block("a");
    const state = mounted(mount("main", [root, holder]));

    const moved = visualEditorReducer(state, {
      from: into("main", holder.id),
      nodeId: child.id,
      to: into("main"),
      toIndex: 0,
      type: "move",
    });

    expect(ids(moved, "main")).toStrictEqual([child.id, root.id, holder.id]);
    expect(childIds(moved, "main", holder.id)).toStrictEqual([]);
  });

  it("moves an area's child straight into another area", () => {
    const child = block("inside");
    const left = area([child]);
    const right = area([block("other")]);
    const state = mounted(mount("main", [left, right]));

    const moved = visualEditorReducer(state, {
      from: into("main", left.id),
      nodeId: child.id,
      to: into("main", right.id),
      toIndex: 0,
      type: "move",
    });

    expect(childIds(moved, "main", left.id)).toStrictEqual([]);
    expect(childIds(moved, "main", right.id)[0]).toBe(child.id);
    expect(ids(moved, "main")).toStrictEqual([left.id, right.id]);
  });

  it("reorders inside an area against the list without the moved block", () => {
    const [a, b, c] = [block("a"), block("b"), block("c")];
    const holder = area([a, b, c]);
    const state = mounted(mount("main", [holder]));

    const moved = visualEditorReducer(state, {
      from: into("main", holder.id),
      nodeId: a.id,
      to: into("main", holder.id),
      toIndex: 2,
      type: "move",
    });

    expect(childIds(moved, "main", holder.id)).toStrictEqual([
      b.id,
      c.id,
      a.id,
    ]);
  });

  it("refuses an area dropped inside another area", () => {
    const left = area([block("a")]);
    const right = area();
    const state = mounted(mount("main", [left, right]));

    expect(
      visualEditorReducer(state, {
        from: into("main"),
        nodeId: left.id,
        to: into("main", right.id),
        toIndex: 0,
        type: "move",
      }),
    ).toBe(state);
  });

  it("refuses a move into an area that is not there", () => {
    const a = block("a");
    const state = mounted(mount("main", [a]));

    expect(
      visualEditorReducer(state, {
        from: into("main"),
        nodeId: a.id,
        to: into("main", "GHOST"),
        toIndex: 0,
        type: "move",
      }),
    ).toBe(state);
  });

  it("deletes an area together with every block inside it", () => {
    const child = block("inside");
    const holder = area([child]);
    const root = block("a");
    const state = visualEditorReducer(mounted(mount("main", [root, holder])), {
      ref: ref("main", child.id, holder.id),
      type: "select",
    });

    const removed = visualEditorReducer(state, {
      ref: areaRef("main", holder.id),
      type: "remove",
    });

    expect(ids(removed, "main")).toStrictEqual([root.id]);
    expect(removed.selected).toBeNull();
  });

  it("unwraps an area back into the zone root, in order and in place", () => {
    const [a, b] = [block("a"), block("b")];
    const [first, second] = [block("first"), block("second")];
    const holder = area([first, second]);
    const state = mounted(mount("main", [a, holder, b]));

    const unwrapped = visualEditorReducer(state, {
      ref: areaRef("main", holder.id),
      type: "unwrap-area",
    });

    expect(ids(unwrapped, "main")).toStrictEqual([
      a.id,
      first.id,
      second.id,
      b.id,
    ]);
  });

  it("keeps a selected child on the page when its area is unwrapped", () => {
    const child = block("inside");
    const holder = area([child]);
    const state = visualEditorReducer(mounted(mount("main", [holder])), {
      ref: ref("main", child.id, holder.id),
      type: "select",
    });

    const unwrapped = visualEditorReducer(state, {
      ref: areaRef("main", holder.id),
      type: "unwrap-area",
    });

    expect(unwrapped.selected).toStrictEqual(ref("main", child.id));
    expect(
      visualEditorReducer(
        visualEditorReducer(mounted(mount("main", [holder])), {
          ref: areaRef("main", holder.id),
          type: "select",
        }),
        { ref: areaRef("main", holder.id), type: "unwrap-area" },
      ).selected,
    ).toBeNull();
  });

  it("ignores an unwrap aimed at a block", () => {
    const a = block("a");
    const state = mounted(mount("main", [a]));

    expect(
      visualEditorReducer(state, {
        ref: areaRef("main", a.id),
        type: "unwrap-area",
      }),
    ).toBe(state);
  });

  it("duplicates an area with a fresh id for it and for every child", () => {
    const child = createBlockInstance(
      "core:hero",
      { seo: { title: "a" } },
      "wide",
    );
    const holder = area([child], { columns: 3 });
    const state = visualEditorReducer(mounted(mount("main", [holder])), {
      ref: areaRef("main", holder.id),
      type: "duplicate",
    });

    const copy = state.zones.main.nodes[1];

    expect(ids(state, "main")[0]).toBe(holder.id);
    expect(copy.id).not.toBe(holder.id);
    expect(findArea(state, areaRef("main", copy.id))?.area.layout.columns).toBe(
      3,
    );

    const copied = childIds(state, "main", copy.id);

    expect(copied).toHaveLength(1);
    expect(copied[0]).not.toBe(child.id);

    const copiedChild = findBlock(
      state,
      ref("main", copied[0], copy.id),
    )?.instance;

    expect(copiedChild?.variant).toBe("wide");
    expect(copiedChild?.data).toStrictEqual(child.data);
    expect(copiedChild?.data.seo).not.toBe(child.data.seo);
    expect(state.selected).toStrictEqual(areaRef("main", copy.id));

    const everyId = [
      ...ids(state, "main"),
      ...childIds(state, "main", holder.id),
      ...copied,
    ];

    expect(new Set(everyId).size).toBe(everyId.length);
  });

  it("replaces an area's layout and ignores one that changes nothing", () => {
    const holder = area([], { columns: 2 });
    const state = mounted(mount("main", [holder]));

    const widened = visualEditorReducer(state, {
      layout: { columns: 4, gap: "lg" },
      ref: areaRef("main", holder.id),
      type: "update-area-layout",
    });

    expect(
      findArea(widened, areaRef("main", holder.id))?.area.layout,
    ).toStrictEqual({ columns: 4, gap: "lg" });
    expect(isVisualEditorDirty(widened)).toBe(true);

    expect(
      visualEditorReducer(widened, {
        layout: { columns: 4, gap: "lg" },
        ref: areaRef("main", holder.id),
        type: "update-area-layout",
      }),
    ).toBe(widened);
  });

  it("edits and removes a block by the area it sits in", () => {
    const child = block("inside");
    const holder = area([child]);
    const state = visualEditorReducer(mounted(mount("main", [holder])), {
      data: { body: "edited" },
      ref: ref("main", child.id, holder.id),
      type: "update",
    });

    expect(
      findBlock(state, ref("main", child.id, holder.id))?.instance.data,
    ).toStrictEqual({ body: "edited" });
    expect(isVisualEditorDirty(state)).toBe(true);

    const removed = visualEditorReducer(state, {
      ref: ref("main", child.id, holder.id),
      type: "remove",
    });

    expect(childIds(removed, "main", holder.id)).toStrictEqual([]);
    expect(ids(removed, "main")).toStrictEqual([holder.id]);
  });

  it("duplicates a block inside the area it already sits in", () => {
    const child = block("inside");
    const holder = area([child]);
    const state = visualEditorReducer(mounted(mount("main", [holder])), {
      ref: ref("main", child.id, holder.id),
      type: "duplicate",
    });

    const inside = childIds(state, "main", holder.id);

    expect(inside).toHaveLength(2);
    expect(inside[0]).toBe(child.id);
    expect(state.selected).toStrictEqual(ref("main", inside[1], holder.id));
    expect(ids(state, "main")).toStrictEqual([holder.id]);
  });
});

describe("a block's variant", () => {
  it("sets a variant in place, keeping the id and the data it had", () => {
    const instance = createBlockInstance("core:hero", { title: "a" });
    const state = visualEditorReducer(mounted(mount("main", [instance])), {
      ref: ref("main", instance.id),
      type: "set-variant",
      variant: "wide",
    });

    const found = findBlock(state, ref("main", instance.id))?.instance;

    expect(found?.id).toBe(instance.id);
    expect(found?.variant).toBe("wide");
    expect(found?.data).toBe(instance.data);
    expect(isVisualEditorDirty(state)).toBe(true);
  });

  it("removes the key when the variant goes back to none", () => {
    const instance = createBlockInstance("core:hero", { title: "a" }, "wide");
    const state = visualEditorReducer(mounted(mount("main", [instance])), {
      ref: ref("main", instance.id),
      type: "set-variant",
      variant: undefined,
    });

    const found = findBlock(state, ref("main", instance.id))?.instance;

    expect(found).toBeDefined();
    expect(found && "variant" in found).toBe(false);
    expect(isVisualEditorDirty(state)).toBe(true);
  });

  it("changes nothing when the variant is the one already stored", () => {
    const instance = createBlockInstance("core:hero", { title: "a" }, "wide");
    const state = mounted(mount("main", [instance]));

    expect(
      visualEditorReducer(state, {
        ref: ref("main", instance.id),
        type: "set-variant",
        variant: "wide",
      }),
    ).toBe(state);
  });

  it("sets the variant of a block inside an area, and never of the area", () => {
    const child = createBlockInstance("core:hero", { title: "a" });
    const holder = area([child]);
    const state = visualEditorReducer(mounted(mount("main", [holder])), {
      ref: ref("main", child.id, holder.id),
      type: "set-variant",
      variant: "wide",
    });

    expect(
      findBlock(state, ref("main", child.id, holder.id))?.instance.variant,
    ).toBe("wide");
    expect(
      visualEditorReducer(state, {
        ref: areaRef("main", holder.id),
        type: "set-variant",
        variant: "wide",
      }),
    ).toBe(state);
  });

  it("counts a variant change as a change the save has to send", () => {
    const instance = createBlockInstance("core:hero", { title: "a" });
    const state = visualEditorReducer(mounted(mount("main", [instance])), {
      ref: ref("main", instance.id),
      type: "set-variant",
      variant: "wide",
    });

    expect(changedZoneIds(state)).toStrictEqual(["main"]);

    const saved = visualEditorReducer(state, inFlight(state));

    expect(isVisualEditorDirty(saved)).toBe(false);
  });
});

describe("the selection, as the page under it changes", () => {
  it("follows a block that moves into an area and out again", () => {
    const a = block("a");
    const holder = area();
    const state = visualEditorReducer(mounted(mount("main", [a, holder])), {
      ref: ref("main", a.id),
      type: "select",
    });

    const inside = visualEditorReducer(state, {
      from: into("main"),
      nodeId: a.id,
      to: into("main", holder.id),
      toIndex: 0,
      type: "move",
    });

    expect(inside.selected).toStrictEqual(ref("main", a.id, holder.id));

    const back = visualEditorReducer(inside, {
      from: into("main", holder.id),
      nodeId: a.id,
      to: into("main"),
      toIndex: 0,
      type: "move",
    });

    expect(back.selected).toStrictEqual(ref("main", a.id));
  });

  it("follows an area, and the block selected inside it, across zones", () => {
    const child = block("inside");
    const holder = area([child]);
    const state = visualEditorReducer(
      mounted(mount("main", [holder]), mount("aside", [])),
      { ref: ref("main", child.id, holder.id), type: "select" },
    );

    const moved = visualEditorReducer(state, {
      from: into("main"),
      nodeId: holder.id,
      to: into("aside"),
      toIndex: 0,
      type: "move",
    });

    expect(moved.selected).toStrictEqual(ref("aside", child.id, holder.id));
    expect(findNode(moved, ref("aside", child.id, holder.id))).not.toBeNull();
  });

  it("clears when the node it names stops existing", () => {
    const child = block("inside");
    const holder = area([child]);
    const state = visualEditorReducer(mounted(mount("main", [holder])), {
      ref: ref("main", child.id, holder.id),
      type: "select",
    });

    expect(
      visualEditorReducer(state, {
        ref: ref("main", child.id, holder.id),
        type: "remove",
      }).selected,
    ).toBeNull();
  });

  it("clears when the page remounts a zone without the area it was in", () => {
    const child = block("inside");
    const holder = area([child]);
    const state = visualEditorReducer(mounted(mount("main", [holder])), {
      ref: ref("main", child.id, holder.id),
      type: "select",
    });

    expect(
      visualEditorReducer(state, {
        type: "mount",
        zone: mount("main", [block("other")]),
      }).selected,
    ).toBeNull();
    expect(
      visualEditorReducer(state, {
        type: "mount",
        zone: mount("main", [holder]),
      }).selected,
    ).toStrictEqual(ref("main", child.id, holder.id));
  });
});

describe("the baseline a saved snapshot writes", () => {
  it("no edit during save: goes clean against the snapshot it sent", () => {
    const [a, b] = [block("a"), block("b")];
    const edited = visualEditorReducer(mounted(mount("main", [a])), {
      container: into("main"),
      index: 1,
      instance: b,
      type: "insert",
    });
    const saved = visualEditorReducer(edited, inFlight(edited));

    expect(saved.zones.main.initial).toBe(edited.zones.main.nodes);
    expect(ids(saved, "main")).toStrictEqual([a.id, b.id]);
    expect(isVisualEditorDirty(saved)).toBe(false);
    expect(changedZoneIds(saved)).toStrictEqual([]);
  });

  it("edit during save: stays dirty, because the server never saw the late block", () => {
    const [a, b, late] = [block("a"), block("b"), block("c")];
    const sent = visualEditorReducer(mounted(mount("main", [a])), {
      container: into("main"),
      index: 1,
      instance: b,
      type: "insert",
    });
    const sending = inFlight(sent);
    const current = visualEditorReducer(sent, {
      container: into("main"),
      index: 2,
      instance: late,
      type: "insert",
    });

    const saved = visualEditorReducer(current, sending);

    expect(saved.zones.main.initial).toStrictEqual([a, b]);
    expect(ids(saved, "main")).toStrictEqual([a.id, b.id, late.id]);
    expect(isVisualEditorDirty(saved)).toBe(true);
    expect(changedZoneIds(saved)).toStrictEqual(["main"]);

    const settled = visualEditorReducer(saved, inFlight(saved));

    expect(isVisualEditorDirty(settled)).toBe(false);
  });

  it("edit during save, inside an area: the later change stays dirty", () => {
    const child = block("inside");
    const holder = area([child]);
    const sent = mounted(mount("main", [holder]));
    const sending = inFlight(sent);
    const current = visualEditorReducer(sent, {
      container: into("main", holder.id),
      index: 1,
      instance: block("late"),
      type: "insert",
    });

    const saved = visualEditorReducer(current, sending);

    expect(saved.zones.main.initial).toStrictEqual([holder]);
    expect(childIds(saved, "main", holder.id)).toHaveLength(2);
    expect(isVisualEditorDirty(saved)).toBe(true);
    expect(changedZoneIds(saved)).toStrictEqual(["main"]);
  });

  it("names only the zones that still differ after a partial save", () => {
    const [a, b, c, d] = [block("a"), block("b"), block("c"), block("d")];
    const sent = visualEditorReducer(
      mounted(mount("main", [a]), mount("aside", [c])),
      { container: into("main"), index: 1, instance: b, type: "insert" },
    );
    const sending = inFlight(sent);
    const current = visualEditorReducer(sent, {
      container: into("aside"),
      index: 1,
      instance: d,
      type: "insert",
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
      { container: into("aside"), index: 1, instance: d, type: "insert" },
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
    expect(saved.zones.sidebar.nodes).toStrictEqual([]);
    expect(saved.zones.sidebar.initial).toStrictEqual([]);
    expect(isVisualEditorDirty(saved)).toBe(false);
  });

  it("keeps a page dirty when a discard lands before the save it raced", () => {
    const [a, b] = [block("a"), block("b")];
    const sent = visualEditorReducer(mounted(mount("main", [a])), {
      container: into("main"),
      index: 1,
      instance: b,
      type: "insert",
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
    nodes: readonly AnyBlockInstance[],
  ): EditorZoneMount => ({
    ...mount(id, nodes),
    invalid: [{ index: 1, value: malformed }],
  });

  it("carries the malformed entry into the zone instead of forgetting it", () => {
    const [a, b] = [block("a"), block("b")];
    const state = mounted(withMalformed("main", [a, b]));

    expect(state.zones.main.nodes).toStrictEqual([a, b]);
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

  describe("a stored variant the block no longer offers", () => {
    const variantRegistry = createBlockRegistry([
      {
        pluginId: "@vitnode/core",
        blocks: [
          {
            component: () => null,
            defaultVariant: "grid",
            fields: { body: field.text({}) },
            id: "text",
            variants: [{ id: "grid" }, { id: "featured" }],
          },
        ],
        namespace: "core",
      },
    ]);

    const zoneWith = (
      nodes: readonly (AnyBlockInstance | BlockAreaInstance)[],
    ): VisualEditorState =>
      mounted({
        allowedBlocks: undefined,
        id: "main",
        invalid: [],
        max: undefined,
        min: undefined,
        nodes,
        registry: variantRegistry,
      });

    it("blocks the save, because the server would refuse it anyway", () => {
      const stored = { ...block("a"), variant: "gone" };

      expect(unsafeZoneIds(zoneWith([stored]))).toStrictEqual(["main"]);
    });

    it("blocks the save for a child of an area just the same", () => {
      const stored = { ...block("a"), variant: "gone" };

      expect(unsafeZoneIds(zoneWith([area([stored])]))).toStrictEqual(["main"]);
    });

    it("lets a declared variant through", () => {
      const stored = { ...block("a"), variant: "featured" };

      expect(unsafeZoneIds(zoneWith([stored]))).toStrictEqual([]);
    });

    it("lets a legacy block with no variant at all through", () => {
      expect(unsafeZoneIds(zoneWith([block("a")]))).toStrictEqual([]);
    });

    it("clears once the variant is set to one the block declares", () => {
      const stored = { ...block("a"), variant: "gone" };
      const fixed = visualEditorReducer(zoneWith([stored]), {
        ref: ref("main", stored.id),
        type: "set-variant",
        variant: "grid",
      });

      expect(unsafeZoneIds(fixed)).toStrictEqual([]);
    });

    it("clears once the block is told to use its own default instead", () => {
      const stored = { ...block("a"), variant: "gone" };
      const cleared = visualEditorReducer(zoneWith([stored]), {
        ref: ref("main", stored.id),
        type: "set-variant",
        variant: undefined,
      });

      expect(cleared.zones.main.nodes[0]).not.toHaveProperty("variant");
      expect(unsafeZoneIds(cleared)).toStrictEqual([]);
    });

    it("blocks the save for a type the registry does not register either", () => {
      const stored = { ...createBlockInstance("core:gone", {}), variant: "x" };

      expect(unsafeZoneIds(zoneWith([stored]))).toStrictEqual(["main"]);
    });
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
    expect(removed.zones.main.nodes).toStrictEqual([a, b]);
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

describe("stored content the server would refuse", () => {
  const registry = createBlockRegistry([
    {
      pluginId: "@vitnode/core",
      blocks: [
        { component: () => null, fields: { body: field.text({}) }, id: "text" },
        {
          component: () => null,
          fields: { label: field.text({ required: true }) },
          id: "cta",
        },
      ],
      namespace: "core",
    },
  ]);

  const zoneWith = (
    nodes: readonly (AnyBlockInstance | BlockAreaInstance)[],
    allowedBlocks?: EditorZoneMount["allowedBlocks"],
  ): VisualEditorState =>
    mounted({
      allowedBlocks,
      id: "main",
      invalid: [],
      max: undefined,
      min: undefined,
      nodes,
      registry,
    });

  const misshapen = (): AnyBlockInstance => ({
    ...block("a"),
    data: { body: 12 },
  });

  it("blocks the save for data only the field's own constraints refuse", () => {
    const constrained = createBlockRegistry([
      {
        pluginId: "@vitnode/core",
        blocks: [
          {
            component: () => null,
            fields: {
              body: field.text({ minLength: 3 }),
              tone: field.enum({ values: ["info", "warning"] }),
            },
            id: "text",
          },
        ],
        namespace: "core",
      },
    ]);

    const zone = (data: Record<string, unknown>): VisualEditorState =>
      mounted({
        allowedBlocks: undefined,
        id: "main",
        invalid: [],
        max: undefined,
        min: undefined,
        nodes: [{ ...block("a"), data }],
        registry: constrained,
      });

    expect(unsafeZoneIds(zone({ body: "Hi", tone: "info" }))).toStrictEqual([
      "main",
    ]);
    expect(unsafeZoneIds(zone({ body: "Hello", tone: "gone" }))).toStrictEqual([
      "main",
    ]);
    expect(unsafeZoneIds(zone({ body: "Hello", tone: "info" }))).toStrictEqual(
      [],
    );
  });

  it("blocks the save for a type the registry does not register", () => {
    expect(
      unsafeZoneIds(zoneWith([createBlockInstance("core:gone", {})])),
    ).toStrictEqual(["main"]);
  });

  it("blocks the save for a block the zone allowlist no longer permits", () => {
    expect(unsafeZoneIds(zoneWith([block("a")], ["core:cta"]))).toStrictEqual([
      "main",
    ]);
    expect(unsafeZoneIds(zoneWith([block("a")], ["core:text"]))).toStrictEqual(
      [],
    );
  });

  it("blocks the save for data that no longer matches the block fields", () => {
    expect(unsafeZoneIds(zoneWith([misshapen()]))).toStrictEqual(["main"]);
    expect(
      unsafeZoneIds(zoneWith([{ ...block("a"), data: { gone: "a" } }])),
    ).toStrictEqual(["main"]);
  });

  it("blocks the save for an offending block inside an area", () => {
    expect(unsafeZoneIds(zoneWith([area([misshapen()])]))).toStrictEqual([
      "main",
    ]);
    expect(
      unsafeZoneIds(zoneWith([area([createBlockInstance("core:gone", {})])])),
    ).toStrictEqual(["main"]);
  });

  it("says nothing when no registry can be consulted at all", () => {
    expect(
      unsafeZoneIds(
        mounted(mount("main", [createBlockInstance("core:gone", {})])),
      ),
    ).toStrictEqual([]);
  });

  it("consults the process registry when the zone carries none", () => {
    const state = mounted(
      mount("main", [createBlockInstance("core:gone", {})]),
    );
    const restore = setDefaultBlockRegistry(registry);

    expect(unsafeZoneIds(state)).toStrictEqual(["main"]);

    restore();

    expect(unsafeZoneIds(state)).toStrictEqual([]);
  });

  it("clears the moment the offending block is removed", () => {
    const stored = misshapen();
    const removed = visualEditorReducer(zoneWith([block("a"), stored]), {
      ref: ref("main", stored.id),
      type: "remove",
    });

    expect(unsafeZoneIds(removed)).toStrictEqual([]);
    expect(isVisualEditorDirty(removed)).toBe(true);
  });

  it("clears the moment an offending child of an area is removed", () => {
    const stored = misshapen();
    const holder = area([stored]);
    const removed = visualEditorReducer(zoneWith([holder]), {
      ref: ref("main", stored.id, holder.id),
      type: "remove",
    });

    expect(unsafeZoneIds(removed)).toStrictEqual([]);
  });

  it("keeps an offending block selectable, so the panel can still repair it", () => {
    const stored = misshapen();
    const selected = visualEditorReducer(zoneWith([stored]), {
      ref: ref("main", stored.id),
      type: "select",
    });

    expect(selected.selected).toStrictEqual(ref("main", stored.id));
    expect(unsafeZoneIds(selected)).toStrictEqual(["main"]);

    const repaired = visualEditorReducer(selected, {
      data: { body: "a" },
      ref: ref("main", stored.id),
      type: "update",
    });

    expect(unsafeZoneIds(repaired)).toStrictEqual([]);
    expect(repaired.selected).toStrictEqual(ref("main", stored.id));
  });

  it("says nothing about a zone of blocks and areas that all hold up", () => {
    expect(
      unsafeZoneIds(
        zoneWith([block("a"), area([block("b"), block("c")])], ["core:*"]),
      ),
    ).toStrictEqual([]);
  });
});

describe("one block id living in two containers", () => {
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
      from: into("B"),
      nodeId: "X",
      to: into("A"),
      toIndex: 2,
      type: "move",
    });

    const landed = ids(moved, "A");

    expect(landed).toHaveLength(3);
    expect(new Set(landed).size).toBe(3);
    expect(landed.slice(0, 2)).toStrictEqual(["A1", "X"]);
    expect(findBlock(moved, ref("A", landed[2]))?.instance.data).toStrictEqual({
      body: "in b",
    });
    expect(ids(moved, "B")).toStrictEqual(["B1"]);
  });

  it("gives it a fresh id even when the twin sits inside an area of that zone", () => {
    const holder = area([withId("X", "in an area")]);
    const state = mounted(
      mount("A", [withId("A1", "a1"), holder]),
      mount("B", [withId("X", "in b")]),
    );

    const moved = visualEditorReducer(state, {
      from: into("B"),
      nodeId: "X",
      to: into("A"),
      toIndex: 0,
      type: "move",
    });

    const landed = ids(moved, "A");

    expect(landed[0]).not.toBe("X");
    expect(childIds(moved, "A", holder.id)).toStrictEqual(["X"]);
    expect(findBlock(moved, ref("A", landed[0]))?.instance.data).toStrictEqual({
      body: "in b",
    });
  });

  it("keeps the id when the zone it moves into has no such block", () => {
    const moved = visualEditorReducer(
      mounted(
        mount("A", [withId("A1", "a1"), withId("X", "in a")]),
        mount("B", [withId("X", "in b")]),
        mount("C", []),
      ),
      {
        from: into("B"),
        nodeId: "X",
        to: into("C"),
        toIndex: 0,
        type: "move",
      },
    );

    expect(ids(moved, "C")).toStrictEqual(["X"]);
  });

  it("keeps the id when it only moves between containers of one zone", () => {
    const holder = area();
    const state = mounted(mount("A", [withId("X", "x"), holder]));

    const moved = visualEditorReducer(state, {
      from: into("A"),
      nodeId: "X",
      to: into("A", holder.id),
      toIndex: 0,
      type: "move",
    });

    expect(ids(moved, "A")).toStrictEqual([holder.id]);
    expect(childIds(moved, "A", holder.id)).toStrictEqual(["X"]);
  });

  it("re-identifies an area's children when they collide in the new zone", () => {
    const holder = area([withId("X", "inside")]);
    const state = mounted(
      mount("A", [holder]),
      mount("B", [withId("X", "in b")]),
    );

    const moved = visualEditorReducer(state, {
      from: into("A"),
      nodeId: holder.id,
      to: into("B"),
      toIndex: 0,
      type: "move",
    });

    const inside = childIds(moved, "B", holder.id);

    expect(ids(moved, "B")).toStrictEqual([holder.id, "X"]);
    expect(inside).toHaveLength(1);
    expect(inside[0]).not.toBe("X");
    expect(
      findBlock(moved, ref("B", inside[0], holder.id))?.instance.data,
    ).toStrictEqual({ body: "inside" });
  });

  it("follows the re-identified block with the selection that was on it", () => {
    const selected = visualEditorReducer(twins(), {
      ref: ref("B", "X"),
      type: "select",
    });

    const moved = visualEditorReducer(selected, {
      from: into("B"),
      nodeId: "X",
      to: into("A"),
      toIndex: 0,
      type: "move",
    });

    expect(moved.selected?.zoneId).toBe("A");
    expect(moved.selected?.nodeId).not.toBe("X");
    expect(
      findBlock(moved, ref("A", moved.selected?.nodeId ?? ""))?.instance.data,
    ).toStrictEqual({ body: "in b" });
  });

  it("leaves a selection in the other zone alone when a twin moves", () => {
    const selected = visualEditorReducer(twins(), {
      ref: ref("A", "X"),
      type: "select",
    });

    const moved = visualEditorReducer(selected, {
      from: into("B"),
      nodeId: "X",
      to: into("A"),
      toIndex: 0,
      type: "move",
    });

    expect(moved.selected).toStrictEqual(ref("A", "X"));
  });

  it("selects the copy in the zone the ref names, never the other one", () => {
    const state = twins();

    expect(
      visualEditorReducer(state, { ref: ref("A", "X"), type: "select" })
        .selected,
    ).toStrictEqual(ref("A", "X"));
    expect(
      visualEditorReducer(state, { ref: ref("B", "X"), type: "select" })
        .selected,
    ).toStrictEqual(ref("B", "X"));
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
    const copy = state.zones.A.nodes[2];

    expect(ids(state, "A")).toStrictEqual(["A1", "X", copy.id]);
    expect(copy.id).not.toBe("X");
    expect(findBlock(state, ref("A", copy.id))?.instance.data).toStrictEqual({
      body: "in a",
    });
    expect(ids(state, "B")).toStrictEqual(["X", "B1"]);
    expect(state.selected).toStrictEqual(ref("A", copy.id));
  });

  it("moves the copy the source zone owns and leaves the twin where it was", () => {
    const moved = visualEditorReducer(
      visualEditorReducer(twins(), { type: "mount", zone: mount("C", []) }),
      {
        from: into("B"),
        nodeId: "X",
        to: into("C"),
        toIndex: 0,
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

  it("looks a block up per zone, by the ref that names its container", () => {
    const state = twins();

    expect(findBlock(state, ref("A", "X"))).toStrictEqual({
      index: 1,
      instance: withId("X", "in a"),
    });
    expect(findBlock(state, ref("B", "X"))).toStrictEqual({
      index: 0,
      instance: withId("X", "in b"),
    });
    expect(findBlock(state, ref("A", "B1"))).toBeNull();
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

    expect(removed.selected).toStrictEqual(ref("A", "X"));
    expect(ids(removed, "A")).toStrictEqual(["A1", "X"]);
  });
});

describe("a zone that leaves the page", () => {
  const edited = (): VisualEditorState =>
    visualEditorReducer(
      mounted(mount("main", [block("a")]), mount("aside", [block("c")])),
      {
        container: into("aside"),
        index: 1,
        instance: block("d"),
        type: "insert",
      },
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
    ).toStrictEqual(ref("main", instance.id));
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

  it("rebaselines a zone that comes back from the nodes it mounts with", () => {
    const [c, d] = [block("c"), block("d")];
    const state = visualEditorReducer(
      mounted(mount("main", [block("a")]), mount("aside", [c])),
      { container: into("aside"), index: 1, instance: d, type: "insert" },
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

describe("canonical content arriving from the page owner", () => {
  const invalidEntry = { index: 1, value: { foo: "bar" } };

  it("adopts a reordered array the page hands a clean zone", () => {
    const [a, b] = [block("a"), block("b")];
    const state = mounted(mount("main", [a, b]));

    const adopted = visualEditorReducer(state, {
      type: "mount",
      zone: mount("main", [b, a]),
    });

    expect(ids(adopted, "main")).toStrictEqual([b.id, a.id]);
    expect(adopted.zones.main.initial).toStrictEqual([b, a]);
    expect(isVisualEditorDirty(adopted)).toBe(false);
    expect(changedZoneIds(adopted)).toStrictEqual([]);
  });

  it("adopts the invalid entries a clean zone is remounted with, in both directions", () => {
    const a = block("a");
    const state = mounted(mount("main", [a]));

    const gained = visualEditorReducer(state, {
      type: "mount",
      zone: { ...mount("main", [a]), invalid: [invalidEntry] },
    });

    expect(gained.zones.main.invalid).toStrictEqual([invalidEntry]);
    expect(gained.zones.main.initialInvalid).toStrictEqual([invalidEntry]);
    expect(unsafeZoneIds(gained)).toStrictEqual(["main"]);
    expect(isVisualEditorDirty(gained)).toBe(false);

    const lost = visualEditorReducer(gained, {
      type: "mount",
      zone: mount("main", [a]),
    });

    expect(lost.zones.main.invalid).toStrictEqual([]);
    expect(lost.zones.main.initialInvalid).toStrictEqual([]);
    expect(unsafeZoneIds(lost)).toStrictEqual([]);
    expect(isVisualEditorDirty(lost)).toBe(false);
  });

  it("leaves a dirty zone on its own content when the page hands it another order", () => {
    const [a, b] = [block("a"), block("b")];
    const edited = visualEditorReducer(mounted(mount("main", [a, b])), {
      data: { body: "a2" },
      ref: ref("main", a.id),
      type: "update",
    });

    const remounted = visualEditorReducer(edited, {
      type: "mount",
      zone: mount("main", [b, a]),
    });

    expect(ids(remounted, "main")).toStrictEqual([a.id, b.id]);
    expect(
      findBlock(remounted, ref("main", a.id))?.instance.data,
    ).toStrictEqual({ body: "a2" });
    expect(remounted.zones.main.initial).toBe(edited.zones.main.initial);
    expect(remounted.zones.main.invalid).toBe(edited.zones.main.invalid);
    expect(isVisualEditorDirty(remounted)).toBe(true);
  });

  it("still refreshes a dirty zone's allowlist and registry from the same mount", () => {
    const registry = createBlockRegistry([]);
    const [a, b] = [block("a"), block("b")];
    const edited = visualEditorReducer(mounted(mount("main", [a, b])), {
      data: { body: "a2" },
      ref: ref("main", a.id),
      type: "update",
    });

    const remounted = visualEditorReducer(edited, {
      type: "mount",
      zone: { ...mount("main", [b, a], "*"), registry },
    });

    expect(remounted.zones.main.allowedBlocks).toBe("*");
    expect(remounted.zones.main.registry).toBe(registry);
    expect(remounted.zones.main.nodes).toBe(edited.zones.main.nodes);
    expect(remounted.zones.main.initial).toBe(edited.zones.main.initial);
    expect(isVisualEditorDirty(remounted)).toBe(true);
  });

  it("changes nothing when the content it mounts with is the baseline it already has", () => {
    const [a, b] = [block("a"), block("b")];
    const holder = area([block("inside")], { columns: 2 });
    const state = mounted(mount("main", [a, holder, b]));

    expect(
      visualEditorReducer(state, {
        type: "mount",
        zone: mount("main", [a, holder, b]),
      }),
    ).toBe(state);
    expect(
      visualEditorReducer(state, {
        type: "mount",
        zone: mount("main", [
          { ...a, data: { ...a.data } },
          {
            ...holder,
            children: [...holder.children],
            layout: { ...holder.layout },
          },
          b,
        ]),
      }),
    ).toBe(state);
  });

  it("notices an area whose layout, children or variants moved on", () => {
    const child = createBlockInstance("core:hero", { title: "a" });
    const holder = area([child], { columns: 2 });
    const state = mounted(mount("main", [holder]));

    const relaidOut = visualEditorReducer(state, {
      type: "mount",
      zone: mount("main", [{ ...holder, layout: { columns: 3 } }]),
    });

    expect(relaidOut).not.toBe(state);
    expect(
      findArea(relaidOut, areaRef("main", holder.id))?.area.layout.columns,
    ).toBe(3);

    const restyled = visualEditorReducer(state, {
      type: "mount",
      zone: mount("main", [
        { ...holder, children: [{ ...child, variant: "wide" }] },
      ]),
    });

    expect(restyled).not.toBe(state);
    expect(
      findBlock(restyled, ref("main", child.id, holder.id))?.instance.variant,
    ).toBe("wide");
  });

  it("clears a selection the adopted content dropped, and no other", () => {
    const [a, b, c] = [block("a"), block("b"), block("c")];
    const state = mounted(mount("main", [a, b]), mount("aside", [c]));
    const onGoneBlock = visualEditorReducer(state, {
      ref: ref("main", a.id),
      type: "select",
    });
    const onOtherZone = visualEditorReducer(state, {
      ref: ref("aside", c.id),
      type: "select",
    });

    expect(
      visualEditorReducer(onGoneBlock, {
        type: "mount",
        zone: mount("main", [b]),
      }).selected,
    ).toBeNull();
    expect(
      visualEditorReducer(onGoneBlock, {
        type: "mount",
        zone: mount("main", [b, a]),
      }).selected,
    ).toStrictEqual(ref("main", a.id));
    expect(
      visualEditorReducer(onOtherZone, {
        type: "mount",
        zone: mount("main", [b]),
      }).selected,
    ).toStrictEqual(ref("aside", c.id));
  });

  it("takes the order the server answered with, so the next save sends that one", () => {
    const [a, b] = [block("a"), block("b")];
    const sent = visualEditorReducer(mounted(mount("main", [a])), {
      container: into("main"),
      index: 1,
      instance: b,
      type: "insert",
    });

    const saved = visualEditorReducer(sent, inFlight(sent, { main: [b, a] }));

    expect(ids(saved, "main")).toStrictEqual([b.id, a.id]);
    expect(saved.zones.main.initial).toStrictEqual([b, a]);
    expect(isVisualEditorDirty(saved)).toBe(false);
    expect(buildSaveInput(saved).zones.main).toStrictEqual([b, a]);
    expect(buildSaveInput(saved).changedZoneIds).toStrictEqual([]);
  });

  it("adopts canonical areas and variants a save answered with", () => {
    const child = createBlockInstance("core:hero", { title: "a" });
    const holder = area([child], { columns: 2 });
    const sent = visualEditorReducer(mounted(mount("main", [])), {
      area: holder,
      index: 0,
      type: "insert-area",
      zoneId: "main",
    });
    const canonical: BlockAreaInstance = {
      ...holder,
      children: [{ ...child, variant: "wide" }],
      layout: { columns: 3 },
    };

    const saved = visualEditorReducer(
      sent,
      inFlight(sent, { main: [canonical] }),
    );

    expect(isVisualEditorDirty(saved)).toBe(false);
    expect(
      findArea(saved, areaRef("main", holder.id))?.area.layout.columns,
    ).toBe(3);
    expect(
      findBlock(saved, ref("main", child.id, holder.id))?.instance.variant,
    ).toBe("wide");
  });

  it("keeps an edit made while the save was in flight, dirty against the canonical baseline", () => {
    const [a, b] = [block("a"), block("b")];
    const canonical = { ...a, data: { body: "a from the server" } };
    const sent = mounted(mount("main", [a]));
    const sending = inFlight(sent, { main: [canonical] });
    const current = visualEditorReducer(
      visualEditorReducer(sent, {
        container: into("main"),
        index: 1,
        instance: b,
        type: "insert",
      }),
      { ref: ref("main", a.id), type: "remove" },
    );

    const saved = visualEditorReducer(current, sending);

    expect(saved.zones.main.initial).toStrictEqual([canonical]);
    expect(ids(saved, "main")).toStrictEqual([b.id]);
    expect(isVisualEditorDirty(saved)).toBe(true);

    const settled = visualEditorReducer(saved, inFlight(saved));

    expect(settled.zones.main.initial).toStrictEqual([b]);
    expect(isVisualEditorDirty(settled)).toBe(false);
  });

  it("falls back to the snapshot it sent when the answer carries no canonical content", () => {
    const [a, b] = [block("a"), block("b")];
    const sent = visualEditorReducer(mounted(mount("main", [a])), {
      container: into("main"),
      index: 1,
      instance: b,
      type: "insert",
    });
    const sending = inFlight(sent, undefined);

    const saved = visualEditorReducer(sent, sending);

    expect(sending.canonical).toBeUndefined();
    expect(saved.zones.main.initial).toBe(sending.snapshot.main);
    expect(ids(saved, "main")).toStrictEqual([a.id, b.id]);
    expect(isVisualEditorDirty(saved)).toBe(false);
  });

  it("ignores canonical content for a zone the save never sent", () => {
    const [a, c, d] = [block("a"), block("c"), block("d")];
    const sent = mounted(mount("main", [a]));
    const sending = inFlight(sent, { aside: [d], main: [a] });
    const current = visualEditorReducer(sent, {
      type: "mount",
      zone: mount("aside", [c]),
    });

    const saved = visualEditorReducer(current, sending);

    expect(Object.keys(sending.snapshot)).toStrictEqual(["main"]);
    expect(ids(saved, "aside")).toStrictEqual([c.id]);
    expect(saved.zones.aside.initial).toStrictEqual([c]);
    expect(isVisualEditorDirty(saved)).toBe(false);
  });
});

describe("a cross-zone move the target zone cannot render", () => {
  const definition = (id: string) => ({
    component: () => null,
    fields: { body: field.text({}) },
    id,
  });

  const coreOnly = createBlockRegistry([
    {
      pluginId: "@vitnode/core",
      blocks: [definition("text"), definition("cta")],
      namespace: "core",
    },
  ]);

  const withBlog = createBlockRegistry([
    {
      pluginId: "@vitnode/core",
      blocks: [definition("text")],
      namespace: "core",
    },
    { pluginId: "@vitnode/blog", blocks: [definition("latest-posts")] },
  ]);

  const zone = (
    id: string,
    nodes: readonly (AnyBlockInstance | BlockAreaInstance)[],
    registry: ReturnType<typeof createBlockRegistry>,
  ): EditorZoneMount => ({
    allowedBlocks: "*",
    id,
    invalid: [],
    max: undefined,
    min: undefined,
    nodes,
    registry,
  });

  const post = (): AnyBlockInstance =>
    createBlockInstance("blog:latest-posts", { body: "x" });

  const text = (): AnyBlockInstance =>
    createBlockInstance("core:text", { body: "x" });

  it("refuses a block the target zone's registry does not know", () => {
    const moving = post();
    const state = mounted(
      zone("main", [moving], withBlog),
      zone("aside", [], coreOnly),
    );

    const next = visualEditorReducer(state, {
      from: into("main"),
      nodeId: moving.id,
      to: into("aside"),
      toIndex: 0,
      type: "move",
    });

    expect(next).toBe(state);
    expect(next.zones.aside.nodes).toStrictEqual([]);
    expect(next.zones.main.nodes).toStrictEqual([moving]);
  });

  it("refuses the whole area when one child is unknown to the target", () => {
    const [keep, drop] = [text(), post()];
    const moving = area([keep, drop]);
    const state = mounted(
      zone("main", [moving], withBlog),
      zone("aside", [], coreOnly),
    );

    const next = visualEditorReducer(state, {
      from: into("main"),
      nodeId: moving.id,
      to: into("aside"),
      toIndex: 0,
      type: "move",
    });

    expect(next).toBe(state);
    expect(next.zones.aside.nodes).toStrictEqual([]);
  });

  it("lets a block the target zone does know across", () => {
    const moving = text();
    const state = mounted(
      zone("main", [moving], withBlog),
      zone("aside", [], coreOnly),
    );

    const next = visualEditorReducer(state, {
      from: into("main"),
      nodeId: moving.id,
      to: into("aside"),
      toIndex: 0,
      type: "move",
    });

    expect(next.zones.aside.nodes.map(node => node.id)).toStrictEqual([
      moving.id,
    ]);
    expect(next.zones.main.nodes).toStrictEqual([]);
  });

  it("never blocks a reorder inside the zone that already holds the block", () => {
    const [first, second] = [post(), text()];
    const state = mounted(zone("main", [first, second], withBlog));

    const next = visualEditorReducer(state, {
      from: into("main"),
      nodeId: first.id,
      to: into("main"),
      toIndex: 1,
      type: "move",
    });

    expect(next.zones.main.nodes.map(node => node.id)).toStrictEqual([
      second.id,
      first.id,
    ]);
  });

  it("stays out of the way when no registry can be consulted at all", () => {
    const moving = post();
    const state = mounted(mount("main", [moving]), mount("aside", []));

    const next = visualEditorReducer(state, {
      from: into("main"),
      nodeId: moving.id,
      to: into("aside"),
      toIndex: 0,
      type: "move",
    });

    expect(next.zones.aside.nodes.map(node => node.id)).toStrictEqual([
      moving.id,
    ]);
  });
});

describe("the children an area is allowed to hold", () => {
  const children = (count: number): AnyBlockInstance[] =>
    Array.from({ length: count }, (_, at) => block(`child-${at}`));

  const full = (): AnyBlockInstance[] => children(AREA_CHILDREN_DEFAULT_MAX);

  it("refuses the block that would push an area past the cap", () => {
    const holder = area(full());
    const state = mounted(mount("main", [holder]));

    const next = visualEditorReducer(state, {
      container: into("main", holder.id),
      index: 0,
      instance: block("one too many"),
      type: "insert",
    });

    expect(next).toBe(state);
    expect(childIds(next, "main", holder.id)).toHaveLength(
      AREA_CHILDREN_DEFAULT_MAX,
    );
  });

  it("takes the block that still fits", () => {
    const holder = area(children(AREA_CHILDREN_DEFAULT_MAX - 1));
    const last = block("last one in");
    const state = visualEditorReducer(mounted(mount("main", [holder])), {
      container: into("main", holder.id),
      index: AREA_CHILDREN_DEFAULT_MAX - 1,
      instance: last,
      type: "insert",
    });

    const held = childIds(state, "main", holder.id);

    expect(held).toHaveLength(AREA_CHILDREN_DEFAULT_MAX);
    expect(held.at(-1)).toBe(last.id);
  });

  it("refuses to duplicate a child of a full area", () => {
    const held = full();
    const holder = area(held);
    const state = mounted(mount("main", [holder]));

    const next = visualEditorReducer(state, {
      ref: ref("main", held[0].id, holder.id),
      type: "duplicate",
    });

    expect(next).toBe(state);
    expect(next.selected).toBeNull();
    expect(childIds(next, "main", holder.id)).toHaveLength(
      AREA_CHILDREN_DEFAULT_MAX,
    );
  });

  it("refuses a move from the zone root into a full area", () => {
    const holder = area(full());
    const outside = block("outside");
    const state = mounted(mount("main", [outside, holder]));

    const next = visualEditorReducer(state, {
      from: into("main"),
      nodeId: outside.id,
      to: into("main", holder.id),
      toIndex: 0,
      type: "move",
    });

    expect(next).toBe(state);
    expect(ids(next, "main")).toStrictEqual([outside.id, holder.id]);
    expect(childIds(next, "main", holder.id)).toHaveLength(
      AREA_CHILDREN_DEFAULT_MAX,
    );
  });

  it("refuses a move out of another area into a full one", () => {
    const child = block("inside");
    const left = area([child]);
    const right = area(full());
    const state = mounted(mount("main", [left, right]));

    const next = visualEditorReducer(state, {
      from: into("main", left.id),
      nodeId: child.id,
      to: into("main", right.id),
      toIndex: 0,
      type: "move",
    });

    expect(next).toBe(state);
    expect(childIds(next, "main", left.id)).toStrictEqual([child.id]);
    expect(childIds(next, "main", right.id)).toHaveLength(
      AREA_CHILDREN_DEFAULT_MAX,
    );
  });

  it("refuses a move from another zone into a full area", () => {
    const holder = area(full());
    const moving = block("incoming");
    const state = mounted(mount("main", [holder]), mount("aside", [moving]));

    const next = visualEditorReducer(state, {
      from: into("aside"),
      nodeId: moving.id,
      to: into("main", holder.id),
      toIndex: 0,
      type: "move",
    });

    expect(next).toBe(state);
    expect(ids(next, "aside")).toStrictEqual([moving.id]);
    expect(childIds(next, "main", holder.id)).toHaveLength(
      AREA_CHILDREN_DEFAULT_MAX,
    );
  });

  it("still reorders a child inside a full area", () => {
    const held = full();
    const holder = area(held);
    const state = mounted(mount("main", [holder]));

    const next = visualEditorReducer(state, {
      from: into("main", holder.id),
      nodeId: held[0].id,
      to: into("main", holder.id),
      toIndex: AREA_CHILDREN_DEFAULT_MAX - 1,
      type: "move",
    });

    const order = childIds(next, "main", holder.id);

    expect(order).toHaveLength(AREA_CHILDREN_DEFAULT_MAX);
    expect(order[0]).toBe(held[1].id);
    expect(order.at(-1)).toBe(held[0].id);
  });

  it("takes a block back once a child has left a full area", () => {
    const held = full();
    const holder = area(held);
    const waiting = block("waiting");
    const state = mounted(mount("main", [waiting, holder]));

    const emptied = visualEditorReducer(state, {
      from: into("main", holder.id),
      nodeId: held[0].id,
      to: into("main"),
      toIndex: 0,
      type: "move",
    });

    expect(childIds(emptied, "main", holder.id)).toHaveLength(
      AREA_CHILDREN_DEFAULT_MAX - 1,
    );

    const refilled = visualEditorReducer(emptied, {
      from: into("main"),
      nodeId: waiting.id,
      to: into("main", holder.id),
      toIndex: 0,
      type: "move",
    });

    expect(childIds(refilled, "main", holder.id)).toHaveLength(
      AREA_CHILDREN_DEFAULT_MAX,
    );
    expect(childIds(refilled, "main", holder.id)[0]).toBe(waiting.id);
  });

  it("leaves the zone root uncapped", () => {
    const state = mounted(mount("main", full()));
    const added = block("one more");

    const next = visualEditorReducer(state, {
      container: into("main"),
      index: AREA_CHILDREN_DEFAULT_MAX,
      instance: added,
      type: "insert",
    });

    expect(ids(next, "main")).toHaveLength(AREA_CHILDREN_DEFAULT_MAX + 1);
    expect(ids(next, "main").at(-1)).toBe(added.id);
  });

  it("refuses an area that arrives already over the cap", () => {
    const state = mounted(mount("main", []));

    const next = visualEditorReducer(state, {
      area: area(children(AREA_CHILDREN_DEFAULT_MAX + 1)),
      index: 0,
      type: "insert-area",
      zoneId: "main",
    });

    expect(next).toBe(state);
    expect(ids(next, "main")).toStrictEqual([]);
  });

  it("still lets a child out of an area that mounted over the cap", () => {
    const held = children(AREA_CHILDREN_DEFAULT_MAX + 1);
    const holder = area(held);
    const state = mounted(mount("main", [holder]));

    const next = visualEditorReducer(state, {
      ref: ref("main", held[0].id, holder.id),
      type: "remove",
    });

    expect(childIds(next, "main", holder.id)).toHaveLength(
      AREA_CHILDREN_DEFAULT_MAX,
    );
  });
});

describe("the blocks a zone has to keep and the blocks it can hold", () => {
  const children = (count: number): AnyBlockInstance[] =>
    Array.from({ length: count }, (_, at) => block(`child-${at}`));

  it("refuses the block that would push the zone past its max", () => {
    const state = mounted(
      mount("main", [block("a"), block("b")], undefined, { max: 2 }),
    );

    const next = visualEditorReducer(state, {
      container: into("main"),
      index: 2,
      instance: block("one too many"),
      type: "insert",
    });

    expect(next).toBe(state);
    expect(ids(next, "main")).toHaveLength(2);
  });

  it("refuses the child an area has room for but the zone does not", () => {
    const holder = area(children(2));
    const state = mounted(mount("main", [holder], undefined, { max: 2 }));

    const next = visualEditorReducer(state, {
      container: into("main", holder.id),
      index: 2,
      instance: block("one too many"),
      type: "insert",
    });

    expect(next).toBe(state);
    expect(childIds(next, "main", holder.id)).toHaveLength(2);
  });

  it("counts an area's children, not the area itself", () => {
    const holder = area(children(2));
    const state = mounted(
      mount("main", [block("loose"), holder], undefined, { max: 3 }),
    );

    const next = visualEditorReducer(state, {
      container: into("main"),
      index: 2,
      instance: block("fourth block"),
      type: "insert",
    });

    expect(next).toBe(state);
  });

  it("still takes the block that fits exactly", () => {
    const state = mounted(mount("main", [block("a")], undefined, { max: 2 }));
    const added = block("b");

    const next = visualEditorReducer(state, {
      container: into("main"),
      index: 1,
      instance: added,
      type: "insert",
    });

    expect(ids(next, "main")).toStrictEqual([ids(state, "main")[0], added.id]);
  });

  it("still reorders a zone that is at its max", () => {
    const first = block("a");
    const second = block("b");
    const state = mounted(
      mount("main", [first, second], undefined, { max: 2 }),
    );

    const next = visualEditorReducer(state, {
      from: into("main"),
      nodeId: first.id,
      to: into("main"),
      toIndex: 1,
      type: "move",
    });

    expect(ids(next, "main")).toStrictEqual([second.id, first.id]);
  });

  it("still moves a block into an area of the same zone at its max", () => {
    const loose = block("loose");
    const holder = area(children(1));
    const state = mounted(
      mount("main", [loose, holder], undefined, { max: 2 }),
    );

    const next = visualEditorReducer(state, {
      from: into("main"),
      nodeId: loose.id,
      to: into("main", holder.id),
      toIndex: 0,
      type: "move",
    });

    expect(ids(next, "main")).toStrictEqual([holder.id]);
    expect(childIds(next, "main", holder.id)[0]).toBe(loose.id);
  });

  it("takes a block from another zone while the target still has room", () => {
    const moving = block("incoming");
    const state = mounted(
      mount("main", children(2), undefined, { max: 3 }),
      mount("aside", [moving]),
    );

    const next = visualEditorReducer(state, {
      from: into("aside"),
      nodeId: moving.id,
      to: into("main"),
      toIndex: 2,
      type: "move",
    });

    expect(ids(next, "main")).toHaveLength(3);
    expect(ids(next, "aside")).toStrictEqual([]);
  });

  it("refuses the block from another zone once the target is at its max", () => {
    const moving = block("incoming");
    const state = mounted(
      mount("main", children(3), undefined, { max: 3 }),
      mount("aside", [moving]),
    );

    const next = visualEditorReducer(state, {
      from: into("aside"),
      nodeId: moving.id,
      to: into("main"),
      toIndex: 3,
      type: "move",
    });

    expect(next).toBe(state);
    expect(ids(next, "aside")).toStrictEqual([moving.id]);
  });

  it("counts every child of an area moved in from another zone", () => {
    const holder = area(children(3));
    const state = mounted(
      mount("main", [block("a")], undefined, { max: 3 }),
      mount("aside", [holder]),
    );

    const next = visualEditorReducer(state, {
      from: into("aside"),
      nodeId: holder.id,
      to: into("main"),
      toIndex: 1,
      type: "move",
    });

    expect(next).toBe(state);
    expect(ids(next, "aside")).toStrictEqual([holder.id]);
  });

  it("takes that same area into a zone with room for all of it", () => {
    const holder = area(children(3));
    const state = mounted(
      mount("main", [block("a")], undefined, { max: 4 }),
      mount("aside", [holder]),
    );

    const next = visualEditorReducer(state, {
      from: into("aside"),
      nodeId: holder.id,
      to: into("main"),
      toIndex: 1,
      type: "move",
    });

    expect(ids(next, "main")).toHaveLength(2);
    expect(ids(next, "aside")).toStrictEqual([]);
  });

  it("refuses to duplicate a block the zone has no room for", () => {
    const only = block("a");
    const state = mounted(mount("main", [only], undefined, { max: 1 }));

    const next = visualEditorReducer(state, {
      ref: ref("main", only.id),
      type: "duplicate",
    });

    expect(next).toBe(state);
    expect(next.selected).toBeNull();
  });

  it("refuses to duplicate an area whose children would not fit", () => {
    const holder = area(children(2));
    const state = mounted(
      mount("main", [block("a"), holder], undefined, { max: 4 }),
    );

    const next = visualEditorReducer(state, {
      ref: areaRef("main", holder.id),
      type: "duplicate",
    });

    expect(next).toBe(state);
    expect(ids(next, "main")).toHaveLength(2);
  });

  it("lets an empty area in even when the zone is at its max", () => {
    const holder = area();
    const state = mounted(mount("main", children(2), undefined, { max: 2 }));

    const next = visualEditorReducer(state, {
      area: holder,
      index: 2,
      type: "insert-area",
      zoneId: "main",
    });

    expect(ids(next, "main")).toHaveLength(3);
    expect(ids(next, "main").at(-1)).toBe(holder.id);
  });

  it("refuses an area that arrives with more children than the zone can hold", () => {
    const state = mounted(mount("main", [block("a")], undefined, { max: 2 }));

    const next = visualEditorReducer(state, {
      area: area(children(2)),
      index: 1,
      type: "insert-area",
      zoneId: "main",
    });

    expect(next).toBe(state);
  });

  it("refuses to remove the last block a zone has to keep", () => {
    const only = block("a");
    const state = mounted(mount("main", [only], undefined, { min: 1 }));

    const next = visualEditorReducer(state, {
      ref: ref("main", only.id),
      type: "remove",
    });

    expect(next).toBe(state);
    expect(ids(next, "main")).toStrictEqual([only.id]);
  });

  it("refuses to remove an area holding blocks the zone still needs", () => {
    const holder = area(children(2));
    const state = mounted(mount("main", [holder], undefined, { min: 2 }));

    const next = visualEditorReducer(state, {
      ref: areaRef("main", holder.id),
      type: "remove",
    });

    expect(next).toBe(state);
    expect(childIds(next, "main", holder.id)).toHaveLength(2);
  });

  it("lets a block out while the zone keeps enough of them", () => {
    const leaving = block("leaving");
    const state = mounted(
      mount("main", [...children(2), leaving], undefined, { min: 2 }),
      mount("aside", []),
    );

    const next = visualEditorReducer(state, {
      from: into("main"),
      nodeId: leaving.id,
      to: into("aside"),
      toIndex: 0,
      type: "move",
    });

    expect(ids(next, "main")).toHaveLength(2);
    expect(ids(next, "aside")).toStrictEqual([leaving.id]);
  });

  it("refuses the move that would take the zone below its minimum", () => {
    const leaving = block("leaving");
    const state = mounted(
      mount("main", [block("staying"), leaving], undefined, { min: 2 }),
      mount("aside", []),
    );

    const next = visualEditorReducer(state, {
      from: into("main"),
      nodeId: leaving.id,
      to: into("aside"),
      toIndex: 0,
      type: "move",
    });

    expect(next).toBe(state);
    expect(ids(next, "aside")).toStrictEqual([]);
  });

  it("weighs the source's minimum and the target's max on their own", () => {
    const leaving = block("leaving");
    const state = mounted(
      mount("main", [...children(2), leaving], undefined, { min: 2 }),
      mount("aside", children(1), undefined, { max: 1 }),
    );

    const next = visualEditorReducer(state, {
      from: into("main"),
      nodeId: leaving.id,
      to: into("aside"),
      toIndex: 1,
      type: "move",
    });

    expect(next).toBe(state);
    expect(ids(next, "main")).toHaveLength(3);
  });

  it("still reorders a zone that is at its minimum", () => {
    const first = block("a");
    const second = block("b");
    const state = mounted(
      mount("main", [first, second], undefined, { min: 2 }),
    );

    const next = visualEditorReducer(state, {
      from: into("main"),
      nodeId: second.id,
      to: into("main"),
      toIndex: 0,
      type: "move",
    });

    expect(ids(next, "main")).toStrictEqual([second.id, first.id]);
  });

  it("still moves a block into an area of the same zone at its minimum", () => {
    const loose = block("loose");
    const holder = area(children(1));
    const state = mounted(
      mount("main", [loose, holder], undefined, { min: 2 }),
    );

    const next = visualEditorReducer(state, {
      from: into("main"),
      nodeId: loose.id,
      to: into("main", holder.id),
      toIndex: 1,
      type: "move",
    });

    expect(childIds(next, "main", holder.id)).toHaveLength(2);
  });

  it("still ungroups an area while the zone is at its minimum", () => {
    const holder = area(children(2));
    const state = mounted(mount("main", [holder], undefined, { min: 2 }));

    const next = visualEditorReducer(state, {
      ref: areaRef("main", holder.id),
      type: "unwrap-area",
    });

    expect(ids(next, "main")).toHaveLength(2);
  });

  it("keeps the area's own cap separate from the zone's", () => {
    const holder = area(children(AREA_CHILDREN_DEFAULT_MAX));
    const state = mounted(mount("main", [holder], undefined, { max: 100 }));

    const next = visualEditorReducer(state, {
      container: into("main", holder.id),
      index: AREA_CHILDREN_DEFAULT_MAX,
      instance: block("one too many"),
      type: "insert",
    });

    expect(next).toBe(state);
  });

  it("leaves a zone that mounted over its max able to shrink", () => {
    const leaving = block("leaving");
    const state = mounted(
      mount("main", [...children(3), leaving], undefined, { max: 2 }),
    );

    const next = visualEditorReducer(state, {
      ref: ref("main", leaving.id),
      type: "remove",
    });

    expect(ids(next, "main")).toHaveLength(3);
  });
});

describe("what the sidebar is allowed to insert into", () => {
  const children = (count: number): AnyBlockInstance[] =>
    Array.from({ length: count }, (_, at) => block(`child-${at}`));

  it("refuses an area that is already at the child cap", () => {
    const holder = area(children(AREA_CHILDREN_DEFAULT_MAX));
    const state = mounted(mount("main", [holder]));

    expect(containerAcceptsBlock(state, into("main", holder.id))).toBe(false);
  });

  it("takes an area that is one child short of the cap", () => {
    const holder = area(children(AREA_CHILDREN_DEFAULT_MAX - 1));
    const state = mounted(mount("main", [holder]));

    expect(containerAcceptsBlock(state, into("main", holder.id))).toBe(true);
  });

  it("refuses a zone that is at its max", () => {
    const state = mounted(mount("main", children(2), undefined, { max: 2 }));

    expect(containerAcceptsBlock(state, into("main"))).toBe(false);
  });

  it("refuses an area inside a zone that is at its max", () => {
    const holder = area(children(1));
    const state = mounted(
      mount("main", [block("a"), holder], undefined, { max: 2 }),
    );

    expect(containerAcceptsBlock(state, into("main", holder.id))).toBe(false);
  });

  it("takes a zone with room to spare", () => {
    const state = mounted(mount("main", children(1), undefined, { max: 2 }));

    expect(containerAcceptsBlock(state, into("main"))).toBe(true);
  });

  it("refuses a container that is not there at all", () => {
    const state = mounted(mount("main", []));

    expect(containerAcceptsBlock(state, into("gone"))).toBe(false);
    expect(containerAcceptsBlock(state, into("main", "no-such-area"))).toBe(
      false,
    );
  });
});
