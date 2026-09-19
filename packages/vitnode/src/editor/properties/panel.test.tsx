import { fireEvent, render, screen } from "@testing-library/react";
import { act, type ReactElement, useEffect, useReducer } from "react";
import { describe, expect, it, vi } from "vitest";

import type { BlockComponentProps, BlockData } from "../../blocks/types";
import type { VisualEditorContextValue } from "../context";
import type { VisualEditorAction } from "../state/types";

import { contentNodeBlocks } from "../../blocks/area";
import { defineBlock } from "../../blocks/define";
import { createBlockRegistry } from "../../blocks/registry";
import { field } from "../../content/fields";
import { VisualEditorContext } from "../context";
import {
  initialVisualEditorState,
  visualEditorReducer,
} from "../state/reducer";
import { EditorPropertiesPanel } from "./panel";

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

const fields = {
  body: field.text({ required: true }),
  title: field.text({ minLength: 3, required: true }),
};

const Card = ({ data }: BlockComponentProps<BlockData<typeof fields>>) => (
  <p>{data.title}</p>
);

const dateFields = {
  archivedAt: field.dateTime({ nullable: true }),
  publishedAt: field.dateTime(),
  seo: field.group({
    fields: {
      retiredAt: field.dateTime({ nullable: true }),
      note: field.text({ nullable: true }),
    },
  }),
  startsAt: field.dateTime({ required: true }),
};

const Schedule = ({
  data,
}: BlockComponentProps<BlockData<typeof dateFields>>) => <p>{data.startsAt}</p>;

const registry = createBlockRegistry([
  {
    pluginId: "@vitnode/core",
    namespace: "core",
    blocks: [
      defineBlock({ component: Card, fields, id: "card" }),
      defineBlock({ component: Schedule, fields: dateFields, id: "schedule" }),
    ],
  },
]);

const NODE_ID = "01JPANELTESTBLOCK00000001";

interface HarnessNode {
  data: Record<string, unknown>;
  id: string;
  type: string;
}

const instance = (title: string, body: string): HarnessNode => ({
  data: { body, title },
  id: NODE_ID,
  type: "core:card",
});

const ISO = "2026-08-02T10:00:00.000Z";

const scheduled = (data: Record<string, unknown>): HarnessNode => ({
  data,
  id: NODE_ID,
  type: "core:schedule",
});

const ref = {
  areaId: null,
  kind: "block" as const,
  nodeId: NODE_ID,
  zoneId: "main",
};

const harness = {
  dispatch: (_action: VisualEditorAction): void => undefined,
  state: initialVisualEditorState,
};

const Harness = ({
  node = instance("AAA", "body"),
}: {
  node?: HarnessNode;
}): ReactElement => {
  const [state, dispatch] = useReducer(visualEditorReducer, undefined, () => {
    let seeded = visualEditorReducer(initialVisualEditorState, {
      type: "mount",
      zone: {
        allowedBlocks: undefined,
        id: "main",
        invalid: [],
        max: undefined,
        min: undefined,
        nodes: [node],
        registry,
      },
    });
    seeded = visualEditorReducer(seeded, { ref, type: "select" });

    return seeded;
  });

  useEffect(() => {
    harness.dispatch = dispatch;
    harness.state = state;
  });

  const value = {
    dispatch,
    state,
  } as unknown as VisualEditorContextValue;

  return (
    <VisualEditorContext value={value}>
      <EditorPropertiesPanel />
    </VisualEditorContext>
  );
};

const typeInto = (element: Element, value: string): void => {
  act(() => {
    fireEvent.change(element, { target: { value } });
  });
};

const storedTitle = (): unknown =>
  contentNodeBlocks(harness.state.zones.main.nodes)[0]?.data.title;

const storedBody = (): unknown =>
  contentNodeBlocks(harness.state.zones.main.nodes)[0]?.data.body;

const storedData = (): Record<string, unknown> =>
  contentNodeBlocks(harness.state.zones.main.nodes)[0]?.data ?? {};

describe("the properties form and data that changes underneath it", () => {
  it("does not write a discarded edit back when the block is selected again", () => {
    render(<Harness />);

    typeInto(screen.getByDisplayValue("AAA"), "BBB");
    expect(storedTitle()).toBe("BBB");

    act(() => {
      harness.dispatch({ type: "discard" });
    });

    expect(screen.queryByDisplayValue("BBB")).toBeNull();

    act(() => {
      harness.dispatch({ ref, type: "select" });
    });

    expect(screen.getByDisplayValue("AAA")).toBeDefined();

    typeInto(screen.getByDisplayValue("body"), "body!");

    expect(storedTitle()).toBe("AAA");
  });

  it("adopts blocks a host pushed in while the form stayed mounted", () => {
    render(<Harness />);

    expect(screen.getByDisplayValue("AAA")).toBeDefined();

    act(() => {
      harness.dispatch({
        type: "mount",
        zone: {
          allowedBlocks: undefined,
          id: "main",
          invalid: [],
          max: undefined,
          min: undefined,
          nodes: [instance("Pushed", "body")],
          registry,
        },
      });
    });

    expect(screen.getByDisplayValue("Pushed")).toBeDefined();

    typeInto(screen.getByDisplayValue("body"), "body!");

    expect(storedTitle()).toBe("Pushed");
  });

  it("adopts a canonical value the server normalized", () => {
    render(<Harness />);

    typeInto(screen.getByDisplayValue("AAA"), " hello ");
    expect(storedTitle()).toBe(" hello ");

    act(() => {
      harness.dispatch({
        canonical: { main: [instance("hello", "body")] },
        invalid: { main: [] },
        snapshot: { main: [instance(" hello ", "body")] },
        type: "saved",
      });
    });

    expect(screen.getByDisplayValue("hello")).toBeDefined();

    typeInto(screen.getByDisplayValue("body"), "body!");

    expect(storedTitle()).toBe("hello");
  });

  it("keeps the same form mounted while somebody types", () => {
    render(<Harness />);

    const title = screen.getByDisplayValue("AAA");

    typeInto(title, "Bcd");
    typeInto(title, "Bcde");
    typeInto(title, "Bcdef");

    expect(screen.getByDisplayValue("Bcdef")).toBe(title);
    expect(storedTitle()).toBe("Bcdef");
  });

  it("keeps other fields editable while one of them is invalid", () => {
    render(<Harness />);

    typeInto(screen.getByDisplayValue("AAA"), "no");
    typeInto(screen.getByDisplayValue("body"), "kept");

    expect(storedBody()).toBe("kept");
    expect(storedTitle()).toBe("AAA");
  });
});

describe("a date the block does not have to hold, cleared", () => {
  it("drops the key an optional date was stored under", () => {
    render(<Harness node={scheduled({ publishedAt: ISO, startsAt: ISO })} />);

    typeInto(screen.getByLabelText(/Published at/), "");

    expect(storedData()).toStrictEqual({ startsAt: ISO });
  });

  it("does not fault the field an optional date was cleared from", () => {
    render(<Harness node={scheduled({ publishedAt: ISO, startsAt: ISO })} />);

    const input = screen.getByLabelText(/Published at/);
    typeInto(input, "");

    expect(input.getAttribute("aria-invalid")).toBe("false");
  });

  it("stores null for a nullable date inside a group, keeping its siblings", () => {
    render(
      <Harness
        node={scheduled({
          seo: { note: "hi", retiredAt: ISO },
          startsAt: ISO,
        })}
      />,
    );

    typeInto(screen.getByLabelText(/Retired at/), "");

    expect(storedData()).toStrictEqual({
      seo: { note: "hi", retiredAt: null },
      startsAt: ISO,
    });
  });

  it("stores null for a nullable date", () => {
    render(<Harness node={scheduled({ archivedAt: ISO, startsAt: ISO })} />);

    typeInto(screen.getByLabelText(/Archived at/), "");

    expect(storedData()).toStrictEqual({ archivedAt: null, startsAt: ISO });
  });

  it("holds on to a required date the control cannot express as empty", () => {
    render(<Harness node={scheduled({ startsAt: ISO })} />);

    typeInto(screen.getByLabelText(/Starts at/), "");

    expect(storedData()).toStrictEqual({ startsAt: ISO });
  });

  it("stores an ISO string, never a Date, when a date is picked", () => {
    render(<Harness node={scheduled({ startsAt: ISO })} />);

    typeInto(screen.getByLabelText(/Published at/), "2026-09-01T08:30");

    expect(storedData().publishedAt).toBe(
      new Date("2026-09-01T08:30").toISOString(),
    );
  });
});
