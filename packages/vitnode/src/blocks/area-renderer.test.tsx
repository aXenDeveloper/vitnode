import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnyBlockInstance, BlockComponentProps, BlockData } from "./types";

import { field } from "../content/fields";
import { createAreaInstance } from "./area";
import { ContentArea } from "./area-renderer";
import { defineBlock } from "./define";
import { createBlockRegistry } from "./registry";
import { ContentRenderer } from "./renderer";
import { ContentZone } from "./zone";

const heroFields = {
  title: field.text({ maxLength: 40, required: true }),
};

const Hero = ({
  blockId,
  data,
  index,
}: BlockComponentProps<BlockData<typeof heroFields>>) => (
  <h1 data-block={blockId} data-index={index}>
    {data.title}
  </h1>
);

const Note = ({ data }: BlockComponentProps<BlockData<typeof heroFields>>) => (
  <p>{data.title}</p>
);

const registry = createBlockRegistry([
  {
    pluginId: "@vitnode/core",
    blocks: [defineBlock({ component: Hero, fields: heroFields, id: "hero" })],
    namespace: "core",
  },
  {
    pluginId: "@acme/site",
    blocks: [defineBlock({ component: Note, fields: heroFields, id: "note" })],
    namespace: "site",
  },
]);

const hero = (title: string, id: string): AnyBlockInstance => ({
  data: { title },
  id,
  type: "core:hero",
});

const note = (title: string, id: string): AnyBlockInstance => ({
  data: { title },
  id,
  type: "site:note",
});

const area = (children: unknown[], layout: unknown = { columns: 2 }) => ({
  children,
  id: "AREA1",
  kind: "area",
  layout,
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("an area on a public page", () => {
  it("lays its children out in a grid, in stored order", () => {
    const { container } = render(
      <ContentRenderer
        blocks={[area([hero("Left", "B1"), hero("Right", "B2")])]}
        registry={registry}
      />,
    );

    const grid = container.querySelector("[data-area-id]");

    expect(grid?.getAttribute("data-area-id")).toBe("AREA1");
    expect(grid?.className).toBe(
      "grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch justify-start justify-items-start",
    );
    expect(
      screen.getAllByRole("heading").map(node => node.textContent),
    ).toStrictEqual(["Left", "Right"]);
  });

  it("takes every layout token from what is stored", () => {
    const { container } = render(
      <ContentRenderer
        blocks={[
          area([hero("One", "B1")], {
            align: "center",
            columns: 3,
            gap: "lg",
            justify: "center",
          }),
        ]}
        registry={registry}
      />,
    );

    expect(container.querySelector("[data-area-id]")?.className).toBe(
      "grid grid-cols-1 md:grid-cols-3 gap-8 items-center justify-center justify-items-center",
    );
  });

  it("renders nothing at all when it holds no blocks", () => {
    const { container } = render(
      <ContentRenderer blocks={[area([])]} registry={registry} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders alongside the blocks stored beside it", () => {
    render(
      <ContentRenderer
        blocks={[hero("Above", "B1"), area([hero("Inside", "B2")])]}
        registry={registry}
      />,
    );

    expect(
      screen.getAllByRole("heading").map(node => node.textContent),
    ).toStrictEqual(["Above", "Inside"]);
  });

  it("hands each child its position inside the area", () => {
    render(
      <ContentRenderer
        blocks={[area([hero("First", "B1"), hero("Second", "B2")])]}
        registry={registry}
      />,
    );

    expect(
      screen.getAllByRole("heading").map(node => node.dataset.index),
    ).toStrictEqual(["0", "1"]);
  });

  it("is server-rendered, with no client boundary of its own", () => {
    const markup = renderToStaticMarkup(
      <ContentRenderer
        blocks={[area([hero("Server", "B1")])]}
        registry={registry}
      />,
    );

    expect(markup).toContain('data-area-id="AREA1"');
    expect(markup).toContain("md:grid-cols-2");
    expect(markup).toContain("Server");
  });
});

describe("children of an area go through the same pipeline", () => {
  it("falls back for a block no plugin registers", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <ContentRenderer
        blocks={[
          area([
            hero("Fine", "B1"),
            { data: { limit: 6 }, id: "B2", type: "blog:latest-posts" },
          ]),
        ]}
        registry={registry}
      />,
    );

    expect(screen.getByRole("note").textContent).toContain("blog:latest-posts");
    expect(screen.getByRole("heading").textContent).toBe("Fine");
  });

  it("honours the zone allowlist inside the area as well as outside it", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <ContentRenderer
        allowed={["core:hero"]}
        blocks={[area([hero("Allowed", "B1"), note("Refused", "B2")])]}
        registry={registry}
      />,
    );

    expect(screen.queryByText("Refused")).toBeNull();
    expect(screen.getByRole("note").textContent).toContain("site:note");
  });

  it("skips a child whose data no longer matches its fields", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <ContentRenderer
        blocks={[
          area([
            { data: { headline: "renamed" }, id: "B1", type: "core:hero" },
            hero("Fine", "B2"),
          ]),
        ]}
        registry={registry}
      />,
    );

    expect(
      screen.getAllByRole("heading").map(node => node.textContent),
    ).toStrictEqual(["Fine"]);
  });

  it("skips a child that is not a block instance at all", () => {
    vi.stubEnv("NODE_ENV", "production");

    render(
      <ContentRenderer
        blocks={[area(["nonsense", null, hero("Fine", "B1")])]}
        registry={registry}
      />,
    );

    expect(
      screen.getAllByRole("heading").map(node => node.textContent),
    ).toStrictEqual(["Fine"]);
  });

  it("uses the application's own fallback inside an area too", () => {
    render(
      <ContentRenderer
        blocks={[area([{ data: {}, id: "B1", type: "blog:latest-posts" }])]}
        fallback={({ instance }) => <p>missing {instance.type}</p>}
        registry={registry}
      />,
    );

    expect(screen.getByText("missing blog:latest-posts")).toBeTruthy();
  });
});

describe("an area that cannot be read", () => {
  const broken = area([hero("Inside", "B1")], { columns: 9 });
  const malformed = [broken, hero("Beside", "B2")];

  it("is never re-read as a block, and never crashes the page", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(<ContentRenderer blocks={malformed} registry={registry} />);

    expect(screen.getByRole("heading").textContent).toBe("Beside");
    expect(screen.getByRole("note").textContent).toContain("area");
  });

  it("shows a visitor nothing, and removes nothing from what is stored", () => {
    vi.stubEnv("NODE_ENV", "production");

    render(<ContentRenderer blocks={malformed} registry={registry} />);

    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.getByRole("heading").textContent).toBe("Beside");
    expect(broken.children).toHaveLength(1);
  });

  it("says so when the children are not a list", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { container } = render(
      <ContentRenderer
        blocks={[
          {
            children: "two",
            id: "AREA1",
            kind: "area",
            layout: { columns: 2 },
          },
        ]}
        registry={registry}
      />,
    );

    expect(screen.getByRole("note")).toBeTruthy();
    expect(container.querySelector("[data-block-type]")).toBeNull();
  });

  it("warns once about it in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(<ContentRenderer blocks={malformed} registry={registry} />);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("area");
  });
});

describe("an area stored inside an area", () => {
  const nested = [area([hero("Kept", "B1"), createAreaInstance()])];

  it("is refused at render without taking the outer area down", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(<ContentRenderer blocks={nested} registry={registry} />);

    expect(screen.getByRole("heading").textContent).toBe("Kept");
    expect(screen.getByRole("note").textContent).toContain(
      "inside another area",
    );
  });

  it("is never read as a block, so it can never reach a component", () => {
    vi.stubEnv("NODE_ENV", "production");

    const { container } = render(
      <ContentRenderer blocks={nested} registry={registry} />,
    );

    expect(container.querySelectorAll("[data-area-id]")).toHaveLength(1);
    expect(screen.queryByRole("note")).toBeNull();
  });
});

describe("a zone that holds only areas", () => {
  it("wraps them the way it wraps blocks", () => {
    const { container } = render(
      <ContentZone
        as="section"
        blocks={[area([hero("Inside", "B1")])]}
        className="mx-auto"
        id="main"
        registry={registry}
      />,
    );

    const section = container.querySelector("section");

    expect(section?.getAttribute("data-vitnode-zone")).toBe("main");
    expect(section?.querySelector("[data-area-id]")).toBeTruthy();
    expect(screen.getByRole("heading").textContent).toBe("Inside");
  });

  it("still renders nothing for an empty list", () => {
    const { container } = render(
      <ContentZone blocks={[]} id="main" registry={registry} />,
    );

    expect(container.innerHTML).toBe("");
  });
});

describe("the area element itself", () => {
  it("renders nothing when it has no children to lay out", () => {
    const { container } = render(
      <ContentArea area={createAreaInstance()} renderChild={() => null} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("asks the caller to render each child, in order", () => {
    const seen: string[] = [];

    render(
      <ContentArea
        area={createAreaInstance({
          children: [hero("A", "B1"), hero("B", "B2")],
        })}
        renderChild={child => {
          seen.push((child as AnyBlockInstance).id);

          return null;
        }}
      />,
    );

    expect(seen).toStrictEqual(["B1", "B2"]);
  });
});
