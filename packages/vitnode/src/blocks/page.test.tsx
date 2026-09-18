import { render, screen } from "@testing-library/react";
import { act, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { VisualEditorAdapter } from "../editor/adapter/types";
import type { BlockComponentProps, BlockData, ContentNode } from "./types";

import { defineEditablePage } from "../content/editor/define";
import { field } from "../content/fields";
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
  zones: {
    main: { allowed: ["core:text"] },
    sidebar: { allowed: ["core:text"], default: [block("Shipped", "d1")] },
  },
});

const layout = {
  pageId: "example:settings",
  updatedAt: "2026-01-01T00:00:00.000Z",
  zones: { main: [block("Stored", "s1")] },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a zone inside an editable page", () => {
  it("renders the stored blocks from nothing but its id", () => {
    render(
      <EditablePage layout={layout} page={page}>
        <ContentZone id="main" registry={registry} />
      </EditablePage>,
    );

    expect(screen.getByText("Stored")).toBeDefined();
  });

  it("falls back to the zone's shipped default when nothing is stored for it", () => {
    render(
      <EditablePage layout={layout} page={page}>
        <ContentZone id="sidebar" registry={registry} />
      </EditablePage>,
    );

    expect(screen.getByText("Shipped")).toBeDefined();
  });

  it("takes the allowlist from the page, so the markup never repeats it", () => {
    const { container } = render(
      <EditablePage layout={layout} page={page}>
        <ContentZone as="aside" id="main" registry={registry} />
      </EditablePage>,
    );

    expect(
      container
        .querySelector("aside")
        ?.getAttribute("data-vitnode-zone-allowed"),
    ).toBe("core:text");
  });

  it("lets an explicitly passed block list win over the page's", () => {
    render(
      <EditablePage layout={layout} page={page}>
        <ContentZone
          blocks={[block("Passed", "p1")]}
          id="main"
          registry={registry}
        />
      </EditablePage>,
    );

    expect(screen.getByText("Passed")).toBeDefined();
    expect(screen.queryByText("Stored")).toBeNull();
  });

  it("renders a zone the page does not declare when its blocks are passed", () => {
    render(
      <EditablePage layout={layout} page={page}>
        <ContentZone
          blocks={[block("Record", "r1")]}
          id="article-body"
          registry={registry}
        />
      </EditablePage>,
    );

    expect(screen.getByText("Record")).toBeDefined();
  });

  it("lets an explicitly passed allowlist win too", () => {
    const { container } = render(
      <EditablePage layout={layout} page={page}>
        <ContentZone
          allowedBlocks="*"
          as="aside"
          id="main"
          registry={registry}
        />
      </EditablePage>,
    );

    expect(
      container
        .querySelector("aside")
        ?.getAttribute("data-vitnode-zone-allowed"),
    ).toBe("*");
  });

  it("renders an empty zone as no markup at all", () => {
    const { container } = render(
      <EditablePage layout={layout} page={page}>
        <ContentZone blocks={null} id="main" registry={registry} />
      </EditablePage>,
    );

    expect(container.innerHTML).toBe("");
  });

  it("refuses an id the page does not declare, naming the ones it does", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      render(
        <EditablePage layout={layout} page={page}>
          <ContentZone id="footer" registry={registry} />
        </EditablePage>,
      ),
    ).toThrow(/has no zone "footer". It declares "main", "sidebar"/);
  });

  it("refuses a layout belonging to another page", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      render(
        <EditablePage
          layout={{ ...layout, pageId: "example:home" }}
          page={page}
        >
          <ContentZone id="main" registry={registry} />
        </EditablePage>,
      ),
    ).toThrow(/belongs to the page "example:home"/);
  });
});

describe("a zone outside an editable page", () => {
  it("still renders exactly what it was handed", () => {
    render(
      <ContentZone
        blocks={[block("Alone", "a1")]}
        id="main"
        registry={registry}
      />,
    );

    expect(screen.getByText("Alone")).toBeDefined();
  });

  it("renders nothing when it was handed nothing, rather than looking one up", () => {
    const { container } = render(<ContentZone id="main" registry={registry} />);

    expect(container.innerHTML).toBe("");
  });
});

describe("what a page renders once a save lands", () => {
  const editable = (
    layoutProp: typeof layout,
    adapter: VisualEditorAdapter,
  ) => (
    <EditablePage
      adapter={adapter}
      canEdit
      editing
      layout={layoutProp}
      page={page}
    >
      <ContentZone id="main" registry={registry} />
    </EditablePage>
  );

  it("adopts the canonical blocks, and a later host re-render cannot revert them", async () => {
    const adapter: VisualEditorAdapter = {
      save: () => ({ zones: { main: [block("Canonical", "c1")] } }),
    };
    const view = render(editable(layout, adapter));

    expect(screen.getByText("Stored")).toBeDefined();

    const saving = seam.adapter;

    if (!saving)
      throw new Error("the editable page handed the seam no adapter");

    await act(async () => {
      await saving.save({
        changedZoneIds: ["main"],
        zones: { main: [block("Edited", "e1")] },
      });
    });

    expect(screen.getByText("Canonical")).toBeDefined();

    view.rerender(editable({ ...layout, zones: { ...layout.zones } }, adapter));

    expect(screen.getByText("Canonical")).toBeDefined();
    expect(screen.queryByText("Stored")).toBeNull();
  });

  it("adopts what it sent when the adapter answers with nothing", async () => {
    const adapter: VisualEditorAdapter = { save: () => undefined };

    render(editable(layout, adapter));

    const saving = seam.adapter;

    if (!saving)
      throw new Error("the editable page handed the seam no adapter");

    await act(async () => {
      await saving.save({
        changedZoneIds: ["main"],
        zones: { main: [block("Edited", "e1")] },
      });
    });

    expect(screen.getByText("Edited")).toBeDefined();
  });

  it("reseeds from the server when the layout genuinely moved", async () => {
    const adapter: VisualEditorAdapter = { save: () => undefined };
    const view = render(editable(layout, adapter));
    const saving = seam.adapter;

    if (!saving)
      throw new Error("the editable page handed the seam no adapter");

    await act(async () => {
      await saving.save({
        changedZoneIds: ["main"],
        zones: { main: [block("Edited", "e1")] },
      });
    });

    view.rerender(
      editable(
        {
          ...layout,
          updatedAt: "2026-03-03T00:00:00.000Z",
          zones: { main: [block("Reloaded", "r1")] },
        },
        adapter,
      ),
    );

    expect(screen.getByText("Reloaded")).toBeDefined();
  });
});
