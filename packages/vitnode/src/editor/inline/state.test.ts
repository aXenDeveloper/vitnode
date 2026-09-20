import { describe, expect, it } from "vitest";

import type {
  AnyBlockInstance,
  BlockUnknownData,
  ContentNode,
} from "../../blocks/types";
import type {
  EditorNodeRef,
  EditorZoneMount,
  VisualEditorState,
} from "../state/types";

import { createAreaInstance } from "../../blocks/area";
import { defineBlock } from "../../blocks/define";
import { createBlockInstance } from "../../blocks/instance";
import { createBlockRegistry } from "../../blocks/registry";
import { field } from "../../content/fields";
import { buildInvalidSnapshot, buildSaveInput } from "../adapter/save-input";
import {
  findBlock,
  initialVisualEditorState,
  isVisualEditorDirty,
  unsafeZoneIds,
  visualEditorReducer,
} from "../state/reducer";
import { editableBlockRender } from "../zones/block-render";
import {
  inlineFieldCommit,
  inlineFieldKind,
  inlineFieldRestore,
  inlineFieldSnapshot,
  inlineFieldText,
} from "./state";

const fields = {
  body: field.textarea({ maxLength: 600 }),
  headline: field.text({ minLength: 3, required: true }),
  note: field.text({ minLength: 0 }),
  published: field.boolean(),
  publishedAt: field.dateTime(),
  seo: field.group({ fields: { metaTitle: field.text({ maxLength: 60 }) } }),
  subtitle: field.text({ minLength: 3 }),
  tagline: field.text({ nullable: true }),
  tone: field.enum({ defaultValue: "info", values: ["info", "warning"] }),
  weight: field.number({ integer: true }),
};

const card = defineBlock({ component: () => null, fields, id: "card" });

const registry = createBlockRegistry([
  { blocks: [card], namespace: "core", pluginId: "@vitnode/core" },
]);

const entry = registry.get("core:card");

const block = (data: BlockUnknownData): AnyBlockInstance =>
  createBlockInstance("core:card", data);

const mount = (nodes: readonly ContentNode[]): EditorZoneMount => ({
  allowedBlocks: undefined,
  id: "main",
  invalid: [],
  max: undefined,
  min: undefined,
  nodes,
  registry,
});

const mounted = (nodes: readonly ContentNode[]): VisualEditorState =>
  visualEditorReducer(initialVisualEditorState, {
    type: "mount",
    zone: mount(nodes),
  });

const refTo = (
  nodeId: string,
  areaId: null | string = null,
): EditorNodeRef => ({
  areaId,
  kind: "block",
  nodeId,
  zoneId: "main",
});

const instanceAt = (
  state: VisualEditorState,
  ref: EditorNodeRef,
): AnyBlockInstance => {
  const found = findBlock(state, ref);
  if (!found) throw new Error(`no block at ${ref.nodeId}`);

  return found.instance;
};

const dataAt = (
  state: VisualEditorState,
  ref: EditorNodeRef,
): BlockUnknownData => instanceAt(state, ref).data;

const typeInline = (
  state: VisualEditorState,
  ref: EditorNodeRef,
  name: string,
  text: string,
): VisualEditorState =>
  visualEditorReducer(state, {
    ...inlineFieldCommit(card, name, text),
    ref,
    type: "update",
  });

describe("inlineFieldKind", () => {
  it("answers for the two kinds Stage 6 can edit in place", () => {
    expect(inlineFieldKind(card, "headline")).toBe("text");
    expect(inlineFieldKind(card, "body")).toBe("textarea");
  });

  it("refuses every kind a contenteditable cannot represent", () => {
    expect(inlineFieldKind(card, "weight")).toBeNull();
    expect(inlineFieldKind(card, "tone")).toBeNull();
    expect(inlineFieldKind(card, "published")).toBeNull();
    expect(inlineFieldKind(card, "publishedAt")).toBeNull();
    expect(inlineFieldKind(card, "seo")).toBeNull();
  });

  it("refuses a leaf inside a group, path and all", () => {
    expect(inlineFieldKind(card, "seo.metaTitle")).toBeNull();
  });

  it("refuses a name the block never declared", () => {
    expect(inlineFieldKind(card, "nope")).toBeNull();
  });

  it("refuses a block the registry could not resolve", () => {
    expect(inlineFieldKind(undefined, "headline")).toBeNull();
  });
});

describe("inlineFieldText", () => {
  it("reads an absent, null or empty value as empty text", () => {
    expect(inlineFieldText({}, "headline")).toBe("");
    expect(inlineFieldText({ headline: null }, "headline")).toBe("");
    expect(inlineFieldText({ headline: "" }, "headline")).toBe("");
  });

  it("reads a stored string back unchanged", () => {
    expect(inlineFieldText({ headline: "Hello" }, "headline")).toBe("Hello");
  });

  it("never stringifies a value that is not a string", () => {
    expect(inlineFieldText({ headline: 42 }, "headline")).toBe("");
  });
});

describe("inlineFieldCommit", () => {
  it("writes the typed text onto the field it belongs to", () => {
    expect(inlineFieldCommit(card, "headline", "Hello")).toStrictEqual({
      data: { headline: "Hello" },
      remove: [],
    });
  });

  it("clears an optional field whose own rules reject empty text", () => {
    expect(inlineFieldCommit(card, "subtitle", "")).toStrictEqual({
      data: {},
      remove: ["subtitle"],
    });
  });

  it("keeps the empty string on an optional field that accepts one", () => {
    expect(inlineFieldCommit(card, "note", "")).toStrictEqual({
      data: { note: "" },
      remove: [],
    });
    expect(inlineFieldCommit(card, "body", "")).toStrictEqual({
      data: { body: "" },
      remove: [],
    });
  });

  it("never silently removes a required field", () => {
    expect(inlineFieldCommit(card, "headline", "")).toStrictEqual({
      data: { headline: "" },
      remove: [],
    });
  });

  it("leaves a nullable field exactly as the panel leaves it", () => {
    expect(inlineFieldCommit(card, "tagline", "")).toStrictEqual({
      data: { tagline: "" },
      remove: [],
    });
  });
});

describe("inlineFieldSnapshot and inlineFieldRestore", () => {
  it("restores an absent key by removing it again", () => {
    const snapshot = inlineFieldSnapshot({ headline: "Hello" }, "subtitle");

    expect(snapshot).toStrictEqual({
      name: "subtitle",
      present: false,
      text: "",
      value: undefined,
    });
    expect(inlineFieldRestore(snapshot)).toStrictEqual({
      data: {},
      remove: ["subtitle"],
    });
  });

  it("restores a null value as null, not as empty text", () => {
    const snapshot = inlineFieldSnapshot({ tagline: null }, "tagline");

    expect(snapshot).toStrictEqual({
      name: "tagline",
      present: true,
      text: "",
      value: null,
    });
    expect(inlineFieldRestore(snapshot)).toStrictEqual({
      data: { tagline: null },
      remove: [],
    });
  });

  it("restores a string value verbatim", () => {
    const snapshot = inlineFieldSnapshot({ headline: "Hello" }, "headline");

    expect(snapshot).toStrictEqual({
      name: "headline",
      present: true,
      text: "Hello",
      value: "Hello",
    });
    expect(inlineFieldRestore(snapshot)).toStrictEqual({
      data: { headline: "Hello" },
      remove: [],
    });
  });

  it("puts a block back exactly as it was found", () => {
    const instance = block({ headline: "Hello" });
    const ref = refTo(instance.id);
    const snapshot = inlineFieldSnapshot(instance.data, "subtitle");

    const typed = typeInline(mounted([instance]), ref, "subtitle", "Draft");
    expect(dataAt(typed, ref)).toStrictEqual({
      headline: "Hello",
      subtitle: "Draft",
    });

    const restored = visualEditorReducer(typed, {
      ...inlineFieldRestore(snapshot),
      ref,
      type: "update",
    });

    expect(dataAt(restored, ref)).toStrictEqual({ headline: "Hello" });
  });
});

describe("an inline commit as the editor's one canonical state", () => {
  it("lands on the block the moderator is typing in", () => {
    const instance = block({ headline: "Hello" });
    const ref = refTo(instance.id);

    const typed = typeInline(mounted([instance]), ref, "headline", "Hello you");

    expect(dataAt(typed, ref)).toStrictEqual({ headline: "Hello you" });
    expect(isVisualEditorDirty(typed)).toBe(true);
  });

  it("lands on a block nested inside an area", () => {
    const child = block({ headline: "Hello" });
    const area = createAreaInstance({ children: [child] });
    const ref = refTo(child.id, area.id);

    const typed = typeInline(mounted([area]), ref, "headline", "Nested");

    expect(dataAt(typed, ref)).toStrictEqual({ headline: "Nested" });
  });

  it("drops the key entirely when the text clears an optional field", () => {
    const instance = block({ headline: "Hello", subtitle: "Draft" });
    const ref = refTo(instance.id);

    const typed = typeInline(mounted([instance]), ref, "subtitle", "");

    expect(dataAt(typed, ref)).toStrictEqual({ headline: "Hello" });
  });

  it("keeps temporarily invalid text, renders it and blocks the save", () => {
    const instance = block({ headline: "Hello" });
    const ref = refTo(instance.id);

    const typed = typeInline(mounted([instance]), ref, "headline", "Hi");

    expect(dataAt(typed, ref)).toStrictEqual({ headline: "Hi" });
    expect(unsafeZoneIds(typed)).toStrictEqual(["main"]);
    expect(
      editableBlockRender({ entry, instance: instanceAt(typed, ref) }).kind,
    ).toBe("component");
  });

  it("frees the save again once the text is valid", () => {
    const instance = block({ headline: "Hello" });
    const ref = refTo(instance.id);

    const fixed = typeInline(
      typeInline(mounted([instance]), ref, "headline", "Hi"),
      ref,
      "headline",
      "Hi there",
    );

    expect(unsafeZoneIds(fixed)).toStrictEqual([]);
  });
});

describe("what discard and save already do to an inline edit", () => {
  it("restores the baseline the zone was mounted with", () => {
    const instance = block({ headline: "Hello" });
    const ref = refTo(instance.id);

    const typed = typeInline(mounted([instance]), ref, "headline", "Hello you");
    const discarded = visualEditorReducer(typed, { type: "discard" });

    expect(dataAt(discarded, ref)).toStrictEqual({ headline: "Hello" });
    expect(isVisualEditorDirty(discarded)).toBe(false);
    expect(discarded.selected).toBeNull();
  });

  it("adopts the value the server canonicalised", () => {
    const instance = block({ headline: "Hello" });
    const ref = refTo(instance.id);

    const typed = typeInline(mounted([instance]), ref, "headline", " hello ");
    const saved = visualEditorReducer(typed, {
      canonical: { main: [{ ...instance, data: { headline: "hello" } }] },
      invalid: buildInvalidSnapshot(typed),
      snapshot: buildSaveInput(typed).zones,
      type: "saved",
    });

    expect(dataAt(saved, ref)).toStrictEqual({ headline: "hello" });
    expect(isVisualEditorDirty(saved)).toBe(false);
  });

  it("keeps an edit made while the save was still in flight", () => {
    const instance = block({ headline: "Hello" });
    const ref = refTo(instance.id);

    const sent = typeInline(mounted([instance]), ref, "headline", " hello ");
    const inFlight = {
      invalid: buildInvalidSnapshot(sent),
      snapshot: buildSaveInput(sent).zones,
    };

    const newer = typeInline(sent, ref, "headline", "hello again");
    const saved = visualEditorReducer(newer, {
      ...inFlight,
      canonical: { main: [{ ...instance, data: { headline: "hello" } }] },
      type: "saved",
    });

    expect(dataAt(saved, ref)).toStrictEqual({ headline: "hello again" });
    expect(saved.zones.main.initial[0]).toStrictEqual({
      ...instance,
      data: { headline: "hello" },
    });
    expect(isVisualEditorDirty(saved)).toBe(true);
  });
});

describe("a block that stops existing while a field is focused", () => {
  it("leaves no selection pointing at the removed block", () => {
    const instance = block({ headline: "Hello" });
    const ref = refTo(instance.id);

    const selected = visualEditorReducer(mounted([instance]), {
      ref,
      type: "select",
    });
    expect(selected.selected).toStrictEqual(ref);

    const removed = visualEditorReducer(selected, { ref, type: "remove" });

    expect(removed.selected).toBeNull();
    expect(findBlock(removed, ref)).toBeNull();
  });

  it("gives a duplicate its own data to type into", () => {
    const instance = block({ headline: "Hello" });
    const ref = refTo(instance.id);

    const copied = visualEditorReducer(mounted([instance]), {
      ref,
      type: "duplicate",
    });
    const copyRef = copied.selected;
    if (copyRef === null) throw new Error("the copy was not selected");

    expect(copyRef.nodeId).not.toBe(instance.id);

    const typed = typeInline(copied, copyRef, "headline", "Copy");

    expect(dataAt(typed, copyRef)).toStrictEqual({ headline: "Copy" });
    expect(dataAt(typed, ref)).toStrictEqual({ headline: "Hello" });
  });
});
