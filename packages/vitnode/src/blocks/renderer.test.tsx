import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockComponentProps, BlockData } from "./types";

import { field } from "../content/fields";
import { defineBlock } from "./define";
import { createBlockInstance } from "./instance";
import { buildBlockRegistry, setBlockRegistry } from "./registry";
import { ContentRenderer } from "./renderer";

const heroFields = {
  title: field.text({ maxLength: 20, required: true }),
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

const heroBlock = defineBlock({
  component: Hero,
  fields: heroFields,
  id: "hero",
});

const registry = buildBlockRegistry([
  { pluginId: "@vitnode/core", blocks: [heroBlock], namespace: "core" },
]);

const instance = (title: string, id: string) => ({
  data: { title },
  id,
  type: "core:hero",
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("ContentRenderer", () => {
  it("renders every registered block in stored order", () => {
    render(
      <ContentRenderer
        blocks={[instance("First", "01"), instance("Second", "02")]}
        registry={registry}
      />,
    );

    expect(
      screen.getAllByRole("heading").map(node => node.textContent),
    ).toStrictEqual(["First", "Second"]);
  });

  it("hands the component the instance id and its position", () => {
    render(
      <ContentRenderer
        blocks={[instance("First", "01")]}
        registry={registry}
      />,
    );

    const heading = screen.getByRole("heading");
    expect(heading.dataset.block).toBe("01");
    expect(heading.dataset.index).toBe("0");
  });

  it("passes data the block's own schema validated", () => {
    render(
      <ContentRenderer
        blocks={[{ data: { title: "Parsed" }, id: "01", type: "core:hero" }]}
        registry={registry}
      />,
    );

    expect(screen.getByRole("heading").textContent).toBe("Parsed");
  });

  it("renders nothing for an empty or absent zone", () => {
    const { container } = render(
      <ContentRenderer blocks={[]} registry={registry} />,
    );

    expect(container.innerHTML).toBe("");
    render(<ContentRenderer blocks={null} registry={registry} />);
  });

  it("falls back to the registered registry when none is passed", () => {
    setBlockRegistry(registry);
    render(<ContentRenderer blocks={[instance("Global", "01")]} />);

    expect(screen.getByRole("heading").textContent).toBe("Global");
  });

  describe("when a block is unavailable", () => {
    const withDisabledPlugin = [
      instance("Still here", "01"),
      { data: { limit: 6 }, id: "02", type: "blog:latest-posts" },
    ];

    it("keeps rendering the rest of the page", () => {
      vi.stubEnv("NODE_ENV", "production");
      render(
        <ContentRenderer blocks={withDisabledPlugin} registry={registry} />,
      );

      expect(screen.getByRole("heading").textContent).toBe("Still here");
    });

    it("shows nothing to a visitor in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      render(
        <ContentRenderer blocks={withDisabledPlugin} registry={registry} />,
      );

      expect(screen.queryByRole("note")).toBeNull();
    });

    it("says so in development", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      render(
        <ContentRenderer blocks={withDisabledPlugin} registry={registry} />,
      );

      expect(screen.getByRole("note").textContent).toContain(
        "blog:latest-posts",
      );
    });

    it("accepts a fallback of the application's own", () => {
      render(
        <ContentRenderer
          blocks={withDisabledPlugin}
          fallback={({ instance: missing }) => <p>missing {missing.type}</p>}
          registry={registry}
        />,
      );

      expect(screen.getByText("missing blog:latest-posts")).toBeTruthy();
    });
  });

  it("skips an instance whose data the block refuses", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(
      <ContentRenderer
        blocks={[
          {
            data: { title: "a title that is far too long" },
            id: "01",
            type: "core:hero",
          },
          instance("Fine", "02"),
        ]}
        registry={registry}
      />,
    );

    expect(
      screen.getAllByRole("heading").map(node => node.textContent),
    ).toStrictEqual(["Fine"]);
  });

  it("skips a value that is not a block instance at all", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { container } = render(
      <ContentRenderer blocks={["nonsense", null]} registry={registry} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("keys instances by their stable id", () => {
    const one = createBlockInstance("core:hero", { title: "One" });
    const { rerender } = render(
      <ContentRenderer blocks={[one]} registry={registry} />,
    );
    const first = screen.getByRole("heading");

    rerender(
      <ContentRenderer
        blocks={[createBlockInstance("core:hero", { title: "Zero" }), one]}
        registry={registry}
      />,
    );

    expect(screen.getAllByRole("heading")[1]).toBe(first);
  });
});
