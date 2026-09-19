import { fireEvent, render, screen } from "@testing-library/react";
import { act, type ReactElement, useEffect, useReducer } from "react";
import { describe, expect, it, vi } from "vitest";

import type { BlockComponentProps, BlockData } from "../../blocks/types";
import type { VisualEditorContextValue } from "../context";
import type { VisualEditorAction, VisualEditorState } from "../state/types";

import { contentNodeBlocks } from "../../blocks/area";
import { defineBlock } from "../../blocks/define";
import { createBlockRegistry } from "../../blocks/registry";
import { safeParseBlockData } from "../../blocks/schema";
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

const groupFields = {
  headline: field.text({ required: true }),
  seo: field.group({
    fields: {
      count: field.number({ integer: true, min: 1, required: true }),
      note: field.text({}),
      subtitle: field.text({ nullable: true }),
      title: field.text({ defaultValue: "Hello", required: true }),
      tone: field.enum({
        defaultValue: "info",
        required: true,
        values: ["info", "warning"],
      }),
    },
    nullable: true,
  }),
};

const Seo = defineBlock({
  component: ({ data }: BlockComponentProps<BlockData<typeof groupFields>>) => (
    <p>{data.headline}</p>
  ),
  fields: groupFields,
  id: "seo",
});

const copyFields = {
  blurb: field.textarea({ minLength: 3 }),
  headline: field.text({ minLength: 3, required: true }),
  note: field.text({ minLength: 0 }),
  slogan: field.text({ minLength: 3 }),
  subtitle: field.text({ minLength: 3, nullable: true }),
};

const Copy = ({ data }: BlockComponentProps<BlockData<typeof copyFields>>) => (
  <p>{data.headline}</p>
);

const detailFields = {
  headline: field.text({ required: true }),
  seo: field.group({
    fields: {
      caption: field.text({ required: true }),
      note: field.text({ minLength: 0 }),
      publishedAt: field.dateTime(),
      subtitle: field.text({ minLength: 3 }),
    },
  }),
};

const Detail = defineBlock({
  component: ({
    data,
  }: BlockComponentProps<BlockData<typeof detailFields>>) => (
    <p>{data.headline}</p>
  ),
  fields: detailFields,
  id: "detail",
});

const registry = createBlockRegistry([
  {
    pluginId: "@vitnode/core",
    namespace: "core",
    blocks: [
      defineBlock({ component: Card, fields, id: "card" }),
      defineBlock({ component: Schedule, fields: dateFields, id: "schedule" }),
      defineBlock({ component: Copy, fields: copyFields, id: "copy" }),
      Detail,
      Seo,
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

const grouped = (seo: unknown): HarnessNode => ({
  data: { headline: "Headline", seo },
  id: NODE_ID,
  type: "core:seo",
});

const written = (data: Record<string, unknown>): HarnessNode => ({
  data: { headline: "Headline", ...data },
  id: NODE_ID,
  type: "core:copy",
});

const detailed = (seo: Record<string, unknown>): HarnessNode => ({
  data: { headline: "Headline", seo },
  id: NODE_ID,
  type: "core:detail",
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

interface ZoneBounds {
  max?: number;
  min?: number;
}

const seeded = (node: HarnessNode, bounds: ZoneBounds): VisualEditorState =>
  visualEditorReducer(initialVisualEditorState, {
    type: "mount",
    zone: {
      allowedBlocks: undefined,
      id: "main",
      invalid: [],
      max: bounds.max,
      min: bounds.min,
      nodes: [node],
      registry,
    },
  });

const Harness = ({
  bounds = {},
  node = instance("AAA", "body"),
}: {
  bounds?: ZoneBounds;
  node?: HarnessNode;
}): ReactElement => {
  const [state, dispatch] = useReducer(visualEditorReducer, undefined, () =>
    visualEditorReducer(seeded(node, bounds), { ref, type: "select" }),
  );

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

describe("text the block does not have to hold, cleared", () => {
  it("drops the key an optional text field that refuses empty was stored under", () => {
    render(<Harness node={written({ slogan: "A valid value" })} />);

    typeInto(screen.getByLabelText(/Slogan/), "");

    expect(storedData()).toStrictEqual({ headline: "Headline" });
  });

  it("drops the key an optional textarea that refuses empty was stored under", () => {
    render(<Harness node={written({ blurb: "A valid value" })} />);

    typeInto(screen.getByLabelText(/Blurb/), "");

    expect(storedData()).toStrictEqual({ headline: "Headline" });
  });

  it("stores the empty string an optional text field actually accepts", () => {
    render(<Harness node={written({ note: "value" })} />);

    typeInto(screen.getByLabelText(/Note/), "");

    expect(storedData()).toStrictEqual({ headline: "Headline", note: "" });
  });

  it("never drops a required text field the control cannot express as empty", () => {
    render(<Harness node={written({})} />);

    typeInto(screen.getByLabelText(/Headline/), "");

    expect(storedData()).toStrictEqual({ headline: "Headline" });
  });

  it("leaves a nullable text field exactly as it found it", () => {
    render(<Harness node={written({ subtitle: "A valid value" })} />);

    typeInto(screen.getByLabelText(/Subtitle/), "");

    expect(storedData()).toStrictEqual({
      headline: "Headline",
      subtitle: "A valid value",
    });
  });

  it("clears one field without touching the others", () => {
    render(
      <Harness node={written({ note: "kept", slogan: "A valid value" })} />,
    );

    typeInto(screen.getByLabelText(/Slogan/), "");

    expect(storedData()).toStrictEqual({
      headline: "Headline",
      note: "kept",
    });
  });
});

describe("a group the block does not have to hold, switched on and off", () => {
  const toggle = (): void => {
    act(() => {
      fireEvent.click(screen.getByRole("switch", { name: "group_enabled" }));
    });
  };

  const storedGroup = (): Record<string, unknown> =>
    storedData().seo as Record<string, unknown>;

  it("opens on the group the block already holds, leaves and all", () => {
    render(
      <Harness node={grouped({ count: 2, title: "Kept", tone: "warning" })} />,
    );

    expect(screen.getByDisplayValue("Kept")).toBeDefined();
    expect(screen.getByDisplayValue("2")).toBeDefined();
  });

  it("edits one leaf of a stored group without dropping its siblings", () => {
    render(
      <Harness node={grouped({ count: 2, title: "Kept", tone: "warning" })} />,
    );

    typeInto(screen.getByDisplayValue("Kept"), "Edited");

    expect(storedGroup()).toStrictEqual({
      count: 2,
      title: "Edited",
      tone: "warning",
    });
  });

  it("enables it with values the block's own schema accepts", () => {
    render(<Harness node={grouped(null)} />);

    toggle();

    expect(storedData().seo).not.toBeNull();
    expect(safeParseBlockData(Seo, storedData()).success).toBe(true);
  });

  it("takes each required leaf's declared default rather than null", () => {
    render(<Harness node={grouped(null)} />);

    toggle();

    expect(storedGroup().title).toBe("Hello");
    expect(storedGroup().tone).toBe("info");
  });

  it("invents a usable value for a required leaf that declares no default", () => {
    render(<Harness node={grouped(null)} />);

    toggle();

    expect(storedGroup().count).toBe(1);
  });

  it("writes null for a nullable leaf, which is what nullable means", () => {
    render(<Harness node={grouped(null)} />);

    toggle();

    expect(storedGroup().subtitle).toBeNull();
  });

  it("leaves an optional leaf out instead of storing a placeholder", () => {
    render(<Harness node={grouped(null)} />);

    toggle();

    expect(Object.hasOwn(storedGroup(), "note")).toBe(false);
  });

  it("writes the whole group at once, with nothing left null", () => {
    render(<Harness node={grouped(null)} />);

    toggle();

    expect(storedGroup()).toStrictEqual({
      count: 1,
      subtitle: null,
      title: "Hello",
      tone: "info",
    });
  });

  it("stores null when the group is switched off", () => {
    render(
      <Harness node={grouped({ count: 2, title: "Kept", tone: "warning" })} />,
    );

    toggle();

    expect(storedData()).toStrictEqual({ headline: "Headline", seo: null });
  });

  it("gives the group back as it was when it is switched on again", () => {
    render(
      <Harness node={grouped({ count: 2, title: "Kept", tone: "warning" })} />,
    );

    toggle();
    toggle();

    expect(storedGroup()).toStrictEqual({
      count: 2,
      title: "Kept",
      tone: "warning",
    });
    expect(safeParseBlockData(Seo, storedData()).success).toBe(true);
  });

  it("gives back a number leaf the user typed, not a fresh default", () => {
    render(
      <Harness node={grouped({ count: 2, title: "Kept", tone: "warning" })} />,
    );

    typeInto(screen.getByDisplayValue("2"), "5");
    expect(storedGroup().count).toBe(5);

    toggle();
    toggle();

    expect(storedGroup()).toStrictEqual({
      count: 5,
      title: "Kept",
      tone: "warning",
    });
  });

  it("falls back to defaults when what it held could not be stored", () => {
    render(
      <Harness node={grouped({ count: 2, title: "Kept", tone: "warning" })} />,
    );

    typeInto(screen.getByDisplayValue("2"), "");
    toggle();
    toggle();

    expect(storedGroup()).toStrictEqual({
      count: 1,
      subtitle: null,
      title: "Hello",
      tone: "info",
    });
    expect(safeParseBlockData(Seo, storedData()).success).toBe(true);
  });
});

describe("a leaf of a group the block does have to hold, cleared", () => {
  const seo = {
    caption: "Caption",
    note: "Kept",
    publishedAt: ISO,
    subtitle: "Hello",
  };

  const storedGroup = (): Record<string, unknown> =>
    storedData().seo as Record<string, unknown>;

  const clear = (selector: string): void => {
    const input = document.querySelector(selector);
    if (!input) throw new Error(`no control matching ${selector}`);

    typeInto(input, "");
  };

  const DATE_LEAF = 'input[type="datetime-local"]';

  it("drops the nested key an optional date was stored under", () => {
    render(<Harness node={detailed(seo)} />);

    clear(DATE_LEAF);

    expect(storedGroup()).toStrictEqual({
      caption: "Caption",
      note: "Kept",
      subtitle: "Hello",
    });
  });

  it("drops the nested key an optional text field that refuses empty held", () => {
    render(<Harness node={detailed(seo)} />);

    clear('[name="seo.subtitle"]');

    expect(storedGroup()).toStrictEqual({
      caption: "Caption",
      note: "Kept",
      publishedAt: ISO,
    });
  });

  it("stores the empty string a nested optional text field accepts", () => {
    render(<Harness node={detailed(seo)} />);

    clear('[name="seo.note"]');

    expect(storedGroup()).toStrictEqual({ ...seo, note: "" });
  });

  it("never drops a required leaf the control cannot express as empty", () => {
    render(<Harness node={detailed(seo)} />);

    clear('[name="seo.caption"]');

    expect(Object.hasOwn(storedGroup(), "caption")).toBe(true);
    expect(storedGroup()).toStrictEqual({ ...seo, caption: "" });
  });

  it("leaves the block storable by its own schema after a nested clear", () => {
    render(<Harness node={detailed(seo)} />);

    clear(DATE_LEAF);

    expect(safeParseBlockData(Detail, storedData()).success).toBe(true);
  });

  it("clears one leaf without disturbing the block's other fields", () => {
    render(<Harness node={detailed(seo)} />);

    clear('[name="seo.subtitle"]');

    expect(storedData().headline).toBe("Headline");
  });
});

describe("the remove button the properties panel offers", () => {
  const SOLE_BLOCK: ZoneBounds = { max: 1, min: 1 };

  const removeDisabled = (): boolean =>
    screen
      .getByRole("button", { name: "block.remove" })
      .hasAttribute("disabled");

  const reducerRemoves = (node: HarnessNode, bounds: ZoneBounds): boolean => {
    const state = seeded(node, bounds);

    return visualEditorReducer(state, { ref, type: "remove" }) !== state;
  };

  it("refuses the sound block a zone of exactly one has to keep", () => {
    const node = instance("AAA", "body");

    render(<Harness bounds={SOLE_BLOCK} node={node} />);

    expect(removeDisabled()).toBe(true);
    expect(reducerRemoves(node, SOLE_BLOCK)).toBe(false);
  });

  it("offers the rejected block that has the zone stuck", () => {
    const node = instance("AA", "body");

    render(<Harness bounds={SOLE_BLOCK} node={node} />);

    expect(removeDisabled()).toBe(false);
    expect(reducerRemoves(node, SOLE_BLOCK)).toBe(true);
  });

  it("offers a block of a type nothing registers at all", () => {
    const node: HarnessNode = { data: {}, id: NODE_ID, type: "core:gone" };

    render(<Harness bounds={SOLE_BLOCK} node={node} />);

    expect(removeDisabled()).toBe(false);
    expect(reducerRemoves(node, SOLE_BLOCK)).toBe(true);
  });

  it("offers a sound block the zone has no minimum for", () => {
    const node = instance("AAA", "body");

    render(<Harness node={node} />);

    expect(removeDisabled()).toBe(false);
    expect(reducerRemoves(node, {})).toBe(true);
  });
});
