// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { AnyBlockInstance } from "../../blocks/types";
import type {
  EditorZoneMount,
  VisualEditorSnapshot,
  VisualEditorState,
} from "./types";

import {
  initialVisualEditorState,
  isVisualEditorDirty,
  visualEditorReducer,
} from "./reducer";

const ZONE = "page:main";
const NODE_ID = "01JORCHREPRO0000000000001";

const node = (heading: string): AnyBlockInstance => ({
  data: { heading },
  id: NODE_ID,
  type: "core:text",
});

const mount = (nodes: readonly AnyBlockInstance[]): EditorZoneMount => ({
  allowedBlocks: undefined,
  id: ZONE,
  invalid: [],
  max: undefined,
  min: undefined,
  nodes,
  registry: undefined,
});

const headingIn = (state: VisualEditorState): string => {
  const [first] = state.zones[ZONE].nodes;

  return String((first as AnyBlockInstance).data.heading);
};

const edited = (): VisualEditorState => {
  const mounted = visualEditorReducer(initialVisualEditorState, {
    type: "mount",
    zone: mount([node("one")]),
  });

  return visualEditorReducer(mounted, {
    data: { heading: "two" },
    ref: { areaId: null, kind: "block", nodeId: NODE_ID, zoneId: ZONE },
    type: "update",
  });
};

const saved = (
  state: VisualEditorState,
  canonical: undefined | VisualEditorSnapshot,
): VisualEditorState =>
  visualEditorReducer(state, {
    canonical,
    invalid: { [ZONE]: [] },
    snapshot: { [ZONE]: state.zones[ZONE].nodes },
    type: "saved",
  });

describe("a host re-render after a save", () => {
  it("never revives the array the save replaced, with a canonical answer", () => {
    const state = saved(edited(), { [ZONE]: [node("two")] });

    expect(headingIn(state)).toBe("two");

    const remounted = visualEditorReducer(state, {
      type: "mount",
      zone: mount([node("one")]),
    });

    expect(headingIn(remounted)).toBe("two");
    expect(isVisualEditorDirty(remounted)).toBe(false);
  });

  it("never revives it when the adapter answered with nothing at all", () => {
    const state = saved(edited(), undefined);

    expect(headingIn(state)).toBe("two");

    const remounted = visualEditorReducer(state, {
      type: "mount",
      zone: mount([node("one")]),
    });

    expect(headingIn(remounted)).toBe("two");
    expect(isVisualEditorDirty(remounted)).toBe(false);
  });

  it("keeps refusing the same stale array after a second save", () => {
    const first = saved(edited(), undefined);
    const again = visualEditorReducer(first, {
      data: { heading: "three" },
      ref: { areaId: null, kind: "block", nodeId: NODE_ID, zoneId: ZONE },
      type: "update",
    });
    const second = saved(again, undefined);

    const remounted = visualEditorReducer(second, {
      type: "mount",
      zone: mount([node("one")]),
    });

    expect(headingIn(remounted)).toBe("three");
    expect(isVisualEditorDirty(remounted)).toBe(false);
  });

  it("still takes genuinely new data the host pushes in", () => {
    const state = saved(edited(), undefined);
    const remounted = visualEditorReducer(state, {
      type: "mount",
      zone: mount([node("elsewhere")]),
    });

    expect(headingIn(remounted)).toBe("elsewhere");
    expect(isVisualEditorDirty(remounted)).toBe(false);
  });

  it("leaves an unsaved edit alone when the host re-renders", () => {
    const state = edited();
    const remounted = visualEditorReducer(state, {
      type: "mount",
      zone: mount([node("one")]),
    });

    expect(headingIn(remounted)).toBe("two");
    expect(isVisualEditorDirty(remounted)).toBe(true);
  });
  it("stops refusing an old array once the host has caught up", () => {
    const state = saved(edited(), undefined);

    const caughtUp = visualEditorReducer(state, {
      type: "mount",
      zone: mount([node("two")]),
    });

    const reverted = visualEditorReducer(caughtUp, {
      type: "mount",
      zone: mount([node("one")]),
    });

    expect(headingIn(reverted)).toBe("one");
    expect(isVisualEditorDirty(reverted)).toBe(false);
  });

  it("keeps refusing the stale array when a clean zone is discarded", () => {
    const state = visualEditorReducer(saved(edited(), undefined), {
      type: "discard",
    });

    const remounted = visualEditorReducer(state, {
      type: "mount",
      zone: mount([node("one")]),
    });

    expect(headingIn(remounted)).toBe("two");
  });

  it("forgets what a save replaced once the discarded edit is thrown away", () => {
    const dirty = visualEditorReducer(saved(edited(), undefined), {
      data: { heading: "three" },
      ref: { areaId: null, kind: "block", nodeId: NODE_ID, zoneId: ZONE },
      type: "update",
    });

    const state = visualEditorReducer(dirty, { type: "discard" });

    const remounted = visualEditorReducer(state, {
      type: "mount",
      zone: mount([node("one")]),
    });

    expect(headingIn(remounted)).toBe("one");
  });
});
