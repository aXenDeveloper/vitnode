import { render, screen } from "@testing-library/react";
import { act, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type {
  VisualEditorAdapter,
  VisualEditorSaveInput,
} from "../editor/adapter/types";
import type { BlockComponentProps, BlockData, ContentNode } from "./types";

import { EditablePageSaveRefused } from "../content/editor/adapter";
import { defineEditablePage } from "../content/editor/define";
import { field } from "../content/fields";
import { isSaveConflict, saveRefusalOf } from "../editor/adapter/refusal";
import { defineBlock } from "./define";
import { EditablePage } from "./page";
import { createBlockRegistry } from "./registry";
import { ContentZone } from "./zone";

const seam = vi.hoisted(() => ({
  adapter: undefined as undefined | VisualEditorAdapter,
}));

vi.mock("./edit", () => ({
  ContentEditorRuntime: ({
    adapter,
    children,
  }: {
    adapter?: VisualEditorAdapter;
    children: ReactNode;
  }) => {
    seam.adapter = adapter;

    return <>{children}</>;
  },
}));

const textFields = { heading: field.text({ maxLength: 40, required: true }) };

const Text = ({ data }: BlockComponentProps<BlockData<typeof textFields>>) => (
  <p>{data.heading}</p>
);

const registry = createBlockRegistry([
  {
    blocks: [defineBlock({ component: Text, fields: textFields, id: "text" })],
    namespace: "core",
    pluginId: "@vitnode/core",
  },
]);

const block = (heading: string, id: string): ContentNode => ({
  data: { heading },
  id,
  type: "core:text",
});

const page = defineEditablePage({
  id: "example:settings",
  permission: { module: "widgets", permission: "can_edit" },
  zones: { main: { allowed: ["core:text"], max: 4 } },
});

const layout = {
  pageId: "example:settings",
  updatedAt: "2026-01-01T00:00:00.000Z",
  zones: { main: [block("Stored", "s1")] },
};

const CONFLICT =
  "This layout changed since you opened the editor. Reload or discard before saving again.";

const input: VisualEditorSaveInput = {
  changedZoneIds: ["main"],
  expectedZones: { main: [block("Stored", "s1")] },
  zones: { main: [block("Edited", "e1")] },
};

const mounted = (adapter: VisualEditorAdapter): VisualEditorAdapter => {
  render(
    <EditablePage adapter={adapter} canEdit layout={layout} page={page}>
      <ContentZone id="main" registry={registry} />
    </EditablePage>,
  );

  const saving = seam.adapter;

  if (!saving) throw new Error("the editable page handed the seam no adapter");

  return saving;
};

describe("a save the server refused", () => {
  it("leaves the page showing what it was showing, so nothing is adopted", async () => {
    const saving = mounted({
      save: () => {
        throw new EditablePageSaveRefused(CONFLICT, {
          conflict: true,
          pageId: page.id,
        });
      },
    });

    expect(screen.getByText("Stored")).toBeDefined();

    await act(async () => {
      await expect(saving.save(input)).rejects.toThrow(/Reload or discard/);
    });

    expect(screen.getByText("Stored")).toBeDefined();
    expect(screen.queryByText("Edited")).toBeNull();
  });

  it("reaches the editor as words it can put in front of a person", () => {
    const refused = new EditablePageSaveRefused(CONFLICT, {
      conflict: true,
      pageId: page.id,
    });

    expect(saveRefusalOf(refused)).toBe(CONFLICT);
    expect(isSaveConflict(refused)).toBe(true);
  });

  it("is a conflict only when the server said the layout moved", () => {
    const refused = new EditablePageSaveRefused("That zone is full.", {
      pageId: page.id,
    });

    expect(saveRefusalOf(refused)).toBe("That zone is full.");
    expect(isSaveConflict(refused)).toBe(false);
    expect(isSaveConflict(new Error("fetch failed"))).toBe(false);
    expect(isSaveConflict({ conflict: true })).toBe(false);
  });
});
