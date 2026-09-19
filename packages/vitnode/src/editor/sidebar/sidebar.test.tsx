import { fireEvent, render, screen } from "@testing-library/react";
import { act, type ReactElement, useEffect, useReducer, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { BlockComponentProps, BlockData } from "../../blocks/types";
import type { VisualEditorContextValue } from "../context";

import { defineBlock } from "../../blocks/define";
import { createBlockRegistry } from "../../blocks/registry";
import { field } from "../../content/fields";
import { VisualEditorContext } from "../context";
import {
  initialVisualEditorState,
  visualEditorReducer,
} from "../state/reducer";
import { EditorSidebar } from "./sidebar";

vi.mock("use-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("../../hooks/use-captcha", () => ({
  useCaptcha: () => ({
    getToken: async () => Promise.resolve(undefined),
    isReady: true,
    onReset: () => undefined,
  }),
}));

const heroFields = { headline: field.text({ required: true }) };
const quoteFields = { body: field.text({ required: true }) };

const Hero = ({ data }: BlockComponentProps<BlockData<typeof heroFields>>) => (
  <p>{data.headline}</p>
);

const Quote = ({
  data,
}: BlockComponentProps<BlockData<typeof quoteFields>>) => <p>{data.body}</p>;

const registry = createBlockRegistry([
  {
    pluginId: "@vitnode/core",
    namespace: "core",
    blocks: [
      defineBlock({ component: Hero, fields: heroFields, id: "hero" }),
      defineBlock({ component: Quote, fields: quoteFields, id: "quote" }),
    ],
  },
]);

const NODE_ID = "01JSIDEBARTESTBLOCK000001";

const stored = {
  data: { headline: "Stored" },
  id: NODE_ID,
  type: "core:hero",
};

const ref = {
  areaId: null,
  kind: "block" as const,
  nodeId: NODE_ID,
  zoneId: "main",
};

const harness = {
  select: (_selected: boolean): void => undefined,
  setPreview: (_preview: boolean): void => undefined,
};

const Harness = (): ReactElement => {
  const [state, dispatch] = useReducer(visualEditorReducer, undefined, () =>
    visualEditorReducer(initialVisualEditorState, {
      type: "mount",
      zone: {
        allowedBlocks: undefined,
        id: "main",
        invalid: [],
        max: undefined,
        min: undefined,
        nodes: [stored],
        registry,
      },
    }),
  );
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    harness.select = selected => {
      dispatch({ ref: selected ? ref : null, type: "select" });
    };
    harness.setPreview = setPreview;
  }, []);

  const value = {
    canInsertBlock: () => true,
    dirty: false,
    discard: () => undefined,
    dispatch,
    exit: () => undefined,
    insertArea: () => undefined,
    insertBlock: () => undefined,
    insertTarget: null,
    panel: state.selected === null ? "blocks" : "properties",
    preview,
    save: () => undefined,
    saveStatus: "idle",
    setInsertTarget: () => undefined,
    setPanel: () => undefined,
    setPreview,
    state,
    unsafeZoneIds: [],
  } as unknown as VisualEditorContextValue;

  return (
    <VisualEditorContext value={value}>
      <EditorSidebar />
    </VisualEditorContext>
  );
};

const search = (): HTMLInputElement =>
  screen.getByLabelText<HTMLInputElement>("picker.search");

const searchFor = (query: string): void => {
  act(() => {
    fireEvent.change(search(), { target: { value: query } });
  });
};

const select = (selected: boolean): void => {
  act(() => {
    harness.select(selected);
  });
};

const preview = (on: boolean): void => {
  act(() => {
    harness.setPreview(on);
  });
};

const catalogNames = (): string[] =>
  screen
    .getAllByRole("button", { name: /^picker\.add$/ })
    .map(button => button.textContent ?? "");

describe("the catalogue the sidebar keeps between panels", () => {
  it("keeps the search query while the properties panel is open", () => {
    render(<Harness />);

    searchFor("hero");
    const input = search();

    select(true);

    expect(screen.getByRole("heading", { name: "Hero" })).toBeDefined();
    expect(search()).toBe(input);
    expect(search().value).toBe("hero");

    select(false);

    expect(search()).toBe(input);
    expect(search().value).toBe("hero");
  });

  it("keeps the search query across preview and back to editing", () => {
    render(<Harness />);

    searchFor("hero");
    const input = search();

    preview(true);

    expect(screen.queryByRole("complementary", { name: "title" })).toBeNull();
    expect(screen.getByRole("navigation", { name: "title" })).toBeDefined();

    preview(false);

    expect(screen.getByRole("complementary", { name: "title" })).toBeDefined();
    expect(screen.queryByRole("navigation", { name: "title" })).toBeNull();
    expect(search()).toBe(input);
    expect(search().value).toBe("hero");
  });

  it("keeps the filtered catalogue itself, not just the text in the box", () => {
    render(<Harness />);

    expect(catalogNames()).toHaveLength(2);

    searchFor("quote");

    const filtered = screen.getByRole("button", { name: "picker.add" });

    select(true);
    select(false);

    expect(screen.getByRole("button", { name: "picker.add" })).toBe(filtered);
    expect(catalogNames()).toHaveLength(1);
  });

  it("shows one panel at a time, never both", () => {
    render(<Harness />);

    expect(screen.queryByRole("region", { name: "properties" })).toBeNull();

    select(true);

    expect(screen.getByRole("region", { name: "properties" })).toBeDefined();
    expect(screen.queryByLabelText("picker.search")).not.toBeNull();
    expect(screen.queryByRole("textbox", { name: "picker.search" })).toBeNull();
  });
});
