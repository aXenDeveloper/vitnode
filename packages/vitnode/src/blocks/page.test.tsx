import { render, screen } from "@testing-library/react";
import { act, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { VisualEditorAdapter } from "../editor/adapter/types";
import type { ContentEditRuntime, ContentZoneMount } from "./edit-context";
import type { BlockComponentProps, BlockData, ContentNode } from "./types";

import { defineEditablePage } from "../content/editor/define";
import { field } from "../content/fields";
import { CONTENT_BLOCKS_DEFAULT_MAX } from "./const";
import { defineBlock } from "./define";
import { ContentEditContext } from "./edit-context";
import { EditablePage } from "./page";
import { createBlockRegistry, isBlockAllowed } from "./registry";
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
    main: { allowed: ["core:text"], max: 4 },
    sidebar: {
      allowed: ["core:text"],
      default: [block("Shipped", "d1")],
      max: 3,
      min: 1,
    },
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

  it("still takes the allowlist from the page when the blocks are passed", () => {
    const { container } = render(
      <EditablePage layout={layout} page={page}>
        <ContentZone
          as="aside"
          blocks={[block("Passed", "p1")]}
          id="main"
          registry={registry}
        />
      </EditablePage>,
    );

    expect(screen.getByText("Passed")).toBeDefined();
    expect(
      container
        .querySelector("aside")
        ?.getAttribute("data-vitnode-zone-allowed"),
    ).toBe("core:text");
  });

  it("refuses to let a wider explicit allowlist through, blocks or not", () => {
    const { container } = render(
      <EditablePage layout={layout} page={page}>
        <ContentZone
          allowedBlocks="*"
          as="aside"
          blocks={[block("Passed", "p1")]}
          id="main"
          registry={registry}
        />
      </EditablePage>,
    );

    expect(
      container
        .querySelector("aside")
        ?.getAttribute("data-vitnode-zone-allowed"),
    ).toBe("core:text");
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

  it("borrows nothing from the page for a zone the page never declared", () => {
    const { container } = render(
      <EditablePage layout={layout} page={page}>
        <ContentZone
          as="aside"
          blocks={[block("Record", "r1")]}
          id="article-body"
          registry={registry}
        />
      </EditablePage>,
    );

    expect(
      container
        .querySelector("aside")
        ?.hasAttribute("data-vitnode-zone-allowed"),
    ).toBe(false);
  });

  it("keeps the page's allowlist when the call site asks for a wider one", () => {
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
    ).toBe("core:text");
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
        expectedZones: { main: [block("Stored", "s1")] },
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
        expectedZones: { main: [block("Stored", "s1")] },
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
        expectedZones: { main: [block("Stored", "s1")] },
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

describe("the bounds a zone hands the editor", () => {
  const mountOf = (zone: ReactNode): ContentZoneMount => {
    const mounts: ContentZoneMount[] = [];
    const runtime: ContentEditRuntime = {
      preview: false,
      registerZone: entry => {
        mounts.push(entry.mount);
      },
      releaseZone: () => undefined,
    };

    render(
      <EditablePage layout={layout} page={page}>
        <ContentEditContext value={runtime}>{zone}</ContentEditContext>
      </EditablePage>,
    );

    const last = mounts.at(-1);

    if (!last) throw new Error("the zone registered no mount with the editor");

    return last;
  };

  it("takes them from the page the zone belongs to", () => {
    const mount = mountOf(<ContentZone id="sidebar" registry={registry} />);

    expect(mount.max).toBe(3);
    expect(mount.min).toBe(1);
  });

  it("inherits them even when the blocks were passed explicitly", () => {
    const mount = mountOf(
      <ContentZone
        blocks={[block("Passed", "p1")]}
        id="sidebar"
        registry={registry}
      />,
    );

    expect(mount.blocks).toStrictEqual([block("Passed", "p1")]);
    expect(mount.max).toBe(3);
    expect(mount.min).toBe(1);
  });

  it("falls back to what storage allows for a zone the page never declared", () => {
    const mount = mountOf(
      <ContentZone
        blocks={[block("Record", "r1")]}
        id="article-body"
        registry={registry}
      />,
    );

    expect(mount.max).toBe(CONTENT_BLOCKS_DEFAULT_MAX);
    expect(mount.min).toBeUndefined();
  });

  it("lets the call site override the page's own bounds", () => {
    const mount = mountOf(
      <ContentZone id="sidebar" max={2} min={2} registry={registry} />,
    );

    expect(mount.max).toBe(2);
    expect(mount.min).toBe(2);
  });
});

describe("the bounds a call site may and may not ask for", () => {
  const bounded = defineEditablePage({
    id: "example:bounded",
    permission: { module: "widgets", permission: "can_edit" },
    zones: {
      narrow: {
        allowed: ["core:text"],
        default: [block("One", "n1")],
        max: 3,
        min: 1,
      },
      roomy: {
        allowed: ["core:text"],
        default: [block("One", "r1"), block("Two", "r2")],
        max: 10,
        min: 2,
      },
    },
  });

  const registered = (zone: ReactNode, inPage = true): ContentZoneMount => {
    const mounts: ContentZoneMount[] = [];
    const runtime: ContentEditRuntime = {
      preview: false,
      registerZone: entry => {
        mounts.push(entry.mount);
      },
      releaseZone: () => undefined,
    };
    const edited = (
      <ContentEditContext value={runtime}>{zone}</ContentEditContext>
    );

    render(
      inPage ? <EditablePage page={bounded}>{edited}</EditablePage> : edited,
    );

    const last = mounts.at(-1);

    if (!last) throw new Error("the zone registered no mount with the editor");

    return last;
  };

  it("keeps the page's max when the call site asks for a looser one", () => {
    expect(
      registered(<ContentZone id="narrow" max={10} registry={registry} />).max,
    ).toBe(3);
  });

  it("takes the call site's max when it is tighter than the page's", () => {
    expect(
      registered(<ContentZone id="roomy" max={3} registry={registry} />).max,
    ).toBe(3);
  });

  it("keeps the page's min when the call site asks for a looser one", () => {
    expect(
      registered(<ContentZone id="roomy" min={0} registry={registry} />).min,
    ).toBe(2);
  });

  it("takes the call site's min when it is tighter than the page's", () => {
    expect(
      registered(<ContentZone id="narrow" min={2} registry={registry} />).min,
    ).toBe(2);
  });

  it("narrows both ends at once, each from whichever side is tighter", () => {
    const mount = registered(
      <ContentZone id="roomy" max={4} min={0} registry={registry} />,
    );

    expect(mount.max).toBe(4);
    expect(mount.min).toBe(2);
  });

  it("refuses a pair no list of blocks could satisfy, and says why", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      registered(<ContentZone id="narrow" min={5} registry={registry} />),
    ).toThrow(/min 5 and max 3/);
  });

  it("leaves a zone the page never declared with exactly what it was given", () => {
    const mount = registered(
      <ContentZone
        blocks={[block("Alone", "a1")]}
        id="free"
        max={5}
        min={2}
        registry={registry}
      />,
      false,
    );

    expect(mount.max).toBe(5);
    expect(mount.min).toBe(2);
  });

  it("still inherits the page's bounds and allowlist behind explicit blocks", () => {
    const mount = registered(
      <ContentZone
        blocks={[block("Passed", "p1")]}
        id="roomy"
        registry={registry}
      />,
    );

    expect(mount.allowedBlocks).toStrictEqual(["core:text"]);
    expect(mount.max).toBe(10);
    expect(mount.min).toBe(2);
  });
});

describe("the allowlist a call site may and may not ask for", () => {
  const gated = defineEditablePage({
    id: "example:gated",
    permission: { module: "widgets", permission: "can_edit" },
    zones: {
      anything: {},
      core: { allowed: ["core:*"] },
      text: { allowed: ["core:text"] },
    },
  });

  const registered = (zone: ReactNode, inPage = true): ContentZoneMount => {
    const mounts: ContentZoneMount[] = [];
    const runtime: ContentEditRuntime = {
      preview: false,
      registerZone: entry => {
        mounts.push(entry.mount);
      },
      releaseZone: () => undefined,
    };
    const edited = (
      <ContentEditContext value={runtime}>{zone}</ContentEditContext>
    );

    render(
      inPage ? <EditablePage page={gated}>{edited}</EditablePage> : edited,
    );

    const last = mounts.at(-1);

    if (!last) throw new Error("the zone registered no mount with the editor");

    return last;
  };

  it("cannot be widened to everything by the call site", () => {
    expect(
      registered(
        <ContentZone allowedBlocks="*" id="text" registry={registry} />,
      ).allowedBlocks,
    ).toStrictEqual(["core:text"]);
  });

  it("narrows a page that allows everything", () => {
    expect(
      registered(
        <ContentZone
          allowedBlocks={["core:text"]}
          id="anything"
          registry={registry}
        />,
      ).allowedBlocks,
    ).toStrictEqual(["core:text"]);
  });

  it("keeps only the namespace the page opened", () => {
    const mount = registered(
      <ContentZone
        allowedBlocks={["core:text", "example:callout"]}
        id="core"
        registry={registry}
      />,
    );

    if (!mount.allowedBlocks) throw new Error("the mount carried no allowlist");

    expect(isBlockAllowed(mount.allowedBlocks, "core:text")).toBe(true);
    expect(isBlockAllowed(mount.allowedBlocks, "example:callout")).toBe(false);
  });

  it("inherits the page's allowlist behind explicit blocks", () => {
    const mount = registered(
      <ContentZone
        allowedBlocks="*"
        blocks={[block("Passed", "p1")]}
        id="text"
        registry={registry}
      />,
    );

    expect(mount.blocks).toStrictEqual([block("Passed", "p1")]);
    expect(mount.allowedBlocks).toStrictEqual(["core:text"]);
  });

  it("leaves a zone the page never declared with its own allowlist", () => {
    const mount = registered(
      <ContentZone
        allowedBlocks="*"
        blocks={[block("Record", "r1")]}
        id="article-body"
        registry={registry}
      />,
    );

    expect(mount.allowedBlocks).toBe("*");
  });

  it("keeps a standalone zone outside any page exactly as it was written", () => {
    const mount = registered(
      <ContentZone
        allowedBlocks={["core:text"]}
        blocks={[block("Alone", "a1")]}
        id="article-body"
        registry={registry}
      />,
      false,
    );

    expect(mount.allowedBlocks).toStrictEqual(["core:text"]);
  });

  it("refuses a call site that leaves the zone with no block at all", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      registered(
        <ContentZone
          allowedBlocks={["example:callout"]}
          id="text"
          registry={registry}
        />,
      ),
    ).toThrow(/no allowed blocks at all/);
  });

  it("refuses it on a public page too, not only under the editor", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      render(
        <EditablePage page={gated}>
          <ContentZone
            allowedBlocks={["example:callout"]}
            id="text"
            registry={registry}
          />
        </EditablePage>,
      ),
    ).toThrow(/no allowed blocks at all/);
  });
});

describe("the max a page zone hands the editor when it declares none", () => {
  const open = defineEditablePage({
    id: "example:open",
    permission: { module: "widgets", permission: "can_edit" },
    zones: {
      generous: { max: 300 },
      plain: {},
    },
  });

  const registered = (zone: ReactNode): ContentZoneMount => {
    const mounts: ContentZoneMount[] = [];
    const runtime: ContentEditRuntime = {
      preview: false,
      registerZone: entry => {
        mounts.push(entry.mount);
      },
      releaseZone: () => undefined,
    };

    render(
      <EditablePage page={open}>
        <ContentEditContext value={runtime}>{zone}</ContentEditContext>
      </EditablePage>,
    );

    const last = mounts.at(-1);

    if (!last) throw new Error("the zone registered no mount with the editor");

    return last;
  };

  it("hands the editor the same default the server validates through", () => {
    expect(registered(<ContentZone id="plain" registry={registry} />).max).toBe(
      CONTENT_BLOCKS_DEFAULT_MAX,
    );
  });

  it("keeps that default when the call site asks for a looser one", () => {
    expect(
      registered(<ContentZone id="plain" max={500} registry={registry} />).max,
    ).toBe(CONTENT_BLOCKS_DEFAULT_MAX);
  });

  it("takes the call site's max when it is tighter than the default", () => {
    expect(
      registered(<ContentZone id="plain" max={50} registry={registry} />).max,
    ).toBe(50);
  });

  it("leaves a zone that declares its own max alone", () => {
    expect(
      registered(<ContentZone id="generous" registry={registry} />).max,
    ).toBe(300);
  });
});
